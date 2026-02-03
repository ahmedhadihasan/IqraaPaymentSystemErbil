import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { normalizeText, createSearchPattern } from '@/lib/text-utils';
import { SEMESTER } from '@/lib/billing';
import { createAuditLog } from '@/lib/api-utils';

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
    const billingPreference = searchParams.get('billingPreference') || '';
    const myStudentsOnly = searchParams.get('myStudents') === 'true';
    const unpaidOnly = searchParams.get('unpaid') === 'true';
    const forTransaction = searchParams.get('forTransaction') === 'true';
    const forgivenOnly = searchParams.get('forgiven') === 'true';
    const myForgivenOnly = searchParams.get('myForgiven') === 'true';

    // Get admin's assigned class times
    let adminClassTimes: string[] = [];
    let adminGender = '';
    const isSuperAdmin = session.user.role === 'super_admin';
    
    // Get admin info for regular admins
    if (!isSuperAdmin) {
      const admin = await prisma.admin.findUnique({
        where: { id: session.user.id },
        select: { assignedClassTimes: true, assignedGender: true },
      } as any);
      adminClassTimes = (admin?.assignedClassTimes || (admin as any)?.assigned_class_times || '')
        .split(',').filter(Boolean) || [];
      adminGender = (admin as any)?.assignedGender || (admin as any)?.assigned_gender || '';
    }

    const where: Record<string, unknown> = {};
    
    if (status) where.status = status;
    if (gender) where.gender = gender;
    if (classTime) where.classTime = classTime;
    // Don't filter by billingPreference in WHERE clause - show all students in search
    // if (billingPreference) where.billingPreference = billingPreference;
    
    // Filter for forgiven students
    if (forgivenOnly) {
      where.isForgiven = true;
    }
    
    // For myForgiven, filter by admin's gender only (not class time, since forgiven students may have no class)
    if (myForgivenOnly && !isSuperAdmin) {
      where.isForgiven = true;
      if (adminGender) {
        where.gender = adminGender;
      }
      // Optionally also include students in admin's class times
      // This allows admin to see forgiven students that are either in their class OR match their gender
    }
    // Filter by admin's class times (for regular myStudents filter, not forgiven)
    else if (myStudentsOnly && !isSuperAdmin) {
      if (adminClassTimes.length > 0) {
        where.classTime = { in: adminClassTimes };
      } else {
        // If no classes assigned, return no students
        where.classTime = 'none_assigned';
      }
      
      if (adminGender) {
        where.gender = adminGender;
      }
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
      const semesterStart = SEMESTER.START;
      students = students.filter(student => {
        const latestPayment = student.payments[0];
        if (!latestPayment) return true;
        return new Date(latestPayment.periodEnd) < semesterStart;
      });
    }

    // Filter forgiven students - for non-super admins, only show forgiven students in their assigned classes
    // For search/transaction purposes, show students but hide names of forgiven students not in admin's classes
    let processedStudents = students;
    
    if (!isSuperAdmin && !forTransaction) {
      // When NOT searching for transaction, hide forgiven students not in admin's classes
      processedStudents = students.filter(student => {
        if (!(student as any).isForgiven) return true;
        
        // If forgiven, check if in admin's assigned classes
        if (adminClassTimes.length > 0 && !adminClassTimes.includes(student.classTime || '')) {
          return false;
        }
        if (adminGender && student.gender !== adminGender) {
          return false;
        }
        return true;
      });
    }

    // Remove payments from response for cleaner data
    const cleanStudents = processedStudents.map(({ payments, ...student }) => {
      const isForgiven = (student as any).isForgiven;
      
      // For forgiven students not in admin's classes during transaction search, hide sensitive info
      let shouldHideName = false;
      if (forTransaction && !isSuperAdmin && isForgiven) {
        const notInAdminClass = adminClassTimes.length > 0 && !adminClassTimes.includes(student.classTime || '');
        const notInAdminGender = Boolean(adminGender) && student.gender !== adminGender;
        shouldHideName = notInAdminClass || notInAdminGender;
      }
      
      return {
        ...student,
        name: shouldHideName ? '*** (قوتابیی لێخۆشبوو)' : student.name,
        hasPaid: payments.length > 0 && new Date(payments[0]?.periodEnd || 0) >= SEMESTER.START,
        billingPreference: (student as any).billingPreference || 'semester',
        isHidden: shouldHideName,
      };
    });

    // For forTransaction, filter out hidden forgiven students entirely
    const finalStudents = forTransaction && !isSuperAdmin 
      ? cleanStudents.filter(s => !s.isHidden)
      : cleanStudents;

    return NextResponse.json(finalStudents);
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
        billingPreference: body.billingPreference || 'semester',
      },
    });

    // Create audit log for student creation
    await createAuditLog({
      action: 'CREATE',
      entityType: 'Student',
      entityId: student.id,
      details: {
        name: student.name,
        gender: student.gender,
        classTime: student.classTime,
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
