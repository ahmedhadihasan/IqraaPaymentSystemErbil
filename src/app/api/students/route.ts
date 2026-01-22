import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { normalizeText, createSearchPattern } from '@/lib/text-utils';

/**
 * GET /api/students - List students with filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const gender = searchParams.get('gender') || '';
    const status = searchParams.get('status') || 'active';
    const classTime = searchParams.get('classTime') || '';
    const myStudentsOnly = searchParams.get('myStudents') === 'true';
    const unpaidOnly = searchParams.get('unpaid') === 'true';

    // Get admin's assigned class times if filtering by "my students"
    let adminClassTimes: string[] = [];
    if (myStudentsOnly) {
      if (session.user.role === 'super_admin') {
        // Super admin sees all students in "my students" view
        adminClassTimes = [];
      } else {
        const admin = await prisma.admin.findUnique({
          where: { id: session.user.id },
          select: { assignedClassTimes: true },
        });
        adminClassTimes = admin?.assignedClassTimes?.split(',').filter(Boolean) || [];
      }
    }

    const where: Record<string, unknown> = {};
    
    if (status) where.status = status;
    if (gender) where.gender = gender;
    if (classTime) where.classTime = classTime;
    
    // Filter by admin's class times
    if (myStudentsOnly && adminClassTimes.length > 0) {
      where.classTime = { in: adminClassTimes };
    }

    // Get students
    let students = await prisma.student.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        payments: {
          where: { voided: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Filter by search with Arabic/Kurdish normalization
    if (search) {
      const normalizedSearch = normalizeText(search.toLowerCase());
      students = students.filter(student => {
        const normalizedName = normalizeText(student.name.toLowerCase());
        // Check if normalized name contains normalized search
        if (normalizedName.includes(normalizedSearch)) return true;
        // Also try regex pattern for character variations
        try {
          const pattern = createSearchPattern(normalizedSearch);
          const regex = new RegExp(pattern, 'i');
          return regex.test(normalizedName);
        } catch {
          return false;
        }
      });
    }

    // Filter unpaid students (no payment for current semester)
    if (unpaidOnly) {
      const semesterStart = new Date('2026-01-01');
      students = students.filter(student => {
        const latestPayment = student.payments[0];
        if (!latestPayment) return true;
        return new Date(latestPayment.periodEnd) < semesterStart;
      });
    }

    // Remove payments from response for cleaner data
    const cleanStudents = students.map(({ payments, ...student }) => ({
      ...student,
      hasPaid: payments.length > 0 && new Date(payments[0]?.periodEnd || 0) >= new Date('2026-01-01'),
    }));

    return NextResponse.json(cleanStudents);
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/students - Create a new student
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.name || !body.gender) {
      return NextResponse.json(
        { error: 'Name and gender are required' },
        { status: 400 }
      );
    }

    const student = await prisma.student.create({
      data: {
        name: body.name,
        nameNormalized: normalizeText(body.name),
        gender: body.gender,
        birthYear: body.birthYear || null,
        address: body.address || null,
        phone: body.phone || null,
        financialStatus: body.financialStatus || null,
        classTime: body.classTime || null,
        classGroup: body.classGroup || null,
        joinDate: body.joinDate ? new Date(body.joinDate) : new Date(),
        notes: body.notes || null,
        status: 'active',
      },
    });

    // Create audit log for student creation
    await prisma.auditLog.create({
      data: {
        adminId: session.user.id,
        action: 'CREATE',
        entityType: 'Student',
        entityId: student.id,
        details: JSON.stringify({
          name: student.name,
          gender: student.gender,
          classTime: student.classTime,
        }),
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json(
      { error: 'Failed to create student' },
      { status: 500 }
    );
  }
}

