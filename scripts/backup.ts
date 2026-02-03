import fs from 'fs/promises';
import path from 'path';
import prisma from '../src/lib/prisma';

async function run() {
  const now = new Date();
  const datePart = now.toISOString().split('T')[0];
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', datePart);

  await fs.mkdir(backupDir, { recursive: true });

  const [
    students,
    payments,
    books,
    bookSales,
    admins,
    auditLogs,
    systemConfig,
  ] = await Promise.all([
    prisma.student.findMany(),
    prisma.payment.findMany(),
    prisma.book.findMany(),
    prisma.bookSale.findMany(),
    prisma.admin.findMany(),
    prisma.auditLog.findMany(),
    prisma.systemConfig.findMany(),
  ]);

  const payload = {
    generatedAt: now.toISOString(),
    counts: {
      students: students.length,
      payments: payments.length,
      books: books.length,
      bookSales: bookSales.length,
      admins: admins.length,
      auditLogs: auditLogs.length,
      systemConfig: systemConfig.length,
    },
    data: {
      students,
      payments,
      books,
      bookSales,
      admins,
      auditLogs,
      systemConfig,
    },
  };

  const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
  await fs.writeFile(backupFile, JSON.stringify(payload, null, 2), 'utf-8');

  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('file:')) {
    const rawPath = dbUrl.replace('file:', '');
    // Try multiple possible locations for the database file
    const possiblePaths = [
      path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath),
      path.join(process.cwd(), 'prisma', rawPath.replace('./', '')),
    ];
    
    for (const resolvedPath of possiblePaths) {
      try {
        await fs.access(resolvedPath);
        const dbCopyPath = path.join(backupDir, `db-${timestamp}.sqlite`);
        await fs.copyFile(resolvedPath, dbCopyPath);
        break;
      } catch {
        // Try next path
      }
    }
  }

  await prisma.$disconnect();
  process.stdout.write(`Backup saved to ${backupFile}\n`);
}

run().catch(async (error) => {
  await prisma.$disconnect();
  process.stderr.write(`${error}\n`);
  process.exit(1);
});
