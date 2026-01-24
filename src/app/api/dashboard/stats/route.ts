import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today'; // today, week, month, all

    // Get admin's class times if not super admin
    let adminClassTimes: string[] = [];
    const isSuperAdmin = session.user.role === 'super_admin';
    
    if (!isSuperAdmin) {
      const admin = await prisma.admin.findUnique({
        where: { id: session.user.id },
        select: { assignedClassTimes: true },
      });
      adminClassTimes = admin?.assignedClassTimes?.split(',') || [];
    }

    // Build student filter
    const studentWhere: Record<string, unknown> = { status: 'active' };
    if (!isSuperAdmin && adminClassTimes.length > 0) {
      studentWhere.classTime = { in: adminClassTimes };
    }

    // Get student counts (filtered by admin's classes if not super admin)
    const [totalStudents, maleStudents, femaleStudents] = await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.student.count({ where: { ...studentWhere, gender: 'male' } }),
      prisma.student.count({ where: { ...studentWhere, gender: 'female' } }),
    ]);

    // Date calculations - Using Iraq Time (GMT+3)
    // We create a date that represents "now" in current region
    const now = new Date();
    // Move to Iraq time offset (simplified)
    const iraqOffset = 3; 
    const iraqNow = new Date(now.getTime() + (iraqOffset * 60 * 60 * 1000));
    
    // Get the start of today in Iraq time
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Explicitly set to midnight to avoid any trailing hours
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    // Build payment date filter based on period
    let dateFilter: Record<string, Date> = {};
    switch (period) {
      case 'today':
        dateFilter = { gte: todayStart, lt: todayEnd };
        break;
      case 'week':
        dateFilter = { gte: weekStart, lt: todayEnd };
        break;
      case 'month':
        dateFilter = { gte: monthStart, lt: todayEnd };
        break;
      case 'all':
      default:
        // No date filter
        break;
    }

    // Get today's payments for current admin
    let todayPayments = [] as any[];

    if (isSuperAdmin) {
      // Super admin: all root payments for today
      const todayPaymentsWhere: Record<string, any> = {
        paymentDate: { gte: todayStart, lt: todayEnd },
        voided: false,
        siblingPaymentId: null, // only root payments
      };

      todayPayments = await prisma.payment.findMany({
        where: todayPaymentsWhere,
        include: { student: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Normal admin: include root payments where primary student is in admin classes,
      // or any sibling (child payment) student is in admin classes, or payments recorded by admin
      const rootPayments = await prisma.payment.findMany({
        where: {
          paymentDate: { gte: todayStart, lt: todayEnd },
          voided: false,
          siblingPaymentId: null,
        },
        include: { student: true },
        orderBy: { createdAt: 'desc' },
      });

      // Fetch child payments in the same date range to detect family payments with siblings in admin classes
      const childPayments = await prisma.payment.findMany({
        where: {
          paymentDate: { gte: todayStart, lt: todayEnd },
          voided: false,
          siblingPaymentId: { not: null },
        },
        include: { student: true },
      });

      todayPayments = rootPayments.filter((p) => {
        // recorded by admin
        if (p.recordedBy === session.user.id) return true;
        // primary student class in admin classes
        if (adminClassTimes.length > 0 && p.student?.classTime && adminClassTimes.includes(p.student.classTime)) return true;
        // any child payment having a student in admin classes
        const childMatch = childPayments.find((cp) => cp.siblingPaymentId === p.id && cp.student?.classTime && adminClassTimes.includes(cp.student.classTime));
        return Boolean(childMatch);
      });
    }

    const todayAmount = todayPayments.reduce((sum, p) => sum + p.amount, 0);

    // Get unpaid students count (for admin's classes)
    const semesterStart = new Date('2026-01-01');
    const allStudents = await prisma.student.findMany({
      where: studentWhere,
      include: {
        payments: {
          where: { voided: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const unpaidStudents = allStudents.filter(s => {
      const latestPayment = s.payments[0];
      if (!latestPayment) return true;
      return new Date(latestPayment.periodEnd) < semesterStart;
    }).length;

    // Get recent payments
    let recentPayments = [] as any[];

    if (isSuperAdmin) {
      const recentPaymentsWhere: Record<string, any> = { voided: false, siblingPaymentId: null };
      recentPayments = await prisma.payment.findMany({
        where: recentPaymentsWhere,
        include: { student: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    } else {
      // For normal admin, fetch recent root payments and child payments in a reasonable window and filter
      const rootRecent = await prisma.payment.findMany({
        where: { voided: false, siblingPaymentId: null },
        include: { student: true },
        orderBy: { createdAt: 'desc' },
        take: 50, // fetch more to filter down to 5 relevant
      });

      const rootIds = rootRecent.map(r => r.id);
      const recentChild = await prisma.payment.findMany({
        where: { siblingPaymentId: { in: rootIds }, voided: false },
        include: { student: true },
      });

      const filtered = rootRecent.filter((p) => {
        if (p.recordedBy === session.user.id) return true;
        if (adminClassTimes.length > 0 && p.student?.classTime && adminClassTimes.includes(p.student.classTime)) return true;
        const childMatch = recentChild.find(cp => cp.siblingPaymentId === p.id && cp.student?.classTime && adminClassTimes.includes(cp.student.classTime));
        return Boolean(childMatch);
      });

      recentPayments = filtered.slice(0, 5);
    }

    // For super admin: get collection by admin
    let collectionByAdmin: Array<{ adminId: string; adminName: string; amount: number }> = [];
    if (isSuperAdmin) {
      const adminPayments = await prisma.payment.groupBy({
        by: ['recordedBy'],
        where: {
          paymentDate: { gte: todayStart, lt: todayEnd },
          voided: false,
          siblingPaymentId: null,
        },
        _sum: { amount: true },
      });

      // Get admin names
      const adminIds = adminPayments.map(ap => ap.recordedBy);
      const admins = await prisma.admin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, fullName: true },
      });

      collectionByAdmin = adminPayments.map(ap => ({
        adminId: ap.recordedBy,
        adminName: admins.find(a => a.id === ap.recordedBy)?.fullName || 'Unknown',
        amount: ap._sum.amount || 0,
      }));
    }

    // Period collection for super admin
    let periodCollection = 0;
    if (isSuperAdmin && period !== 'today') {
      const periodPayments = await prisma.payment.aggregate({
        where: {
          paymentDate: dateFilter,
          voided: false,
          siblingPaymentId: null, // Avoid double-counting siblings in totals
        },
        _sum: { amount: true },
      });
      periodCollection = periodPayments._sum.amount || 0;
    }

    // Get sibling/family payments statistics
    const siblingPayments = await prisma.payment.findMany({
      where: {
        paymentType: 'family',
        voided: false,
        paymentDate: { gte: todayStart, lt: todayEnd },
        siblingPaymentId: null, // Only count root payment to avoid double counting siblings
      },
      include: { student: true },
      orderBy: { createdAt: 'desc' },
    });

    const siblingPaymentsCount = siblingPayments.length;
    const siblingPaymentsAmount = siblingPayments.reduce((sum, p) => sum + p.amount, 0);

    // Today's all transactions for display
    const todayAllTransactions = await prisma.payment.findMany({
      where: {
        paymentDate: { gte: todayStart, lt: todayEnd },
        voided: false,
        siblingPaymentId: null, // Only show root payments in general list
      },
      include: { student: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      // Basic stats
      totalStudents,
      maleStudents,
      femaleStudents,
      unpaidStudents,
      
      // Today's collection (admin sees their own, super admin sees all)
      todayPayments: todayPayments.length,
      todayAmount,
      
      // Today's transactions list
      todayTransactions: todayAllTransactions.map(p => ({
        id: p.id,
        amount: p.amount,
        studentName: p.student.name,
        paymentDate: p.paymentDate.toISOString(),
        paymentType: p.paymentType,
        siblingNames: p.siblingNames,
        recordedByName: p.recordedByName,
      })),
      
      // Sibling payments stats
      siblingPaymentsCount,
      siblingPaymentsAmount,
      
      // Recent payments
      recentPayments: recentPayments.map(p => ({
        id: p.id,
        amount: p.amount,
        studentName: p.student.name,
        paymentDate: p.paymentDate.toISOString(),
        paymentType: p.paymentType,
        recordedByName: p.recordedByName,
      })),
      
      // Super admin only
      collectionByAdmin: isSuperAdmin ? collectionByAdmin : undefined,
      periodCollection: isSuperAdmin ? periodCollection : undefined,
      
      // Admin info
      isSuperAdmin,
      adminClassTimes,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
