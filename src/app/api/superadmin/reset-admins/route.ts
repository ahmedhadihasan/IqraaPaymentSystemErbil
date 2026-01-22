import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hash } from 'bcryptjs';

const adminsToCreate = [
  { classTime: 'saturday_morning', name: 'مامۆستا فێنک', email: 'fink@iqraa.org', password: 'Admin@123' },
  { classTime: 'saturday_evening', name: 'مامۆستا پەیام', email: 'payam@iqraa.org', password: 'Admin@123' },
  { classTime: 'saturday_night', name: 'مامۆستا صاڵح', email: 'salih@iqraa.org', password: 'Admin@123' },
  { classTime: 'monday_evening', name: 'مامۆستا نەرمین', email: 'narmin@iqraa.org', password: 'Admin@123' },
  { classTime: 'tuesday_night', name: 'مامۆستا سەڵاح', email: 'salah@iqraa.org', password: 'Admin@123' },
  { classTime: 'wednesday_evening', name: 'مامۆستا باسمە', email: 'basma@iqraa.org', password: 'Admin@123' },
  { classTime: 'wednesday_night', name: 'مامۆستا ئەحمەد ئەمیر', email: 'ahmad@iqraa.org', password: 'Admin@123' },
  { classTime: 'thursday_night', name: 'مامۆستا عبدالباسط', email: 'abdulbasit@iqraa.org', password: 'Admin@123' },
];

const superAdmin = { name: 'Super Admin', email: 'super@iqraa.org', password: 'Admin@123' };

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    // Delete all admins except superadmin
    await prisma.admin.deleteMany({ where: { role: { not: 'super_admin' } } });
    // Delete superadmin if exists (will recreate below)
    await prisma.admin.deleteMany({ where: { email: superAdmin.email } });

    // Create superadmin
    await prisma.admin.create({
      data: {
        fullName: superAdmin.name,
        email: superAdmin.email,
        passwordHash: await hash(superAdmin.password, 10),
        role: 'super_admin',
        isActive: true,
      },
    });

    // Create admins for each class time
    for (const admin of adminsToCreate) {
      await prisma.admin.create({
        data: {
          fullName: admin.name,
          email: admin.email,
          passwordHash: await hash(admin.password, 10),
          role: 'admin',
          isActive: true,
          assignedClassTimes: admin.classTime,
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Admins reset and recreated.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
