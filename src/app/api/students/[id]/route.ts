import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/api-utils';
import { normalizeText } from '@/lib/text-utils';

/**
 * GET /api/students/[id] - Get a single student
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        payments: {
          where: { voided: false },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (error) {
    console.error('Error fetching student:', error);
    return NextResponse.json(
      { error: 'Failed to fetch student' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/students/[id] - Update a student
 * Authorization: Super admin can update any student
 *               Regular admin can only update students in their assigned class times
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the student to check authorization
    const existingStudent = await prisma.student.findUnique({
      where: { id: params.id },
    });

    if (!existingStudent) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Check authorization for non-super admins
    if (session.user.role !== 'super_admin') {
      const admin = await prisma.admin.findUnique({
        where: { id: session.user.id },
        select: { assignedClassTimes: true, assignedGender: true },
      } as any);
      
      const adminClassTimes = admin?.assignedClassTimes?.split(',').filter(Boolean) || [];
      const adminGender = (admin as any)?.assignedGender || '';
      
      // Admin can only update students in their assigned class times
      if (adminClassTimes.length > 0 && existingStudent.classTime) {
        if (!adminClassTimes.includes(existingStudent.classTime)) {
          return NextResponse.json(
            { error: 'You can only update students in your assigned classes' },
            { status: 403 }
          );
        }
      }
      if (adminGender && existingStudent.gender !== adminGender) {
        return NextResponse.json(
          { error: 'You can only update students in your assigned gender' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();

    // Only include fields that are explicitly provided in the request
    // This prevents clearing fields when only updating isForgiven
    const updateData: Record<string, unknown> = {};
    
    if (body.name !== undefined) {
      updateData.name = body.name;
      updateData.nameNormalized = normalizeText(body.name);
    }
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.birthYear !== undefined) updateData.birthYear = body.birthYear || null;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.financialStatus !== undefined) updateData.financialStatus = body.financialStatus || null;
    if (body.classTime !== undefined) updateData.classTime = body.classTime || null;
    if (body.classGroup !== undefined) updateData.classGroup = body.classGroup || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    if (body.status !== undefined) updateData.status = body.status || 'active';
    if (body.isForgiven !== undefined) updateData.isForgiven = body.isForgiven;
    if (body.billingPreference !== undefined) updateData.billingPreference = body.billingPreference;

    const student = await prisma.student.update({
      where: { id: params.id },
      data: updateData,
    });

    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      entityType: 'Student',
      entityId: student.id,
      details: {
        changes: body,
        previousClassTime: existingStudent.classTime,
        newClassTime: body.classTime,
      },
    });

    return NextResponse.json(student);
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json(
      { error: 'Failed to update student' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/students/[id] - Delete a student
 * Authorization: Only super admin can delete students
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super admin can delete students
    if (session.user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only super admins can delete students' },
        { status: 403 }
      );
    }

    // Get student info for audit log before deletion
    const student = await prisma.student.findUnique({
      where: { id: params.id },
      select: { name: true, classTime: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // Delete student (payments will cascade delete due to schema)
    await prisma.student.delete({
      where: { id: params.id },
    });

    // Create audit log
    await createAuditLog({
      action: 'DELETE',
      entityType: 'Student',
      entityId: params.id,
      details: {
        studentName: student.name,
        classTime: student.classTime,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json(
      { error: 'Failed to delete student' },
      { status: 500 }
    );
  }
}
