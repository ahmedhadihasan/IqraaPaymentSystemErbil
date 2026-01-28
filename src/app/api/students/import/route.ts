import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { normalizeText } from '@/lib/text-utils';
import { parse } from 'csv-parse/sync';

/**
 * Map Kurdish class time names to system codes
 */
const CLASS_TIME_MAP: Record<string, string> = {
  'شەممە بەیانی': 'saturday_morning',
  'شەممە عەسر': 'saturday_evening',
  'شەممە ئێوارە': 'saturday_evening',
  'شەممە شەو': 'saturday_night',
  'شەممە شەوان': 'saturday_night',
  'دووشەممە عەسر': 'monday_evening',
  'دووشەممە ئێوارە': 'monday_evening',
  'سێشەممە شەو': 'tuesday_night',
  'سێشەممە شەوان': 'tuesday_night',
  'چوارشەممە عەسر': 'wednesday_evening',
  'چوارشەممە ئێوارە': 'wednesday_evening',
  'چوارشەممە شەو': 'wednesday_night',
  'چوارشەممە شەوان': 'wednesday_night',
  'پێنجشەممە شەو': 'thursday_night',
  'پێنجشەممە شەوان': 'thursday_night',
};

/**
 * POST /api/students/import - Import students from CSV
 * Expected CSV columns (in order):
 * - Column 1: ژمارە (Number) - ignored
 * - Column 2: ناوی سیانی (Full Name) - REQUIRED
 * - Column 3: لەدایکبوون (Birth Year)
 * - Column 4: ناونیشان (Address)
 * - Column 5: ژمارەی مۆبایل (Phone)
 * - Column 6: بارى دارايى (Financial Status)
 * - Column 7: وانە (Class Time)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const gender = formData.get('gender') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!gender || !['male', 'female'].includes(gender)) {
      return NextResponse.json({ error: 'Invalid gender' }, { status: 400 });
    }

    // Read file content
    const text = await file.text();
    
    // Parse CSV
    const records = parse(text, {
      columns: false,
      skip_empty_lines: true,
      from_line: 2 // Skip header
    });

    const imported: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const values = records[i];
      const lineNum = i + 2; // +2 because we skipped header and 0-indexed

      try {
        // Extract values (skip first column which is the number)
        const name = values[1]?.trim();
        const birthYear = values[2]?.trim() || null;
        const address = values[3]?.trim() || null;
        const phone = values[4]?.trim() || null;
        const financialStatus = values[5]?.trim() || null;
        const classTimeKurdish = values[6]?.trim() || null;
        
        // Map Kurdish class time to system code
        const classTime = classTimeKurdish ? CLASS_TIME_MAP[classTimeKurdish] || null : null;

        // Skip empty rows or rows without name
        if (!name) {
          continue;
        }

        // Create student with normalized name for search
        await prisma.student.create({
          data: {
            name,
            nameNormalized: normalizeText(name),
            gender,
            birthYear,
            address,
            phone,
            financialStatus,
            classTime,
            status: 'active',
          },
        });

        imported.push(name);
      } catch (error: any) {
        errors.push(`Line ${lineNum}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: imported.length,
      errors: errors.slice(0, 5), // Return first 5 errors only
      totalErrors: errors.length,
    });
  } catch (error) {
    console.error('CSV import error:', error);
    return NextResponse.json(
      { error: 'Failed to import CSV' },
      { status: 500 }
    );
  }
}
