import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';

/**
 * GET /api/admins - List all admins (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admins = await prisma.admin.findMany({
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
      orderBy: { createdAt: 'asc' },
    });

    // Get today's collection for each admin
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const adminPayments = await prisma.payment.groupBy({
      by: ['recordedBy'],
      where: {
        paymentDate: { gte: todayStart, lte: todayEnd },
        voided: false,
      },
      _sum: { amount: true },
    });

    const adminsWithCollection = admins.map(admin => ({
      ...admin,
      todayCollection: adminPayments.find(ap => ap.recordedBy === admin.id)?._sum.amount || 0,
    }));

    return NextResponse.json(adminsWithCollection);
  } catch (error) {
    console.error('Error fetching admins:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admins' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admins - Create a new admin (super admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.email || !body.password || !body.fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.admin.findUnique({
      where: { email: body.email },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hash(body.password, 12);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email: body.email,
        passwordHash,
        fullName: body.fullName,
        role: body.role || 'admin',
        assignedClassTimes: body.assignedClassTimes || null,
        createdBy: session.user.id,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        assignedClassTimes: true,
        createdAt: true,
      },
    });

    return NextResponse.json(admin, { status: 201 });
  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json(
      { error: 'Failed to create admin' },
      { status: 500 }
    );
  }
}
