import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { hasPermission, PERMISSIONS } from '@/lib/permissions';

// Default class times (initial seed)
const DEFAULT_CLASS_TIMES = [
  { id: 'saturday_morning', label: 'شەممە بەیانی', day: 'saturday', period: 'morning' },
  { id: 'saturday_evening', label: 'شەممە ئێوارە', day: 'saturday', period: 'evening' },
  { id: 'saturday_night', label: 'شەممە شەو', day: 'saturday', period: 'night' },
  { id: 'monday_evening', label: 'دووشەممە ئێوارە', day: 'monday', period: 'evening' },
  { id: 'tuesday_night', label: 'سێشەممە شەو', day: 'tuesday', period: 'night' },
  { id: 'wednesday_evening', label: 'چوارشەممە ئێوارە', day: 'wednesday', period: 'evening' },
  { id: 'wednesday_night', label: 'چوارشەممە شەو', day: 'wednesday', period: 'night' },
  { id: 'thursday_night', label: 'پێنجشەممە شەو', day: 'thursday', period: 'night' },
];

export interface ClassTimeConfig {
  id: string;
  label: string;
  day: string;
  period: string;
  active: boolean;
}

/**
 * GET /api/classes - Get all class times
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await prisma.systemConfig.findUnique({
      where: { key: 'class_times' },
    });

    let classTimes: ClassTimeConfig[];
    if (config) {
      try {
        classTimes = JSON.parse(config.value);
      } catch {
        classTimes = DEFAULT_CLASS_TIMES.map(ct => ({ ...ct, active: true }));
      }
    } else {
      // Initialize with defaults
      classTimes = DEFAULT_CLASS_TIMES.map(ct => ({ ...ct, active: true }));
      await prisma.systemConfig.create({
        data: {
          key: 'class_times',
          value: JSON.stringify(classTimes),
        },
      });
    }

    return NextResponse.json(classTimes);
  } catch (error: any) {
    console.error('Error fetching class times:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/classes - Add a new class time (super_admin only)
 * Body: { day: string, period: string, label?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role, PERMISSIONS.SYSTEM_MANAGE_CLASSES)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { day, period, label } = body;

    if (!day || !period) {
      return NextResponse.json({ error: 'ڕۆژ و کات پێویستە' }, { status: 400 });
    }

    // Valid days and periods
    const validDays = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const validPeriods = ['morning', 'evening', 'night'];

    if (!validDays.includes(day)) {
      return NextResponse.json({ error: 'ڕۆژی نادروست' }, { status: 400 });
    }
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: 'کاتی نادروست' }, { status: 400 });
    }

    const id = `${day}_${period}`;

    // Day labels in Kurdish
    const dayLabels: Record<string, string> = {
      saturday: 'شەممە',
      sunday: 'یەکشەممە',
      monday: 'دووشەممە',
      tuesday: 'سێشەممە',
      wednesday: 'چوارشەممە',
      thursday: 'پێنجشەممە',
      friday: 'هەینی',
    };
    const periodLabels: Record<string, string> = {
      morning: 'بەیانی',
      evening: 'ئێوارە',
      night: 'شەو',
    };

    const autoLabel = label || `${dayLabels[day]} ${periodLabels[period]}`;

    // Get existing config
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'class_times' },
    });

    let classTimes: ClassTimeConfig[] = [];
    if (config) {
      try { classTimes = JSON.parse(config.value); } catch { classTimes = []; }
    }

    // Check if already exists
    const existing = classTimes.find(ct => ct.id === id);
    if (existing) {
      // If it was deactivated, reactivate it
      if (!existing.active) {
        existing.active = true;
        existing.label = autoLabel;
        await prisma.systemConfig.update({
          where: { key: 'class_times' },
          data: { value: JSON.stringify(classTimes) },
        });
        return NextResponse.json({ success: true, classTime: existing, message: 'پۆل چالاککرایەوە' });
      }
      return NextResponse.json({ error: 'ئەم پۆلە پێشتر هەیە' }, { status: 400 });
    }

    // Add new class time
    const newClassTime: ClassTimeConfig = {
      id,
      label: autoLabel,
      day,
      period,
      active: true,
    };
    classTimes.push(newClassTime);

    await prisma.systemConfig.upsert({
      where: { key: 'class_times' },
      update: { value: JSON.stringify(classTimes) },
      create: { key: 'class_times', value: JSON.stringify(classTimes) },
    });

    return NextResponse.json({ success: true, classTime: newClassTime });
  } catch (error: any) {
    console.error('Error adding class time:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/classes - Update a class time (activate/deactivate/rename)
 * Body: { id: string, label?: string, active?: boolean }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role, PERMISSIONS.SYSTEM_MANAGE_CLASSES)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, label, active } = body;

    if (!id) {
      return NextResponse.json({ error: 'ئایدی پۆل پێویستە' }, { status: 400 });
    }

    const config = await prisma.systemConfig.findUnique({
      where: { key: 'class_times' },
    });

    if (!config) {
      return NextResponse.json({ error: 'پۆلەکان نەدۆزرانەوە' }, { status: 404 });
    }

    let classTimes: ClassTimeConfig[] = [];
    try { classTimes = JSON.parse(config.value); } catch { classTimes = []; }

    const classTime = classTimes.find(ct => ct.id === id);
    if (!classTime) {
      return NextResponse.json({ error: 'پۆل نەدۆزرایەوە' }, { status: 404 });
    }

    if (label !== undefined) classTime.label = label;
    if (active !== undefined) classTime.active = active;

    await prisma.systemConfig.update({
      where: { key: 'class_times' },
      data: { value: JSON.stringify(classTimes) },
    });

    return NextResponse.json({ success: true, classTime });
  } catch (error: any) {
    console.error('Error updating class time:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/classes - Delete a class time (only if no students assigned)
 * Query: ?id=class_time_id
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session.user.role, PERMISSIONS.SYSTEM_MANAGE_CLASSES)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ئایدی پۆل پێویستە' }, { status: 400 });
    }

    // Check if students are assigned to this class
    const studentsInClass = await prisma.student.count({
      where: { classTime: id },
    });

    if (studentsInClass > 0) {
      return NextResponse.json({
        error: `ناتوانرێت ئەم پۆلە بسڕێتەوە چونکە ${studentsInClass} قوتابی تێدایە. تکایە سەرەتا قوتابیەکان بگوازەرەوە.`,
      }, { status: 400 });
    }

    const config = await prisma.systemConfig.findUnique({
      where: { key: 'class_times' },
    });

    if (!config) {
      return NextResponse.json({ error: 'پۆلەکان نەدۆزرانەوە' }, { status: 404 });
    }

    let classTimes: ClassTimeConfig[] = [];
    try { classTimes = JSON.parse(config.value); } catch { classTimes = []; }

    classTimes = classTimes.filter(ct => ct.id !== id);

    await prisma.systemConfig.update({
      where: { key: 'class_times' },
      data: { value: JSON.stringify(classTimes) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting class time:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
