import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/payments/[id] - Get a single payment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 });
  }
}

/**
 * PUT /api/payments/[id] - Update a payment (amount only, for admins)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { amount } = body;

    if (amount === undefined || amount < 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Get the payment
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const isSuperAdmin = session.user.role === 'super_admin';

    // Check authorization: superadmin can edit all, regular admin can only edit their own class students
    if (!isSuperAdmin) {
      const admin = await prisma.admin.findUnique({
        where: { id: session.user.id },
        select: { assignedClassTimes: true, assignedGender: true },
      } as any);
      
      const adminClassTimes = (admin?.assignedClassTimes || '').split(',').filter(Boolean);
      const adminGender = (admin as any)?.assignedGender || '';

      // Check if payment's student belongs to admin's class
      const studentClassTime = payment.student?.classTime;
      const studentGender = payment.student?.gender;

      const classMatch = adminClassTimes.length === 0 || (studentClassTime && adminClassTimes.includes(studentClassTime));
      const genderMatch = !adminGender || studentGender === adminGender;

      if (!classMatch || !genderMatch) {
        return NextResponse.json({ error: 'ناتوانیت ئەم پارەدانە بگۆڕیت' }, { status: 403 });
      }
    }

    // Update the payment
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: { amount },
      include: { student: true },
    });

    return NextResponse.json(updatedPayment);
  } catch (error) {
    console.error('Update payment error:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}

/**
 * DELETE /api/payments/[id] - Void a payment (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get the payment
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const isSuperAdmin = session.user.role === 'super_admin';

    // Check authorization
    if (!isSuperAdmin) {
      const admin = await prisma.admin.findUnique({
        where: { id: session.user.id },
        select: { assignedClassTimes: true, assignedGender: true },
      } as any);
      
      const adminClassTimes = (admin?.assignedClassTimes || '').split(',').filter(Boolean);
      const adminGender = (admin as any)?.assignedGender || '';

      const studentClassTime = payment.student?.classTime;
      const studentGender = payment.student?.gender;

      const classMatch = adminClassTimes.length === 0 || (studentClassTime && adminClassTimes.includes(studentClassTime));
      const genderMatch = !adminGender || studentGender === adminGender;

      if (!classMatch || !genderMatch) {
        return NextResponse.json({ error: 'ناتوانیت ئەم پارەدانە بسڕیتەوە' }, { status: 403 });
      }
    }

    // Soft delete (void) the payment
    await prisma.payment.update({
      where: { id },
      data: { voided: true },
    });

    // Also void any sibling payments linked to this one
    await prisma.payment.updateMany({
      where: { siblingPaymentId: id },
      data: { voided: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete payment error:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
