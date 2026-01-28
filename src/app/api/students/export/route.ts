import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ku } from '@/lib/translations';
import { SEMESTER } from '@/lib/billing';

export const dynamic = 'force-dynamic';

/**
 * GET /api/students/export - Export students as CSV
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId'); // Single student
    const classTime = searchParams.get('classTime');
    const myStudentsOnly = searchParams.get('myStudents') === 'true';

    // Get admin's class times if needed
    let adminClassTimes: string[] = [];
    let adminGender = '';
    if (myStudentsOnly && session.user.role !== 'super_admin') {
      const admin = await prisma.admin.findUnique({
        where: { id: session.user.id },
        select: { assignedClassTimes: true, assignedGender: true },
      } as any);
      adminClassTimes = admin?.assignedClassTimes?.split(',') || [];
      adminGender = (admin as any)?.assignedGender || '';
    }

    // Build filter
    const where: Record<string, unknown> = { status: 'active' };
    if (studentId) {
      where.id = studentId;
    } else {
      if (classTime) where.classTime = classTime;
      if (myStudentsOnly && adminClassTimes.length > 0) {
        where.classTime = { in: adminClassTimes };
      }
      if (myStudentsOnly && adminGender) {
        where.gender = adminGender;
      }
    }

    // Get students with their payments
    const students = await prisma.student.findMany({
      where,
      include: {
        payments: {
          where: { voided: false },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Class time translations
    const classTimeLabels: Record<string, string> = {
      saturday_morning: ku.classTimes.saturday_morning,
      saturday_evening: ku.classTimes.saturday_evening,
      saturday_night: ku.classTimes.saturday_night,
      monday_evening: ku.classTimes.monday_evening,
      tuesday_night: ku.classTimes.tuesday_night,
      wednesday_evening: ku.classTimes.wednesday_evening,
      wednesday_night: ku.classTimes.wednesday_night,
      thursday_night: ku.classTimes.thursday_night,
    };

    // Format date
    const formatDate = (d: Date | null) => {
      if (!d) return '';
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    // Build CSV content
    const headers = [
      ku.students.name,
      ku.students.gender,
      ku.students.birthYear,
      ku.students.classTime,
      ku.students.phone,
      ku.students.address,
      ku.students.paidStatus,
      ku.payments.amount,
      ku.payments.periodStart,
      ku.payments.periodEnd,
      ku.payments.recordedBy,
    ];

    const rows = students.map(student => {
      const latestPayment = student.payments[0];
      const isPaid = latestPayment && new Date(latestPayment.periodEnd) >= SEMESTER.START;
      
      return [
        student.name,
        student.gender === 'male' ? ku.students.male : ku.students.female,
        student.birthYear || '',
        student.classTime ? classTimeLabels[student.classTime] || student.classTime : '',
        student.phone || '',
        student.address || '',
        isPaid ? ku.students.paidStatus : ku.students.unpaidStatus,
        latestPayment ? latestPayment.amount.toString() : '',
        latestPayment ? formatDate(new Date(latestPayment.periodStart)) : '',
        latestPayment ? formatDate(new Date(latestPayment.periodEnd)) : '',
        latestPayment ? latestPayment.recordedByName || '' : '',
      ];
    });

    // Create CSV with BOM for Excel compatibility
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Return as downloadable CSV
    const filename = studentId 
      ? `student_${students[0]?.name || 'export'}.csv`
      : `students_export_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting students:', error);
    return NextResponse.json(
      { error: 'Failed to export students' },
      { status: 500 }
    );
  }
}
