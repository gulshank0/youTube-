import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { KYCService } from '@/lib/services/kyc';
import { Prisma } from '@prisma/client';

const kycService = new KYCService();

// Helper function to check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'ADMIN';
}

// GET - List all KYC applications (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const page = Number.parseInt(searchParams.get('page') || '1');
    const limit = Number.parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {};
    
    if (status !== 'ALL') {
      where.kycStatus = status as 'PENDING' | 'VERIFIED' | 'REJECTED';
    }
    
    // Only show users who have submitted KYC data (not null)
    where.NOT = { kycData: { equals: Prisma.DbNull } };

    // Search by name or email
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [applications, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          kycStatus: true,
          kycData: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Get stats - use Prisma.DbNull for proper null comparison
    const [pendingCount, verifiedCount, rejectedCount] = await Promise.all([
      prisma.user.count({ where: { kycStatus: 'PENDING', NOT: { kycData: { equals: Prisma.DbNull } } } }),
      prisma.user.count({ where: { kycStatus: 'VERIFIED', NOT: { kycData: { equals: Prisma.DbNull } } } }),
      prisma.user.count({ where: { kycStatus: 'REJECTED', NOT: { kycData: { equals: Prisma.DbNull } } } }),
    ]);

    return NextResponse.json({
      success: true,
      applications,
      stats: {
        pending: pendingCount,
        verified: verifiedCount,
        rejected: rejectedCount,
        total: pendingCount + verifiedCount + rejectedCount,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching KYC applications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch KYC applications' },
      { status: 500 }
    );
  }
}

// PATCH - Approve or reject KYC application
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { userId, action, reason } = await request.json();

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: 'User ID and action are required' },
        { status: 400 }
      );
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    if (action === 'reject' && !reason) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Check if user exists and has pending KYC
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, kycData: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (!targetUser.kycData) {
      return NextResponse.json(
        { success: false, error: 'No KYC data found for this user' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'approve') {
      result = await kycService.approveKYC(userId, session.user.id);
      
      // Log the action
      console.log(`KYC approved for user ${userId} by admin ${session.user.id}`);
    } else {
      result = await kycService.rejectKYC(userId, reason, session.user.id);
      
      // Log the action
      console.log(`KYC rejected for user ${userId} by admin ${session.user.id}. Reason: ${reason}`);
    }

    return NextResponse.json({
      ...result,
      action,
    });
  } catch (error) {
    console.error('Error updating KYC status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update KYC status' },
      { status: 500 }
    );
  }
}
