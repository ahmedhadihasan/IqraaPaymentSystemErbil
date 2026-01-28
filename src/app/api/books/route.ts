import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createAuditLog } from '@/lib/api-utils';

/**
 * GET /api/books - List books or sales
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'books'; // 'books' or 'sales'

    if (type === 'sales') {
      const period = searchParams.get('period') || 'all';
      const startDate = searchParams.get('startDate') || '';
      const endDate = searchParams.get('endDate') || '';
      const gender = searchParams.get('gender') || '';
      const classTime = searchParams.get('classTime') || '';
      const bookId = searchParams.get('bookId') || '';

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      let dateFilter: Record<string, Date> | undefined;
      if (period === 'custom' && startDate && endDate) {
        dateFilter = {
          gte: new Date(startDate),
          lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        };
      } else if (period === 'today') {
        dateFilter = { gte: todayStart, lt: todayEnd };
      } else if (period === 'week') {
        const day = now.getDay();
        const diffToSat = (day + 1) % 7;
        const sat = new Date(todayStart);
        sat.setDate(todayStart.getDate() - diffToSat);
        const fri = new Date(sat);
        fri.setDate(sat.getDate() + 6);
        fri.setHours(23, 59, 59, 999);
        dateFilter = { gte: sat, lte: fri };
      } else if (period === 'month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        lastDay.setHours(23, 59, 59, 999);
        dateFilter = { gte: firstDay, lte: lastDay };
      }

      const genderFilters = gender.split(',').map(g => g.trim()).filter(Boolean);
      const classTimeFilters = classTime.split(',').map(c => c.trim()).filter(Boolean);
      const bookIds = bookId.split(',').map(b => b.trim()).filter(Boolean);

      let adminGender = '';
      let adminClassTimes: string[] = [];
      if (session.user.role !== 'super_admin') {
        const admin = await prisma.admin.findUnique({
          where: { id: session.user.id },
          select: { assignedClassTimes: true, assignedGender: true },
        } as any);
        adminGender = (admin as any)?.assignedGender || '';
        adminClassTimes = admin?.assignedClassTimes?.split(',').filter(Boolean) || [];
      }

      const paymentWhere: Record<string, unknown> = {
        paymentType: 'book',
        voided: false,
      };

      if (dateFilter) {
        paymentWhere.paymentDate = dateFilter;
      }

      const effectiveGenderFilters = adminGender ? [adminGender] : genderFilters;
      const effectiveClassFilters = adminClassTimes.length > 0 ? adminClassTimes : classTimeFilters;

      if (effectiveGenderFilters.length > 0 || effectiveClassFilters.length > 0) {
        paymentWhere.student = {
          ...(effectiveGenderFilters.length > 0 ? { gender: { in: effectiveGenderFilters } } : {}),
          ...(effectiveClassFilters.length > 0 ? { classTime: { in: effectiveClassFilters } } : {}),
        };
      }

      const sales = await prisma.bookSale.findMany({
        where: {
          ...(bookIds.length > 0 ? { bookId: { in: bookIds } } : {}),
          payment: paymentWhere,
        },
        include: {
          book: true,
          payment: { include: { student: true } },
        },
        orderBy: { payment: { createdAt: 'desc' } },
      });
      return NextResponse.json(sales);
    }

    const books = await prisma.book.findMany({
      where: { active: true },
      orderBy: { title: 'asc' }
    });
    return NextResponse.json(books);
  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/**
 * POST /api/books - Create book or Record sale
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const isSuperAdmin = session.user.role === 'super_admin';

    // Action: Create Book (Super Admin only)
    if (body.action === 'create') {
      if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const book = await prisma.book.create({
        data: {
          title: body.title,
          price: Number(body.price),
        }
      });
      return NextResponse.json(book);
    }

    // Action: Record Sale
    if (body.action === 'sale') {
      const { bookId, amount, studentId, quantity = 1 } = body;
      
      const book = await prisma.book.findUnique({ where: { id: bookId } });
      if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 });

      const admin = await prisma.admin.findUnique({ 
        where: { id: session.user.id },
        select: { fullName: true }
      });

      // Every book sale is a Payment record of type 'book'
      const payment = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.create({
          data: {
            studentId: studentId || '00000000-0000-0000-0000-000000000000', // placeholder if no student linked
            amount: Number(amount),
            paymentDate: new Date(),
            paymentType: 'book',
            periodStart: new Date(), // irrelevant for books but required by schema maybe?
            periodEnd: new Date(),
            notes: `Sold: ${book.title}`,
            recordedBy: session.user.id,
            recordedByName: admin?.fullName || 'Admin',
          }
        });

        await tx.bookSale.create({
          data: {
            bookId,
            paymentId: p.id,
            quantity,
            unitPrice: book.price,
            totalAmount: Number(amount),
          }
        });
        return p;
      });
      return NextResponse.json(payment);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in books API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/**
 * PUT /api/books - Update book (Super Admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, title, price, active } = body;

    if (!id) return NextResponse.json({ error: 'Book ID required' }, { status: 400 });

    const book = await prisma.book.update({
      where: { id },
      data: {
        title,
        price: price ? Number(price) : undefined,
        active: active !== undefined ? active : undefined,
      }
    });

    return NextResponse.json(book);
  } catch (error) {
    console.error('Error updating book:', error);
    return NextResponse.json({ error: 'Failed to update book' }, { status: 500 });
  }
}

/**
 * DELETE /api/books - Delete book (Super Admin only)
 * Note: Soft delete by setting active=false is preferred if sales exist, 
 * but for now we'll allow delete if no sales, or maybe just soft delete.
 * Let's implement soft delete (active=false) as "Delete" for safety.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'Book ID required' }, { status: 400 });

    // Check for sales
    const salesCount = await prisma.bookSale.count({ where: { bookId: id } });

    if (salesCount > 0) {
      // If sales exist, soft delete
      await prisma.book.update({
        where: { id },
        data: { active: false }
      });
      return NextResponse.json({ message: 'Book deactivated (has sales)' });
    } else {
      // If no sales, hard delete
      await prisma.book.delete({ where: { id } });
      return NextResponse.json({ message: 'Book deleted' });
    }
  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json({ error: 'Failed to delete book' }, { status: 500 });
  }
}
