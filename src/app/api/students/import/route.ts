import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { normalizeText } from '@/lib/text-utils';

/**
 * Map Kurdish class time names to system codes
 */
const CLASS_TIME_MAP: Record<string, string> = {
  'شەممە بەیانی': 'saturday_morning',
  'شەممە عەسر': 'saturday_evening',
  'شەممە ئێوارە': 'saturday_evening',
  'شەممە شەو': 'saturday_night',
  'دووشەممە عەسر': 'monday_evening',
  'دووشەممە ئێوارە': 'monday_evening',
  'سێشەممە شەو': 'tuesday_night',
  'چوارشەممە عەسر': 'wednesday_evening',
  'چوارشەممە ئێوارە': 'wednesday_evening',
  'چوارشەممە شەو': 'wednesday_night',
  'پێنجشەممە شەو': 'thursday_night',
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
    const lines = text.split('\n').filter(line => line.trim());

    // Skip header row
    const dataLines = lines.slice(1);

    const imported: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      const lineNum = i + 2; // +2 because we skipped header and 0-indexed

      try {
        // Parse CSV line (handle commas in quoted values)
        const values = parseCSVLine(line);

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

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last value
  values.push(current);

  return values;
}
