import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.payment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.systemConfig.deleteMany();

  // Hash password
  const hashedPassword = await bcrypt.hash('Admin@123', 12);

  // Create Super Admin
  const superAdmin = await prisma.admin.create({
    data: {
      email: 'super@iqraa.org',
      passwordHash: hashedPassword,
      fullName: 'سەرپەرشتیار',
      role: 'super_admin',
      isActive: true,
      assignedClassTimes: '', // Super admin sees all
    },
  });
  console.log('✅ Created super admin: super@iqraa.org');

  // Create Class Teachers (8 admins for each class time)
  const teachers = [
    { 
      email: 'fink@iqraa.org', 
      fullName: 'مامۆستا فێنک', 
      classTime: 'saturday_morning',
      gender: 'female'
    },
    { 
      email: 'payam@iqraa.org', 
      fullName: 'مامۆستا پەیام', 
      classTime: 'saturday_evening',
      gender: 'female'
    },
    { 
      email: 'salih@iqraa.org', 
      fullName: 'مامۆستا صاڵح', 
      classTime: 'saturday_night',
      gender: 'male'
    },
    { 
      email: 'narmin@iqraa.org', 
      fullName: 'مامۆستا نەرمین', 
      classTime: 'monday_evening',
      gender: 'female'
    },
    { 
      email: 'salah@iqraa.org', 
      fullName: 'مامۆستا سەڵاح', 
      classTime: 'tuesday_night',
      gender: 'male'
    },
    { 
      email: 'basma@iqraa.org', 
      fullName: 'مامۆستا باسمە', 
      classTime: 'wednesday_evening',
      gender: 'female'
    },
    { 
      email: 'ahmad@iqraa.org', 
      fullName: 'مامۆستا ئەحمەد ئەمیر', 
      classTime: 'wednesday_night',
      gender: 'male'
    },
    { 
      email: 'abdulbasit@iqraa.org', 
      fullName: 'مامۆستا عبدالباسط', 
      classTime: 'thursday_night',
      gender: 'male'
    },
  ];

  for (const teacher of teachers) {
    await prisma.admin.create({
      data: {
        email: teacher.email,
        passwordHash: hashedPassword,
        fullName: teacher.fullName,
        role: 'admin',
        isActive: true,
        assignedClassTimes: teacher.classTime,
      },
    });
    console.log(`✅ Created teacher: ${teacher.fullName} (${teacher.email})`);
  }

  // Create sample students for each class
  const sampleStudents = [
    // Saturday Morning (Women) - مامۆستا فێنک
    { name: 'زینب ئەحمەد', gender: 'female', classTime: 'saturday_morning', phone: '0750111111' },
    { name: 'فاطمە عەلی', gender: 'female', classTime: 'saturday_morning', phone: '0750111112' },
    { name: 'هێرۆ حەسەن', gender: 'female', classTime: 'saturday_morning', phone: '0750111113' },
    
    // Saturday Evening (Women) - مامۆستا پەیام
    { name: 'سارا محەمەد', gender: 'female', classTime: 'saturday_evening', phone: '0750222221' },
    { name: 'ڕۆژین عومەر', gender: 'female', classTime: 'saturday_evening', phone: '0750222222' },
    
    // Saturday Night (Men) - مامۆستا صاڵح
    { name: 'عەلی حەسەن', gender: 'male', classTime: 'saturday_night', phone: '0750333331' },
    { name: 'محەمەد ئیبراهیم', gender: 'male', classTime: 'saturday_night', phone: '0750333332' },
    
    // Monday Evening (Women) - مامۆستا نەرمین
    { name: 'شایان عبدالله', gender: 'female', classTime: 'monday_evening', phone: '0750444441' },
    { name: 'دیلان کەریم', gender: 'female', classTime: 'monday_evening', phone: '0750444442' },
    
    // Tuesday Night (Men) - مامۆستا سەڵاح
    { name: 'ئاکۆ رەشید', gender: 'male', classTime: 'tuesday_night', phone: '0750555551' },
    { name: 'کارزان جەلال', gender: 'male', classTime: 'tuesday_night', phone: '0750555552' },
    
    // Wednesday Evening (Women) - مامۆستا باسمە
    { name: 'نازەنین حوسێن', gender: 'female', classTime: 'wednesday_evening', phone: '0750666661' },
    { name: 'هەڤار سەعید', gender: 'female', classTime: 'wednesday_evening', phone: '0750666662' },
    
    // Wednesday Night (Men) - مامۆستا ئەحمەد ئەمیر
    { name: 'هێمن عەلی', gender: 'male', classTime: 'wednesday_night', phone: '0750777771' },
    { name: 'ڕێبوار محەمەد', gender: 'male', classTime: 'wednesday_night', phone: '0750777772' },
    
    // Thursday Night (Men) - مامۆستا عبدالباسط
    { name: 'سەرهەنگ ئیبراهیم', gender: 'male', classTime: 'thursday_night', phone: '0750888881' },
    { name: 'بەرهەم عومەر', gender: 'male', classTime: 'thursday_night', phone: '0750888882' },
  ];

  // Helper function to normalize text for search
  function normalizeText(text: string): string {
    return text
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ە/g, 'ه')
      .replace(/ۆ/g, 'و')
      .replace(/ێ/g, 'ي')
      .replace(/ڕ/g, 'ر')
      .replace(/ڵ/g, 'ل')
      .replace(/ڤ/g, 'ف')
      .toLowerCase();
  }

  for (const student of sampleStudents) {
    await prisma.student.create({
      data: {
        name: student.name,
        nameNormalized: normalizeText(student.name),
        gender: student.gender,
        classTime: student.classTime,
        phone: student.phone,
        status: 'active',
        joinDate: new Date('2026-01-01'),
      },
    });
  }
  console.log('✅ Created sample students');

  // Create system config
  await prisma.systemConfig.create({
    data: {
      key: 'semester_2026A',
      value: JSON.stringify({
        name: '2026A',
        startDate: '2026-01-01',
        endDate: '2026-07-01',
        singleStudentFee: 25000,
        siblingFirstFee: 25000,
        siblingAdditionalFee: 20000, // Each additional sibling pays 20000
      }),
    },
  });
  console.log('✅ Created system config');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\nLogin credentials (all passwords: Admin@123):');
  console.log('  Super Admin: super@iqraa.org');
  console.log('  --------------------------------');
  console.log('  Saturday Morning: fink@iqraa.org (مامۆستا فێنک)');
  console.log('  Saturday Evening: payam@iqraa.org (مامۆستا پەیام)');
  console.log('  Saturday Night: salih@iqraa.org (مامۆستا صاڵح)');
  console.log('  Monday Evening: narmin@iqraa.org (مامۆستا نەرمین)');
  console.log('  Tuesday Night: salah@iqraa.org (مامۆستا سەڵاح)');
  console.log('  Wednesday Evening: basma@iqraa.org (مامۆستا باسمە)');
  console.log('  Wednesday Night: ahmad@iqraa.org (مامۆستا ئەحمەد ئەمیر)');
  console.log('  Thursday Night: abdulbasit@iqraa.org (مامۆستا عبدالباسط)');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
