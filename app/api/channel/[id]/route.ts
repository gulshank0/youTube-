import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const channelId = params.id;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        offerings: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            title: true,
            status: true,
            sharePercentage: true,
            pricePerShare: true,
            totalShares: true,
            availableShares: true,
            createdAt: true,
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json(
        { success: false, error: 'Channel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      channel,
    });
  } catch (error) {
    console.error('Channel fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch channel' },
      { status: 500 }
    );
  }
}