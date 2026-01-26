import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const minInvestment = searchParams.get('minInvestment');
    const sortBy = searchParams.get('sortBy') || 'newest';

    // Build where clause for offerings
    const offeringWhere: any = {
      status: 'ACTIVE',
      availableShares: { gt: 0 },
    };

    if (minInvestment) {
      offeringWhere.minInvestment = { gte: Number.parseFloat(minInvestment) };
    }

    // Determine sort order
    let orderBy: any;
    if (sortBy === 'newest') {
      orderBy = { createdAt: 'desc' };
    } else if (sortBy === 'funding') {
      orderBy = { availableShares: 'asc' };
    } else {
      orderBy = { pricePerShare: 'desc' };
    }

    // Fetch active offerings with channel data
    const offerings = await prisma.offering.findMany({
      where: offeringWhere,
      include: {
        channel: {
          select: {
            id: true,
            channelName: true,
            channelUrl: true,
            analytics: true,
            revenueData: true,
          },
        },
        investments: {
          where: { status: 'CONFIRMED' },
          select: {
            id: true,
            shares: true,
          },
        },
      },
      orderBy,
    });

    // Fetch verified channels without active offerings (newly onboarded creators)
    const channelsWithoutOfferings = await prisma.channel.findMany({
      where: {
        status: 'VERIFIED',
        offerings: {
          none: {
            status: 'ACTIVE'
          }
        }
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate funding progress and investor count
    const enrichedOfferings = offerings.map((offering) => {
      const soldShares = offering.totalShares - offering.availableShares;
      const fundingProgress = Math.round((soldShares / offering.totalShares) * 100);
      const investorCount = offering.investments.length;

      return {
        id: offering.id,
        type: 'offering',
        title: offering.title,
        description: offering.description,
        sharePercentage: offering.sharePercentage,
        totalShares: offering.totalShares,
        availableShares: offering.availableShares,
        pricePerShare: offering.pricePerShare,
        minInvestment: offering.minInvestment,
        maxInvestment: offering.maxInvestment,
        duration: offering.duration,
        fundingProgress,
        investorCount,
        channel: offering.channel,
        createdAt: offering.createdAt,
      };
    });

    // Transform channels without offerings into marketplace items
    const channelItems = channelsWithoutOfferings.map((channel) => {
      const analytics = channel.analytics as any;
      const revenueData = channel.revenueData as any;
      
      return {
        id: channel.id,
        type: 'channel',
        title: `Invest in ${channel.channelName}`,
        description: `New creator channel with ${analytics?.subscriberCount?.toLocaleString() || 'N/A'} subscribers. Coming soon to marketplace!`,
        sharePercentage: null,
        totalShares: null,
        availableShares: null,
        pricePerShare: null,
        minInvestment: null,
        maxInvestment: null,
        duration: null,
        fundingProgress: 0,
        investorCount: 0,
        isComingSoon: true,
        channel: {
          id: channel.id,
          channelName: channel.channelName,
          channelUrl: channel.channelUrl,
          analytics: channel.analytics,
          revenueData: channel.revenueData,
        },
        owner: channel.owner,
        createdAt: channel.createdAt,
      };
    });

    // Combine offerings and channels, sort by creation date
    const allItems = [...enrichedOfferings, ...channelItems].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      success: true,
      offerings: allItems, // Keep the same property name for backward compatibility
      total: allItems.length,
    });
  } catch (error) {
    console.error('Marketplace fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch offerings' },
      { status: 500 }
    );
  }
}