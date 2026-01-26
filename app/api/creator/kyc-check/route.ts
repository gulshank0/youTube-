import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's KYC status and earnings
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        kycStatus: true,
        kycData: true,
        wallet: {
          select: {
            totalEarnings: true,
            balance: true,
          },
        },
        channels: {
          select: {
            id: true,
            offerings: {
              select: {
                id: true,
                investments: {
                  where: { status: 'CONFIRMED' },
                  select: {
                    totalAmount: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate total investment received
    const totalInvestmentReceived = user.channels.reduce((total, channel) => {
      return total + channel.offerings.reduce((offeringTotal, offering) => {
        return offeringTotal + offering.investments.reduce((invTotal, investment) => {
          return invTotal + investment.totalAmount;
        }, 0);
      }, 0);
    }, 0);

    const totalEarnings = user.wallet?.totalEarnings || 0;
    const currentBalance = user.wallet?.balance || 0;

    // KYC requirements based on earnings and investment
    const kycRequired = {
      forEarnings: totalEarnings >= 50000, // ₹50,000 earnings threshold
      forInvestment: totalInvestmentReceived >= 100000, // ₹1,00,000 investment threshold
      forWithdrawal: currentBalance >= 25000, // ₹25,000 withdrawal threshold
    };

    const requiresKyc = Object.values(kycRequired).some(Boolean);
    const kycCompleted = user.kycStatus === 'VERIFIED';
    const kycPending = user.kycStatus === 'PENDING';
    const kycRejected = user.kycStatus === 'REJECTED';

    // Determine restrictions
    const restrictions = {
      canReceivePayments: !requiresKyc || kycCompleted,
      canWithdraw: !kycRequired.forWithdrawal || kycCompleted,
      canCreateOfferings: !kycRequired.forInvestment || kycCompleted || !requiresKyc,
      maxEarningsWithoutKyc: 50000,
      maxInvestmentWithoutKyc: 100000,
      maxWithdrawalWithoutKyc: 25000,
    };

    return NextResponse.json({
      success: true,
      kycStatus: user.kycStatus,
      kycRequired: requiresKyc,
      kycCompleted,
      kycPending,
      kycRejected,
      restrictions,
      thresholds: {
        earnings: totalEarnings,
        investment: totalInvestmentReceived,
        balance: currentBalance,
      },
      requirements: kycRequired,
      hasKycData: !!user.kycData,
    });
  } catch (error) {
    console.error('KYC check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check KYC status' },
      { status: 500 }
    );
  }
}