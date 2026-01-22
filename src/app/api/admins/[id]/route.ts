import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';

/**
 * GET /api/admins/[id] - Get single admin
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        assignedClassTimes: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    return NextResponse.json(admin);
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Check if admin exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { id: params.id },
    });

    if (!existingAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
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
    
    // Hash new password if provided
    if (body.password) {
      updateData.passwordHash = await hash(body.password, 12);
    }

    const admin = await prisma.admin.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        assignedClassTimes: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    return NextResponse.json(admin);
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
