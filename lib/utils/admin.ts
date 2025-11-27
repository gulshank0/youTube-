import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Helper to check if the current user is an admin
 * For use in API routes
 */
export async function isAdminUser(): Promise<{ isAdmin: boolean; userId?: string; error?: NextResponse }> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return {
      isAdmin: false,
      error: NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== 'ADMIN') {
    return {
      isAdmin: false,
      error: NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      ),
    };
  }

  return { isAdmin: true, userId: session.user.id };
}

/**
 * Helper to check if a user has completed KYC verification
 */
export async function isKycVerified(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycStatus: true },
  });

  return user?.kycStatus === 'VERIFIED';
}

/**
 * Get user's KYC status
 */
export async function getKycStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      kycStatus: true,
      kycData: true,
    },
  });

  return {
    status: user?.kycStatus || 'PENDING',
    data: user?.kycData,
    isVerified: user?.kycStatus === 'VERIFIED',
    isPending: user?.kycStatus === 'PENDING',
    isRejected: user?.kycStatus === 'REJECTED',
  };
}
