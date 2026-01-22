import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import prisma from './prisma';

interface AuditLogParams {
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  request?: Request;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return;

  await prisma.auditLog.create({
    data: {
      adminId: session.user.id,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details ? JSON.stringify(params.details) : undefined,
    },
  });
}

/**
 * Check if current user is super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'super_admin';
}

/**
 * Get current admin ID
 */
export async function getCurrentAdminId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id || null;
}

/**
 * Require authentication for API routes
 */
export async function requireAuth(): Promise<{ adminId: string; role: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return {
    adminId: session.user.id,
    role: session.user.role,
  };
}

/**
 * Require super admin for API routes
 */
export async function requireSuperAdmin(): Promise<{ adminId: string } | NextResponse> {
  const auth = await requireAuth();
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  if (auth.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Forbidden - Super admin required' },
      { status: 403 }
    );
  }

  return { adminId: auth.adminId };
}

/**
 * API Error Handler
 */
export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  if (error instanceof Error) {
    if (error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A record with this value already exists' },
        { status: 409 }
      );
    }
    if (error.message.includes('Foreign key constraint')) {
      return NextResponse.json(
        { error: 'Related record not found' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: 'An unexpected error occurred' },
    { status: 500 }
  );
}

/**
 * Parse pagination from search params
 */
export function parsePagination(searchParams: URLSearchParams): { skip: number; take: number; page: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
  
  return {
    page,
    take: pageSize,
    skip: (page - 1) * pageSize,
  };
}
