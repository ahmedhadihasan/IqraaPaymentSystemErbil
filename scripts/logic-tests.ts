import prisma from '@/lib/prisma';
import { calculateFamilyTotal, getFamilyPaymentBreakdown, SEMESTER } from '@/lib/billing';
import { hash } from 'bcryptjs';

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const run = async () => {
  const suffix = Date.now().toString();
  const superAdminEmail = `super.test.${suffix}@iqraa.org`;
  const adminEmail = `admin.test.${suffix}@iqraa.org`;
  const passwordHash = await hash('Admin@123', 10);

  const createdAdminIds: string[] = [];
  const createdStudentIds: string[] = [];
  const createdPaymentIds: string[] = [];

  try {
    const superAdmin = await prisma.admin.create({
      data: {
        email: superAdminEmail,
        passwordHash,
        fullName: `Super Test ${suffix}`,
        role: 'super_admin',
        assignedClassTimes: '',
        isActive: true,
      },
    });
    createdAdminIds.push(superAdmin.id);

    const admin = await prisma.admin.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: `Admin Test ${suffix}`,
        role: 'admin',
        assignedClassTimes: 'saturday_morning,tuesday_night',
        isActive: true,
      },
    });
    createdAdminIds.push(admin.id);

    const studentA = await prisma.student.create({
      data: {
        name: `Test Student A ${suffix}`,
        nameNormalized: `test student a ${suffix}`,
        gender: 'male',
        classTime: 'saturday_morning',
        status: 'active',
      },
    });
    createdStudentIds.push(studentA.id);

    const studentB = await prisma.student.create({
      data: {
        name: `Test Student B ${suffix}`,
        nameNormalized: `test student b ${suffix}`,
        gender: 'female',
        classTime: 'tuesday_night',
        status: 'active',
      },
    });
    createdStudentIds.push(studentB.id);

    const singlePayment = await prisma.payment.create({
      data: {
        studentId: studentA.id,
        amount: 25000,
        paymentDate: new Date(),
        paymentType: 'single',
        periodStart: SEMESTER.START,
        periodEnd: SEMESTER.END,
        monthsCount: 6,
        siblingNames: null,
        siblingStudentId: null,
        notes: 'test-single',
        recordedBy: admin.id,
        recordedByName: admin.fullName,
      },
    });
    createdPaymentIds.push(singlePayment.id);

    const totalFamily = calculateFamilyTotal(2);
    const breakdown = getFamilyPaymentBreakdown(2);
    const breakdownSum = breakdown.reduce((a, b) => a + b, 0);
    assert(totalFamily === breakdownSum, 'Family pricing breakdown mismatch');

    const mainFamilyPayment = await prisma.payment.create({
      data: {
        studentId: studentA.id,
        amount: breakdown[0],
        paymentDate: new Date(),
        paymentType: 'family',
        periodStart: SEMESTER.START,
        periodEnd: SEMESTER.END,
        monthsCount: 6,
        siblingNames: `${studentA.name}، ${studentB.name}`,
        siblingStudentId: null,
        notes: 'test-family-main',
        recordedBy: admin.id,
        recordedByName: admin.fullName,
      },
    });
    createdPaymentIds.push(mainFamilyPayment.id);

    const siblingPayment = await prisma.payment.create({
      data: {
        studentId: studentB.id,
        amount: breakdown[1],
        paymentDate: new Date(),
        paymentType: 'family',
        periodStart: SEMESTER.START,
        periodEnd: SEMESTER.END,
        monthsCount: 6,
        siblingNames: `${studentA.name}، ${studentB.name}`,
        siblingStudentId: studentA.id,
        siblingPaymentId: mainFamilyPayment.id,
        notes: 'test-family-sibling',
        recordedBy: admin.id,
        recordedByName: admin.fullName,
      },
    });
    createdPaymentIds.push(siblingPayment.id);

    const paymentsCount = await prisma.payment.count({
      where: { recordedBy: admin.id },
    });
    assert(paymentsCount >= 3, 'Payments were not created as expected');

    const studentsCount = await prisma.student.count({
      where: { id: { in: createdStudentIds } },
    });
    assert(studentsCount === 2, 'Students were not created as expected');

    const adminCount = await prisma.admin.count({
      where: { id: { in: createdAdminIds } },
    });
    assert(adminCount === 2, 'Admins were not created as expected');

    console.log('Logic tests passed');
  } finally {
    await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    await prisma.student.deleteMany({ where: { id: { in: createdStudentIds } } });
    await prisma.admin.deleteMany({ where: { id: { in: createdAdminIds } } });
  }
};

run()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('Logic tests failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
