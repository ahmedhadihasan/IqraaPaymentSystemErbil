import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { CLASS_TIMES, SEMESTER } from '@/lib/billing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only superadmin can access this
    if (session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'semester';
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Build date filter for payments
    let dateFilter: Record<string, Date> | undefined;
    
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
        case 'semester':
        default:
          // Semester from SEMESTER.START to SEMESTER.END
          dateFilter = { gte: SEMESTER.START, lte: SEMESTER.END };
          break;
      }
    }

    // Get all active students with their payments
    const students = await prisma.student.findMany({
      where: { status: 'active' },
      include: {
        payments: {
          where: { 
            voided: false,
            paymentDate: dateFilter,
          },
        },
      },
    });

    // Calculate per-class stats
    const classStats: Record<string, {
      totalStudents: number;
      paidStudents: number;
      unpaidStudents: number;
      forgivenStudents: number;
      totalCollected: number;
    }> = {};

    // Initialize all class times
    CLASS_TIMES.forEach(ct => {
      classStats[ct] = {
        totalStudents: 0,
        paidStudents: 0,
        unpaidStudents: 0,
        forgivenStudents: 0,
        totalCollected: 0,
      };
    });

    // Process students
    students.forEach(student => {
      const ct = student.classTime || 'unknown';
      if (!classStats[ct]) {
        classStats[ct] = {
          totalStudents: 0,
          paidStudents: 0,
          unpaidStudents: 0,
          forgivenStudents: 0,
          totalCollected: 0,
        };
      }

      classStats[ct].totalStudents++;

      if (student.isForgiven) {
        classStats[ct].forgivenStudents++;
      } else {
        // Check if student has any payment in the period
        const hasPayment = student.payments.some(p => p.paymentType !== 'book');
        if (hasPayment) {
          classStats[ct].paidStudents++;
        } else {
          classStats[ct].unpaidStudents++;
        }
      }

      // Sum up collection (exclude book payments for student collection)
      const studentPayments = student.payments.filter(p => p.paymentType !== 'book');
      classStats[ct].totalCollected += studentPayments.reduce((sum, p) => sum + p.amount, 0);
    });

    // Get book collection separately
    const bookPayments = await prisma.payment.findMany({
      where: {
        voided: false,
        paymentType: 'book',
        paymentDate: dateFilter,
      },
    });
    const bookCollection = bookPayments.reduce((sum, p) => sum + p.amount, 0);

    // Get collection by admin
    const allPaymentsInPeriod = await prisma.payment.findMany({
      where: {
        voided: false,
        paymentDate: dateFilter,
      },
      select: {
        amount: true,
        recordedBy: true,
        recordedByName: true,
      },
    });

    // Group payments by admin
    const adminCollectionMap = new Map<string, { name: string; amount: number }>();
    
    for (const payment of allPaymentsInPeriod) {
      const adminId = payment.recordedBy || 'unknown';
      const existing = adminCollectionMap.get(adminId);
      
      if (existing) {
        existing.amount += payment.amount;
      } else {
        // Get admin name from recordedByName field or look it up
        let adminName = payment.recordedByName || 'نەناسراو';
        
        if (!payment.recordedByName && payment.recordedBy) {
          // Look up admin name from database
          const admin = await prisma.admin.findUnique({
            where: { id: payment.recordedBy },
            select: { fullName: true },
          });
          if (admin?.fullName) {
            adminName = admin.fullName;
          }
        }
        
        adminCollectionMap.set(adminId, {
          name: adminName,
          amount: payment.amount,
        });
      }
    }

    // Convert to array and sort by amount
    const collectionByAdmin = Array.from(adminCollectionMap.entries())
      .map(([adminId, data]) => ({
        adminId,
        adminName: data.name,
        amount: data.amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate overall stats
    const overallStats = {
      totalStudents: 0,
      paidStudents: 0,
      unpaidStudents: 0,
      forgivenStudents: 0,
      totalCollected: 0,
      expectedCollection: 0,
    };

    const classesArray = Object.entries(classStats).map(([classTime, stats]) => {
      overallStats.totalStudents += stats.totalStudents;
      overallStats.paidStudents += stats.paidStudents;
      overallStats.unpaidStudents += stats.unpaidStudents;
      overallStats.forgivenStudents += stats.forgivenStudents;
      overallStats.totalCollected += stats.totalCollected;

      return {
        classTime,
        ...stats,
        expectedCollection: 0, // Can calculate based on billing preference if needed
      };
    });

    // Sort by class time
    classesArray.sort((a, b) => {
      const orderA = CLASS_TIMES.indexOf(a.classTime as typeof CLASS_TIMES[number]);
      const orderB = CLASS_TIMES.indexOf(b.classTime as typeof CLASS_TIMES[number]);
      return orderA - orderB;
    });

    return NextResponse.json({
      classes: classesArray,
      overallStats,
      bookCollection,
      collectionByAdmin,
    });
  } catch (error) {
    console.error('Report error:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}
