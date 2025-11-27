import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Helper function to check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'ADMIN';
}

// GET - List all withdrawals (admin only)
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
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status !== 'ALL') {
      where.status = status;
    }

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        include: {
          bankAccount: {
            select: {
              bankName: true,
              accountNumberLast4: true,
              accountType: true,
              accountHolderName: true,
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.withdrawal.count({ where }),
    ]);

    // Get user details for each withdrawal
    const withdrawalsWithUsers = await Promise.all(
      withdrawals.map(async (withdrawal) => {
        const user = await prisma.user.findUnique({
          where: { id: withdrawal.userId },
          select: {
            id: true,
            email: true,
            name: true,
            kycStatus: true,
          },
        });
        return { ...withdrawal, user };
      })
    );

    // Get stats
    const [pendingCount, processingCount, completedCount, failedCount] = await Promise.all([
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.withdrawal.count({ where: { status: 'PROCESSING' } }),
      prisma.withdrawal.count({ where: { status: 'COMPLETED' } }),
      prisma.withdrawal.count({ where: { status: 'FAILED' } }),
    ]);

    return NextResponse.json({
      success: true,
      withdrawals: withdrawalsWithUsers,
      stats: {
        pending: pendingCount,
        processing: processingCount,
        completed: completedCount,
        failed: failedCount,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch withdrawals' },
      { status: 500 }
    );
  }
}

// PATCH - Process withdrawal (approve/reject)
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

    const { withdrawalId, action, failureReason } = await request.json();

    if (!withdrawalId || !action) {
      return NextResponse.json(
        { success: false, error: 'Withdrawal ID and action are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject', 'complete'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: { bankAccount: true },
    });

    if (!withdrawal) {
      return NextResponse.json(
        { success: false, error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    // Get user and wallet
    const user = await prisma.user.findUnique({
      where: { id: withdrawal.userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      return NextResponse.json(
        { success: false, error: 'User or wallet not found' },
        { status: 404 }
      );
    }

    // Process based on action
    if (action === 'approve' || action === 'complete') {
      // Move from PENDING to PROCESSING (approve) or PROCESSING to COMPLETED (complete)
      const newStatus = action === 'approve' ? 'PROCESSING' : 'COMPLETED';
      
      const result = await prisma.$transaction(async (tx) => {
        const updatedWithdrawal = await tx.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: newStatus,
            processedAt: action === 'approve' ? new Date() : withdrawal.processedAt,
            completedAt: action === 'complete' ? new Date() : undefined,
          },
        });

        // If completing, unlock and deduct funds
        if (action === 'complete') {
          await tx.wallet.update({
            where: { id: user.wallet!.id },
            data: {
              lockedBalance: { decrement: withdrawal.amount },
              totalWithdrawn: { increment: withdrawal.netAmount },
              lastActivityAt: new Date(),
            },
          });

          // Update transaction status
          await tx.transaction.updateMany({
            where: {
              referenceType: 'withdrawal',
              referenceId: withdrawalId,
            },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          });

          // Create final ledger entry
          await tx.walletLedger.create({
            data: {
              walletId: user.wallet!.id,
              entryType: 'WITHDRAWAL',
              debit: withdrawal.netAmount,
              credit: 0,
              balance: user.wallet!.balance,
              description: `Withdrawal completed - ₹${withdrawal.netAmount.toLocaleString('en-IN')} sent to ${withdrawal.bankAccount.bankName}`,
              referenceType: 'withdrawal',
              referenceId: withdrawalId,
            },
          });
        }

        return updatedWithdrawal;
      });

      return NextResponse.json({
        success: true,
        withdrawal: result,
        message: action === 'approve' 
          ? 'Withdrawal approved and is now processing' 
          : 'Withdrawal completed successfully',
      });
    } else if (action === 'reject') {
      // Reject and refund
      const result = await prisma.$transaction(async (tx) => {
        const updatedWithdrawal = await tx.withdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: 'FAILED',
            failureReason: failureReason || 'Rejected by admin',
            processedAt: new Date(),
          },
        });

        // Unlock and restore funds
        await tx.wallet.update({
          where: { id: user.wallet!.id },
          data: {
            balance: { increment: withdrawal.amount },
            lockedBalance: { decrement: withdrawal.amount },
            lastActivityAt: new Date(),
          },
        });

        // Update transaction
        await tx.transaction.updateMany({
          where: {
            referenceType: 'withdrawal',
            referenceId: withdrawalId,
          },
          data: {
            status: 'FAILED',
          },
        });

        // Create ledger entry for unlock
        await tx.walletLedger.create({
          data: {
            walletId: user.wallet!.id,
            entryType: 'UNLOCK',
            debit: 0,
            credit: withdrawal.amount,
            balance: user.wallet!.balance + withdrawal.amount,
            description: `Withdrawal rejected - funds restored. Reason: ${failureReason || 'Rejected by admin'}`,
            referenceType: 'withdrawal',
            referenceId: withdrawalId,
          },
        });

        return updatedWithdrawal;
      });

      return NextResponse.json({
        success: true,
        withdrawal: result,
        message: 'Withdrawal rejected and funds have been restored',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process withdrawal' },
      { status: 500 }
    );
  }
}
