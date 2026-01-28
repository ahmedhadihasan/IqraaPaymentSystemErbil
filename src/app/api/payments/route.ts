import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { normalizeText, createSearchPattern } from '@/lib/text-utils';
import { PRICING, calculateFamilyTotal, getFamilyPaymentBreakdown, SEMESTER } from '@/lib/billing';

const addMonthsSafe = (date: Date, months: number) => {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
};

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
    const classTime = searchParams.get('classTime') || '';
    const period = searchParams.get('period') || '';
    const startDate = searchParams.get('startDate') || searchParams.get('from') || '';
    const endDate = searchParams.get('endDate') || searchParams.get('to') || '';
    const today = searchParams.get('today') === 'true' || period === 'today';

    const where: Record<string, unknown> = {
      voided: false,
    };

    const typeFilters = type.split(',').map(t => t.trim()).filter(Boolean);
    if (typeFilters.length > 0) {
      where.paymentType = { in: typeFilters };
    }

    if (adminId) {
      where.recordedBy = adminId;
    }

    const now = new Date();

    // Date filtering
    if (today) {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);
      where.paymentDate = { gte: todayStart, lt: todayEnd };
    } else if (period === 'week') {
      const day = now.getDay();
      const diffToSat = (day + 1) % 7; 
      const sat = new Date(now);
      sat.setHours(0, 0, 0, 0);
      sat.setDate(sat.getDate() - diffToSat);
      const fri = new Date(sat);
      fri.setDate(sat.getDate() + 6);
      fri.setHours(23, 59, 59, 999);
      where.paymentDate = { gte: sat, lte: fri };
    } else if (period === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      lastDay.setHours(23, 59, 59, 999);
      where.paymentDate = { gte: firstDay, lte: lastDay };
    } else if (period === 'custom' && startDate && endDate) {
      where.paymentDate = {
        gte: new Date(startDate),
        lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    } else if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) (where.paymentDate as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.paymentDate as Record<string, Date>).lte = new Date(endDate);
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
      const adminRecord = await prisma.admin.findUnique({ 
        where: { id: session.user.id }, 
        select: { assignedClassTimes: true, assignedGender: true } 
      } as any);
      const adminClassTimes = adminRecord?.assignedClassTimes?.split(',').filter(Boolean) || [];
      const adminGender = (adminRecord as any)?.assignedGender || '';

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
        if (
          adminClassTimes.length > 0 && 
          p.student?.classTime && 
          adminClassTimes.includes(p.student.classTime) &&
          (!adminGender || (p.student?.gender && adminGender === p.student.gender))
        ) return true;
        // Check child payments linked to this root
        const childMatch = childPayments.find(cp => 
          cp.siblingPaymentId === p.id && 
          cp.student?.classTime && 
          adminClassTimes.includes(cp.student.classTime) &&
          (!adminGender || (cp.student?.gender && adminGender === cp.student.gender))
        );
        return Boolean(childMatch);
      }).slice(0, 200);
    }

    const classTimeFilters = classTime.split(',').map(t => t.trim()).filter(Boolean);

    // Filter by student name if search provided (with Arabic/Kurdish normalization)
    let filteredPayments = payments;
    if (search) {
      const normalizedSearch = normalizeText(search.toLowerCase());
      filteredPayments = payments.filter(p => {
        const normalizedName = normalizeText(p.student.name.toLowerCase());
        if (normalizedName.includes(normalizedSearch)) return true;
        if (p.siblingNames) {
          const normalizedSiblings = normalizeText(p.siblingNames.toLowerCase());
          if (normalizedSiblings.includes(normalizedSearch)) return true;
        }
        try {
          const pattern = createSearchPattern(normalizedSearch);
          const regex = new RegExp(pattern, 'i');
          if (regex.test(normalizedName)) return true;
          if (p.siblingNames) return regex.test(normalizeText(p.siblingNames.toLowerCase()));
          return false;
        } catch {
          return false;
        }
      });
    }

    let rootIds = filteredPayments.map(p => p.id);
    const childPaymentsAll = rootIds.length > 0
      ? await prisma.payment.findMany({
          where: { siblingPaymentId: { in: rootIds }, voided: false },
          select: { siblingPaymentId: true, amount: true, student: { select: { classTime: true } } },
        })
      : [];

    if (classTimeFilters.length > 0) {
      const childClassMatch = childPaymentsAll.reduce((acc, child) => {
        const childClass = child.student?.classTime || '';
        if (childClass && classTimeFilters.includes(childClass)) {
          acc.add(child.siblingPaymentId as string);
        }
        return acc;
      }, new Set<string>());

      filteredPayments = filteredPayments.filter(p => {
        if (p.student?.classTime && classTimeFilters.includes(p.student.classTime)) return true;
        return childClassMatch.has(p.id);
      });
    }

    const filteredRootIdSet = new Set(filteredPayments.map(p => p.id));
    const childPayments = childPaymentsAll.filter(child => filteredRootIdSet.has(child.siblingPaymentId as string));
    const childTotals = childPayments.reduce((acc, child) => {
      const key = child.siblingPaymentId as string;
      acc.set(key, (acc.get(key) || 0) + child.amount);
      return acc;
    }, new Map<string, number>());

    // Map to response format
    const result = filteredPayments.map(p => ({
      id: p.id,
      studentId: p.studentId,
      amount: p.amount + (childTotals.get(p.id) || 0),
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

    const totalAmount = result.reduce((sum, p) => sum + p.amount, 0);

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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body.studentId || body.amount === undefined) {
      return NextResponse.json(
        { error: 'Student and amount are required' },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { id: body.studentId },
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { id: session.user.id },
      select: { fullName: true },
    });

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin account not found. Please logout and login again.' },
        { status: 401 }
      );
    }

    const billingMode = body.billingMode || 'semester';
    const monthsCount = typeof body.monthsCount === 'number' 
      ? body.monthsCount 
      : parseInt(body.monthsCount || '0', 10) || (billingMode === 'monthly' ? 0 : 6);

    if (billingMode === 'monthly' && monthsCount <= 0) {
      return NextResponse.json(
        { error: 'Months count is required for monthly payments' },
        { status: 400 }
      );
    }

    const now = new Date();
    const periodStart = body.periodStart
      ? new Date(body.periodStart)
      : (billingMode === 'monthly' ? now : SEMESTER.START);

    const periodEnd = body.periodEnd
      ? new Date(body.periodEnd)
      : (billingMode === 'monthly' ? addMonthsSafe(periodStart, monthsCount || 1) : SEMESTER.END);

    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    const siblingIds: string[] = body.siblingStudentIds || [];
    const totalStudents = 1 + siblingIds.length;

    const paymentCheckIds = [body.studentId, ...siblingIds].filter(Boolean);
    const recentPayments = await prisma.payment.findMany({
      where: { studentId: { in: paymentCheckIds }, voided: false },
      orderBy: { periodEnd: 'desc' },
    });

    const latestByStudent = new Map<string, (typeof recentPayments)[number]>();
    for (const payment of recentPayments) {
      if (!latestByStudent.has(payment.studentId)) {
        latestByStudent.set(payment.studentId, payment);
      }
    }

    const blockedIds = paymentCheckIds.filter((id) => {
      const latest = latestByStudent.get(id);
      return latest && latest.periodEnd && new Date(latest.periodEnd) >= now;
    });

    if (blockedIds.length > 0) {
      const blockedStudents = await prisma.student.findMany({
        where: { id: { in: blockedIds } },
        select: { name: true },
      });
      return NextResponse.json(
        { error: 'بەشداریکردن هێشتا کاریگەرە', details: blockedStudents.map(s => s.name).join('، ') },
        { status: 400 }
      );
    }

    // Compute amounts distribution
    let mainAmount = 0;
    let siblingAmounts: number[] = [];
    const totalAmountInput = Number(body.amount);

    if (body.paymentType === 'family' && siblingIds.length > 0) {
      // We need to distribute the total amount among students
      // If amount is not provided, calculate standard total first
      let totalAmount = totalAmountInput;
      
      if (!totalAmount) {
        if (billingMode === 'monthly') {
          totalAmount = (monthsCount || 1) * PRICING.MONTHLY * totalStudents;
        } else {
          totalAmount = calculateFamilyTotal(totalStudents);
        }
      }

      // Distribute
      if (billingMode === 'monthly') {
        // Even distribution for monthly
        const perStudent = Math.floor(totalAmount / totalStudents);
        mainAmount = perStudent + (totalAmount % totalStudents);
        siblingAmounts = Array(siblingIds.length).fill(perStudent);
      } else {
        // Semester distribution (proportional to standard pricing)
        const standardBreakdown = getFamilyPaymentBreakdown(totalStudents);
        const standardTotal = standardBreakdown.reduce((a: number, b: number) => a + b, 0);
        
        if (standardTotal === 0) {
           mainAmount = totalAmount;
           siblingAmounts = Array(siblingIds.length).fill(0);
        } else {
           // Proportional
           mainAmount = Math.round((standardBreakdown[0] / standardTotal) * totalAmount);
           let distributed = mainAmount;
           
           for (let i = 0; i < siblingIds.length; i++) {
              if (i === siblingIds.length - 1) {
                 siblingAmounts.push(totalAmount - distributed);
              } else {
                 const share = Math.round((standardBreakdown[i+1] / standardTotal) * totalAmount);
                 siblingAmounts.push(share);
                 distributed += share;
              }
           }
        }
      }
    } else {
      // Single student
      mainAmount = totalAmountInput;
      if (!mainAmount) {
        if (billingMode === 'monthly') {
           mainAmount = (monthsCount || 1) * PRICING.MONTHLY;
        } else {
           mainAmount = PRICING.SINGLE_STUDENT;
        }
      }
    }

    let siblingStudents: { id: string; name: string }[] = [];
    if (body.paymentType === 'family' && siblingIds.length > 0) {
      siblingStudents = await prisma.student.findMany({
        where: { id: { in: siblingIds } },
        select: { id: true, name: true },
      });
    }

    const payment = await prisma.$transaction(async (tx) => {
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

      if (body.paymentType === 'family' && siblingStudents.length > 0) {
        const allSiblingNames = [student.name, ...siblingStudents.map(s => s.name)].filter(Boolean).join('، ');

        await Promise.all(
          siblingStudents.map((sibling, index) =>
            tx.payment.create({
              data: {
                studentId: sibling.id,
                amount: siblingAmounts[index] || 0,
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

        await tx.payment.update({
          where: { id: mainPayment.id },
          data: { siblingNames: allSiblingNames },
        });
      }

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
