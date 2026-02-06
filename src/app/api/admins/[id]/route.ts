import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { isSuperAdminRole, canManageAdmins, canViewAdmins } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admins/[id] - Get single admin
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canViewAdmins(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: params.id },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const adminResponse = {
      ...admin,
      fullName: (admin as any).fullName || (admin as any).full_name || 'بێ ناو',
      assignedClassTimes: (admin as any).assignedClassTimes || (admin as any).assigned_class_times || '',
      assignedGender: (admin as any).assignedGender || (admin as any).assigned_gender || null,
    };

    return NextResponse.json(adminResponse);
  } catch (error) {
    console.error('Error fetching admin:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admins/[id] - Update an admin (super admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized - only super admin can edit' }, { status: 401 });
    }

    const body = await request.json();

    // Check if admin exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { id: params.id },
    });

    if (!existingAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if (body.email && body.email !== existingAdmin.email) {
      const emailOwner = await prisma.admin.findUnique({
        where: { email: body.email },
        select: { id: true },
      });
      if (emailOwner) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    // Can't change own role
    if (params.id === session.user.id && body.role && body.role !== existingAdmin.role) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.assignedClassTimes !== undefined) updateData.assignedClassTimes = body.assignedClassTimes;
    if (body.assignedGender !== undefined) updateData.assignedGender = body.assignedGender;
    
    // Hash new password if provided
    if (body.password) {
      updateData.passwordHash = await hash(body.password, 12);
    }

    const admin = await prisma.admin.update({
      where: { id: params.id },
      data: updateData as any,
    });

    const adminResponse = {
      ...admin,
      fullName: (admin as any).fullName || (admin as any).full_name || 'بێ ناو',
      assignedClassTimes: (admin as any).assignedClassTimes || (admin as any).assigned_class_times || '',
      assignedGender: (admin as any).assignedGender || (admin as any).assigned_gender || null,
    };

    return NextResponse.json(adminResponse);
  } catch (error) {
    console.error('Error updating admin:', error);
    return NextResponse.json(
      { error: 'Failed to update admin' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admins/[id] - Delete an admin (super admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized - only super admin can delete' }, { status: 401 });
    }

    // Can't delete yourself
    if (params.id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 400 }
      );
    }

    // Check if admin exists and is not super admin
    const admin = await prisma.admin.findUnique({
      where: { id: params.id },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if (admin.role === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot delete super admin' },
        { status: 400 }
      );
    }

    // Delete admin
    await prisma.admin.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting admin:', error);
    return NextResponse.json(
      { error: 'Failed to delete admin' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admins/[id] - Change own password (any logged-in admin)
 * Requires current password verification
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow admins to change their own password, or super_admin to reset anyone's
    const isSelf = params.id === session.user.id;
    const isSuperAdmin = session.user.role === 'super_admin'; // Only full super_admin can reset others

    if (!isSelf && !isSuperAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'وشەی نهێنی نوێ دەبێت لانیکەم ٦ پیت بێت' },
        { status: 400 }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { id: params.id },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // If changing own password, verify current password
    if (isSelf) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'وشەی نهێنی ئێستا پێویستە' },
          { status: 400 }
        );
      }

      const { compare } = await import('bcryptjs');
      const isCurrentValid = await compare(currentPassword, admin.passwordHash);
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: 'وشەی نهێنی ئێستا هەڵەیە' },
          { status: 400 }
        );
      }
    }

    // Super admin resetting someone else's password doesn't need current password

    const newHash = await hash(newPassword, 12);
    await prisma.admin.update({
      where: { id: params.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({ success: true, message: 'وشەی نهێنی بە سەرکەوتوویی گۆڕدرا' });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'هەڵە لە گۆڕینی وشەی نهێنی' },
      { status: 500 }
    );
  }
}
