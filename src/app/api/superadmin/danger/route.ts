import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * POST /api/superadmin/danger
 * { action: 'students' | 'admins' | 'payments' | 'paymentsByAdmin' | 'all', adminId?: string }
 * Only super_admin can use
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { action, adminId } = body;

  try {
    if (action === 'students') {
      await prisma.student.deleteMany({});
      return NextResponse.json({ success: true, message: 'All students deleted.' });
    }
    if (action === 'admins') {
      await prisma.admin.deleteMany({ where: { role: { not: 'super_admin' } } });
      return NextResponse.json({ success: true, message: 'All admins deleted except super_admin.' });
    }
    if (action === 'payments') {
      await prisma.payment.deleteMany({});
      return NextResponse.json({ success: true, message: 'All payments deleted.' });
    }
    if (action === 'paymentsByAdmin' && adminId) {
      await prisma.payment.deleteMany({ where: { recordedBy: adminId } });
      return NextResponse.json({ success: true, message: `All payments for admin ${adminId} deleted.` });
    }
    if (action === 'all') {
      await prisma.payment.deleteMany({});
      await prisma.student.deleteMany({});
      await prisma.admin.deleteMany({ where: { role: { not: 'super_admin' } } });
      return NextResponse.json({ success: true, message: 'All data deleted except super_admin.' });
    }
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
