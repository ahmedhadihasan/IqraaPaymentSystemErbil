import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';

/**
 * POST /api/auth/forgot-password
 * Two modes:
 * 1. Admin requests reset: { email } → checks if admin exists, returns success message
 * 2. Super admin resets password: { adminId, newPassword } → resets the admin's password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Mode 1: Admin requesting password reset (from login page)
    if (body.email && !body.adminId) {
      const admin = await prisma.admin.findUnique({
        where: { email: body.email },
      });

      if (!admin) {
        // Don't reveal if email exists or not for security
        return NextResponse.json({
          success: true,
          message: 'ئەگەر ئەم ئیمەیڵە هەبێت، پەیوەندی بە سەرپەرشتیار بکە بۆ ڕیسێتکردنی وشەی نهێنی',
        });
      }

      // Store the reset request in SystemConfig as a simple queue
      const existingRequests = await prisma.systemConfig.findUnique({
        where: { key: 'password_reset_requests' },
      });

      let requests: Array<{ email: string; name: string; requestedAt: string }> = [];
      if (existingRequests) {
        try {
          requests = JSON.parse(existingRequests.value);
        } catch { requests = []; }
      }

      // Add new request (avoid duplicates)
      const alreadyRequested = requests.some(r => r.email === body.email);
      if (!alreadyRequested) {
        requests.push({
          email: admin.email,
          name: admin.fullName,
          requestedAt: new Date().toISOString(),
        });

        await prisma.systemConfig.upsert({
          where: { key: 'password_reset_requests' },
          update: { value: JSON.stringify(requests) },
          create: { key: 'password_reset_requests', value: JSON.stringify(requests) },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'داواکاری ڕیسێتکردنی وشەی نهێنی نێردرا. تکایە پەیوەندی بە سەرپەرشتیار بکە.',
      });
    }

    // Mode 2: Super admin resetting an admin's password
    if (body.adminId && body.newPassword) {
      const session = await getServerSession(authOptions);
      if (!session || session.user.role !== 'super_admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const admin = await prisma.admin.findUnique({
        where: { id: body.adminId },
      });

      if (!admin) {
        return NextResponse.json({ error: 'بەڕێوەبەر نەدۆزرایەوە' }, { status: 404 });
      }

      const newHash = await hash(body.newPassword, 12);
      await prisma.admin.update({
        where: { id: body.adminId },
        data: { passwordHash: newHash },
      });

      // Remove from reset requests queue
      const existingRequests = await prisma.systemConfig.findUnique({
        where: { key: 'password_reset_requests' },
      });

      if (existingRequests) {
        try {
          let requests = JSON.parse(existingRequests.value);
          requests = requests.filter((r: any) => r.email !== admin.email);
          await prisma.systemConfig.update({
            where: { key: 'password_reset_requests' },
            data: { value: JSON.stringify(requests) },
          });
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: `وشەی نهێنی ${admin.fullName} ڕیسێتکرا`,
      });
    }

    return NextResponse.json({ error: 'داتای نادروست' }, { status: 400 });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/auth/forgot-password
 * Super admin: get list of pending password reset requests
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const existingRequests = await prisma.systemConfig.findUnique({
      where: { key: 'password_reset_requests' },
    });

    let requests: Array<{ email: string; name: string; requestedAt: string }> = [];
    if (existingRequests) {
      try {
        requests = JSON.parse(existingRequests.value);
      } catch { requests = []; }
    }

    return NextResponse.json(requests);
  } catch (error: any) {
    console.error('Error fetching reset requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/forgot-password
 * Super admin: clear a specific reset request
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const existingRequests = await prisma.systemConfig.findUnique({
      where: { key: 'password_reset_requests' },
    });

    if (existingRequests) {
      try {
        let requests = JSON.parse(existingRequests.value);
        requests = requests.filter((r: any) => r.email !== email);
        await prisma.systemConfig.update({
          where: { key: 'password_reset_requests' },
          data: { value: JSON.stringify(requests) },
        });
      } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
