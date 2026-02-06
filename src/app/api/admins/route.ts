import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { isSuperAdminRole, canManageAdmins, canViewAdmins } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.enum(['admin', 'admin_view', 'super_admin', 'super_admin_view']).optional(),
  assignedClassTimes: z.string().optional(),
  assignedGender: z.enum(['male', 'female']).optional(),
});

/**
 * GET /api/admins - List all admins (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canViewAdmins(session.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admins = await prisma.admin.findMany({
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

    const adminsWithCollection = admins.map((admin: any) => {
      // Robust field mapping for Prisma potential inconsistencies
      const fullName = admin.fullName || admin.full_name || 'بێ ناو';
      const assignedClassTimes = admin.assignedClassTimes || admin.assigned_class_times || '';
      const assignedGender = admin.assignedGender || admin.assigned_gender || null;
      
      return {
        ...admin,
        fullName,
        assignedClassTimes,
        assignedGender,
        todayCollection: adminPayments.find(ap => ap.recordedBy === admin.id)?._sum.amount || 0,
      };
    });

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
      return NextResponse.json({ error: 'Unauthorized - only super admin can create admins' }, { status: 401 });
    }

    const body = await request.json();

    const validationResult = createAdminSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const data = validationResult.data;

    // Check if email already exists
    const existing = await prisma.admin.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hash(data.password, 12);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        role: data.role || 'admin',
        assignedClassTimes: data.assignedClassTimes || '',
        assignedGender: data.assignedGender || null,
        createdBy: session.user.id,
      } as any,
    });

    const adminResponse = {
      ...admin,
      fullName: (admin as any).fullName || (admin as any).full_name,
    };

    return NextResponse.json(adminResponse, { status: 201 });
  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json(
      { error: 'Failed to create admin' },
      { status: 500 }
    );
  }
}
