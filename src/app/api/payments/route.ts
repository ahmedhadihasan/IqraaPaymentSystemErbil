import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { normalizeText, createSearchPattern } from '@/lib/text-utils';
import { PRICING, calculateFamilyTotal } from '@/lib/billing';

/**
 * GET /api/payments - List payments with filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const adminId = searchParams.get('adminId') || '';
    const dateFrom = searchParams.get('from') || '';
    const dateTo = searchParams.get('to') || '';
    const today = searchParams.get('today') === 'true';

    const where: Record<string, unknown> = {
      voided: false,
    };

    if (type) {
      where.paymentType = type;
    }

    if (adminId) {
      where.recordedBy = adminId;
    }

    // Date filtering
    if (today) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      where.paymentDate = {
        gte: todayStart,
        lte: todayEnd,
      };
    } else if (dateFrom || dateTo) {
      where.paymentDate = {};
      if (dateFrom) (where.paymentDate as Record<string, Date>).gte = new Date(dateFrom);
      if (dateTo) (where.paymentDate as Record<string, Date>).lte = new Date(dateTo);
    }

    // Show only root payments (exclude sibling linked records) so family payments appear once
    (where as any).siblingPaymentId = null;

    let payments = [] as any[];

    if (adminId) {
      // If filtering by adminId (explicit), keep that filter
      (where as any).recordedBy = adminId;
      payments = await prisma.payment.findMany({
        where,
        include: { student: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
    } else if (session.user.role === 'super_admin') {
      // Super admin sees all root payments
      payments = await prisma.payment.findMany({
        where,
        include: { student: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
    } else {
      // Normal admin: only payments relevant to their assigned class times OR recordedBy themselves
      const adminRecord = await prisma.admin.findUnique({ where: { id: session.user.id }, select: { assignedClassTimes: true } });
      const adminClassTimes = adminRecord?.assignedClassTimes?.split(',').filter(Boolean) || [];

      // Fetch candidate root payments
      const candidateRoots = await prisma.payment.findMany({
        where,
        include: { student: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      const rootIds = candidateRoots.map(r => r.id);
      // Fetch child payments for these roots to check sibling class times
      const childPayments = await prisma.payment.findMany({
        where: { siblingPaymentId: { in: rootIds }, voided: false },
        include: { student: true },
      });

      payments = candidateRoots.filter((p) => {
        if (p.recordedBy === session.user.id) return true;
        if (adminClassTimes.length > 0 && p.student?.classTime && adminClassTimes.includes(p.student.classTime)) return true;
        // Check child payments linked to this root
        const childMatch = childPayments.find(cp => cp.siblingPaymentId === p.id && cp.student?.classTime && adminClassTimes.includes(cp.student.classTime));
        return Boolean(childMatch);
      }).slice(0, 200);
    }

    // Filter by student name if search provided (with Arabic/Kurdish normalization)
    let filteredPayments = payments;
    if (search) {
      const normalizedSearch = normalizeText(search.toLowerCase());
      filteredPayments = payments.filter(p => {
        const normalizedName = normalizeText(p.student.name.toLowerCase());
        if (normalizedName.includes(normalizedSearch)) return true;
        try {
          const pattern = createSearchPattern(normalizedSearch);
          const regex = new RegExp(pattern, 'i');
          return regex.test(normalizedName);
        } catch {
          return false;
        }
      });
    }

    // Map to response format
    const result = filteredPayments.map(p => ({
      id: p.id,
      studentId: p.studentId,
      amount: p.amount,
      paymentDate: p.paymentDate.toISOString(),
      paymentType: p.paymentType,
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
      monthsCount: p.monthsCount,
      siblingNames: p.siblingNames,
      siblingStudentId: p.siblingStudentId,
      notes: p.notes,
      studentName: p.student.name,
      studentClassTime: p.student.classTime,
      recordedBy: p.recordedBy,
      recordedByName: p.recordedByName,
      createdAt: p.createdAt.toISOString(),
    }));

    // Calculate true total matching all filters
    const totalPayments = await prisma.payment.aggregate({
      where,
      _sum: { amount: true }
    });
    const totalAmount = totalPayments._sum.amount || 0;

    return NextResponse.json({
      payments: result,
      totalAmount
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments - Record a new payment
 * Supports single student, family (up to 6 siblings), donation, scholarship
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.studentId || !body.amount) {
      return NextResponse.json(
        { error: 'Student and amount are required' },
        { status: 400 }
      );
    }

    // Verify main student exists
    const student = await prisma.student.findUnique({
      where: { id: body.studentId },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Get admin name
    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
      select: { fullName: true },
    });

    // Determine period and months
    const periodStart = body.periodStart ? new Date(body.periodStart) : new Date('2026-01-01');
    const periodEnd = body.periodEnd ? new Date(body.periodEnd) : new Date('2026-07-01');
    const monthsCount = parseInt(body.monthsCount || '0', 10) || (body.billingMode === 'monthly' ? 0 : 6);

    // Billing mode
    const billingMode = body.billingMode || 'semester';

    // Get student count for family payments (including primary)
    const siblingIds: string[] = body.siblingStudentIds || [];
    const totalStudents = 1 + siblingIds.length;

    // Compute main payment amount if not provided
    let mainAmount = Number(body.amount) || 0;

    if (billingMode === 'monthly') {
      // monthly per-student
      const perStudent = PRICING.MONTHLY;
      if (!mainAmount) {
        // main student pays monthsCount * perStudent
        mainAmount = monthsCount * perStudent;
      }
    } else {
      // semester/batch
      if (!mainAmount) {
        if (body.paymentType === 'family') {
          // compute based on sibling count
          mainAmount = calculateFamilyTotal(totalStudents);
        } else {
          mainAmount = PRICING.SINGLE_STUDENT;
        }
      }
    }

    // OPTIMIZATION: Batch fetch all siblings at once instead of N+1 queries
    let siblingStudents: { id: string; name: string }[] = [];
    if (body.paymentType === 'family' && siblingIds.length > 0) {
      siblingStudents = await prisma.student.findMany({
        where: { id: { in: siblingIds } },
        select: { id: true, name: true },
      });
    }

    // Use transaction to ensure all payments are created atomically
    const payment = await prisma.$transaction(async (tx) => {
      // Create main payment (first student)
      const mainPayment = await tx.payment.create({
        data: {
          studentId: body.studentId,
          amount: Math.round(mainAmount),
          paymentDate: new Date(),
          paymentType: body.paymentType || 'single',
          periodStart,
          periodEnd,
          monthsCount,
          siblingNames: body.siblingNames || null,
          siblingStudentId: null,
          notes: body.notes || null,
          recordedBy: session.user.id,
          recordedByName: admin?.fullName || 'Unknown',
        },
        include: {
          student: true,
        },
      });

      // Handle family payments - create linked payments for all siblings for tracking
      if (body.paymentType === 'family' && siblingStudents.length > 0) {
        const allSiblingNames = [student.name, ...siblingStudents.map(s => s.name)].filter(Boolean).join('، ');

        // Determine sibling amount based on billing mode
        let siblingAmount = PRICING.ADDITIONAL_SIBLING; // default semester additional
        if (body.billingMode === 'monthly') {
          siblingAmount = (monthsCount || 1) * PRICING.MONTHLY;
        }

        // Create payment records for all siblings in parallel (within transaction)
        await Promise.all(
          siblingStudents.map((sibling) =>
            tx.payment.create({
              data: {
                studentId: sibling.id,
                amount: siblingAmount,
                paymentDate: new Date(),
                paymentType: 'family',
                periodStart,
                periodEnd,
                monthsCount,
                siblingNames: allSiblingNames,
                siblingStudentId: body.studentId,
                siblingPaymentId: mainPayment.id,
                notes: body.notes || null,
                recordedBy: session.user.id,
                recordedByName: admin?.fullName || 'Unknown',
              },
            })
          )
        );

        // Update main payment's siblingNames to include all
        await tx.payment.update({
          where: { id: mainPayment.id },
          data: { siblingNames: allSiblingNames },
        });
      }

      // Create audit log for payment
      await tx.auditLog.create({
        data: {
          adminId: session.user.id,
          action: 'CREATE',
          entityType: 'Payment',
          entityId: mainPayment.id,
          details: JSON.stringify({
            amount: mainAmount,
            paymentType: body.paymentType || 'single',
            studentName: student.name,
            siblingCount: siblingStudents.length,
          }),
        },
      });

      return mainPayment;
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
