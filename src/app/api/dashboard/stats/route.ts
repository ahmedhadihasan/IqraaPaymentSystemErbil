import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today';
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');

    const isSuperAdmin = session.user.role === 'super_admin';
    let adminClassTimes: string[] = [];
    let adminGender = '';
    
    if (!isSuperAdmin) {
      const admin = await prisma.admin.findUnique({
        where: { id: session.user.id },
        select: { assignedClassTimes: true, assignedGender: true },
      } as any);
      adminClassTimes = admin?.assignedClassTimes?.split(',') || [];
      adminGender = (admin as any)?.assignedGender || '';
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Build period filter
    let dateFilter: Record<string, Date> = {};
    if (period === 'custom' && startParam && endParam) {
      dateFilter = { 
        gte: new Date(startParam), 
        lte: new Date(new Date(endParam).setHours(23, 59, 59, 999)) 
      };
    } else {
      switch (period) {
        case 'today':
          dateFilter = { gte: todayStart, lt: todayEnd };
          break;
        case 'week': {
          // Saturday to Friday
          const day = now.getDay();
          const diffToSat = (day + 1) % 7; 
          const sat = new Date(todayStart);
          sat.setDate(todayStart.getDate() - diffToSat);
          const fri = new Date(sat);
          fri.setDate(sat.getDate() + 6);
          fri.setHours(23, 59, 59, 999);
          dateFilter = { gte: sat, lte: fri };
          break;
        }
        case 'month': {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          lastDay.setHours(23, 59, 59, 999);
          dateFilter = { gte: firstDay, lte: lastDay };
          break;
        }
        case 'all':
        default:
          break;
      }
    }

    // Student counts
    const studentWhere: Record<string, any> = { status: 'active' };
    if (!isSuperAdmin && adminClassTimes.length > 0) {
      studentWhere.classTime = { in: adminClassTimes };
    }
    if (!isSuperAdmin && adminGender) {
      studentWhere.gender = adminGender;
    }

    const [totalStudents, maleStudents, femaleStudents] = await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.student.count({ where: { ...studentWhere, gender: 'male' } }),
      prisma.student.count({ where: { ...studentWhere, gender: 'female' } }),
    ]);

    // Revenue Split (Student vs Books)
    // For admins, filter by their assigned classes
    let collectionsWhere: Record<string, any> = {
      paymentDate: dateFilter,
      voided: false,
    };
    
    // Build student filter for admin's classes
    if (!isSuperAdmin && (adminClassTimes.length > 0 || adminGender)) {
      collectionsWhere.student = {};
      if (adminClassTimes.length > 0) {
        collectionsWhere.student.classTime = { in: adminClassTimes };
      }
      if (adminGender) {
        collectionsWhere.student.gender = adminGender;
      }
    }

    const collections = await prisma.payment.findMany({
      where: collectionsWhere,
      select: { amount: true, paymentType: true },
    });

    const studentCollection = collections
      .filter(p => p.paymentType !== 'book')
      .reduce((sum, p) => sum + p.amount, 0);
    const bookCollection = collections
      .filter(p => p.paymentType === 'book')
      .reduce((sum, p) => sum + p.amount, 0);

    const todayPaymentsWhere: Record<string, any> = {
      paymentDate: { gte: todayStart, lt: todayEnd },
      voided: false,
    };

    let todayPaymentsAll = await prisma.payment.findMany({
      where: todayPaymentsWhere,
      include: { student: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!isSuperAdmin) {
      todayPaymentsAll = todayPaymentsAll.filter(p => {
        if (p.recordedBy === session.user.id) return true;
        if (
          p.student?.classTime && 
          adminClassTimes.includes(p.student.classTime) &&
          (!adminGender || (p.student?.gender && p.student.gender === adminGender))
        ) return true;
        return false;
      });
    }

    const todayAmountTotal = todayPaymentsAll.reduce((sum, p) => sum + p.amount, 0);
    
    // When period is 'today', use the same calculation as todayAmountTotal for consistency
    // This ensures کۆکراوەی ئەمڕۆ and کۆکراوەی گشتی (ئەمڕۆ) show the same value
    let finalStudentCollection = studentCollection;
    let finalBookCollection = bookCollection;
    
    if (period === 'today') {
      finalStudentCollection = todayPaymentsAll
        .filter(p => p.paymentType !== 'book')
        .reduce((sum, p) => sum + p.amount, 0);
      finalBookCollection = todayPaymentsAll
        .filter(p => p.paymentType === 'book')
        .reduce((sum, p) => sum + p.amount, 0);
    }
    
    const todayPaymentsCount = todayPaymentsAll.length;
    const todayTransactions = todayPaymentsAll.filter(p => p.siblingPaymentId === null);
    const todayRootIds = todayTransactions.map(p => p.id);
    const todayChildren = todayRootIds.length > 0
      ? await prisma.payment.findMany({
          where: { siblingPaymentId: { in: todayRootIds }, voided: false },
          select: { siblingPaymentId: true, amount: true },
        })
      : [];
    const todayChildTotals = todayChildren.reduce((acc, child) => {
      const key = child.siblingPaymentId as string;
      acc.set(key, (acc.get(key) || 0) + child.amount);
      return acc;
    }, new Map<string, number>());

    // Unpaid students
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

    // Recent Payments
    let recentPayments = await prisma.payment.findMany({
      where: { voided: false, siblingPaymentId: null },
      include: { student: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    if (!isSuperAdmin) {
      recentPayments = recentPayments.filter(p => {
        if (p.recordedBy === session.user.id) return true;
        if (
          p.student?.classTime && 
          adminClassTimes.includes(p.student.classTime) &&
          (!adminGender || (p.student?.gender && p.student.gender === adminGender))
        ) return true;
        return false;
      });
    }
    recentPayments = recentPayments.slice(0, 5);
    const recentRootIds = recentPayments.map(p => p.id);
    const recentChildren = recentRootIds.length > 0
      ? await prisma.payment.findMany({
          where: { siblingPaymentId: { in: recentRootIds }, voided: false },
          select: { siblingPaymentId: true, amount: true },
        })
      : [];
    const recentChildTotals = recentChildren.reduce((acc, child) => {
      const key = child.siblingPaymentId as string;
      acc.set(key, (acc.get(key) || 0) + child.amount);
      return acc;
    }, new Map<string, number>());

    // Collection by Admin (Super Admin only)
    let collectionByAdmin: any[] = [];
    if (isSuperAdmin) {
      const adminPayments = await prisma.payment.groupBy({
        by: ['recordedBy'],
        where: {
          paymentDate: dateFilter,
          voided: false,
        },
        _sum: { amount: true },
      });

      const admins = await prisma.admin.findMany({
        where: { id: { in: adminPayments.map(ap => ap.recordedBy) } },
        select: { id: true, fullName: true },
      });

      collectionByAdmin = adminPayments.map(ap => ({
        adminId: ap.recordedBy,
        adminName: admins.find(a => a.id === ap.recordedBy)?.fullName || 'Unknown',
        amount: ap._sum.amount || 0,
      }));
    }

    // Sibling stats (Today)
    const siblingPayments = await prisma.payment.findMany({
      where: {
        paymentType: 'family',
        voided: false,
        paymentDate: { gte: todayStart, lt: todayEnd },
      },
    });

    return NextResponse.json({
      totalStudents,
      maleStudents,
      femaleStudents,
      unpaidStudents,
      todayPayments: todayPaymentsCount,
      todayAmount: todayAmountTotal,
      todayTransactions: todayTransactions.map(p => ({
        id: p.id,
        amount: p.amount + (todayChildTotals.get(p.id) || 0),
        studentName: p.student.name,
        paymentDate: p.paymentDate.toISOString(),
        paymentType: p.paymentType,
        siblingNames: p.siblingNames,
        recordedByName: p.recordedByName,
      })),
      siblingPaymentsCount: siblingPayments.length,
      siblingPaymentsAmount: siblingPayments.reduce((sum, p) => sum + p.amount, 0),
      recentPayments: recentPayments.map(p => ({
        id: p.id,
        amount: p.amount + (recentChildTotals.get(p.id) || 0),
        studentName: p.student.name,
        paymentDate: p.paymentDate.toISOString(),
        paymentType: p.paymentType,
        recordedByName: p.recordedByName,
      })),
      collectionByAdmin: isSuperAdmin ? collectionByAdmin : undefined,
      periodCollection: finalStudentCollection + finalBookCollection,
      studentCollection: finalStudentCollection,
      bookCollection: finalBookCollection,
      isSuperAdmin,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
