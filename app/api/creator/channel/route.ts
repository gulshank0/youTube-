import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { YouTubeService } from '@/lib/services/youtube';

// Rate limiting for channel connections
const channelRateLimitMap = new Map<string, { count: number; resetTime: number }>();
const CHANNEL_RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const CHANNEL_RATE_LIMIT_MAX_ATTEMPTS = 3;

function checkChannelRateLimit(userId: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const userLimit = channelRateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    channelRateLimitMap.set(userId, { count: 1, resetTime: now + CHANNEL_RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (userLimit.count >= CHANNEL_RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: false, resetTime: userLimit.resetTime };
  }
  
  userLimit.count++;
  return { allowed: true };
}

// Helper function to refresh access token if expired
async function getValidAccessToken(account: {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
}): Promise<string | null> {
  // Check if token is expired (with 5 minute buffer)
  const now = Math.floor(Date.now() / 1000);
  const isExpired = account.expires_at ? account.expires_at < now + 300 : true;

  if (!isExpired && account.access_token) {
    return account.access_token;
  }

  // Token is expired, try to refresh
  if (!account.refresh_token) {
    console.error('No refresh token available');
    return null;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
      }),
    });

    const tokens = await response.json();

    if (!response.ok) {
      console.error('Token refresh failed:', tokens);
      return null;
    }

    // Update the account with new tokens
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: tokens.access_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        // refresh_token is only returned if it changed
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
      },
    });

    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check rate limit
    const rateLimit = checkChannelRateLimit(session.user.id);
    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetTime! - Date.now()) / 1000 / 60);
      return NextResponse.json(
        { 
          success: false, 
          error: `Too many channel connection attempts. Please try again in ${resetIn} minutes.`,
          rateLimited: true 
        },
        { status: 429 }
      );
    }

    const { youtubeChannelId, skipOwnershipCheck } = await request.json();

    if (!youtubeChannelId) {
      return NextResponse.json(
        { success: false, error: 'YouTube Channel ID is required' },
        { status: 400 }
      );
    }

    // Validate channel ID format
    if (!youtubeChannelId.match(/^UC[a-zA-Z0-9_-]{22}$/)) {
      return NextResponse.json(
        { success: false, error: 'Invalid YouTube Channel ID format' },
        { status: 400 }
      );
    }

    // Check if channel is already registered by another user
    const existingChannel = await prisma.channel.findUnique({
      where: { youtubeChannelId },
      include: { owner: { select: { id: true, name: true, email: true } } },
    });

    if (existingChannel && existingChannel.ownerId !== session.user.id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'This channel is already registered by another user. If you believe this is an error, please contact support.',
          conflictType: 'DUPLICATE_CHANNEL'
        },
        { status: 409 }
      );
    }

    // Get user's OAuth token
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google',
      },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'YouTube authentication required. Please grant YouTube permissions first.',
          requiresAuth: true 
        },
        { status: 401 }
      );
    }

    // Check if the account has YouTube scope
    const hasYouTubeScope = account.scope?.includes('youtube');
    if (!hasYouTubeScope) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'YouTube channel access not authorized. Please grant YouTube permissions.',
          requiresReauth: true,
          authUrl: generateYouTubeAuthUrl(session.user.id),
        },
        { status: 403 }
      );
    }

    // Get a valid (refreshed if necessary) access token
    const accessToken = await getValidAccessToken({
      id: account.id,
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expires_at: account.expires_at,
    });

    if (!accessToken) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'YouTube authentication expired. Please re-authorize YouTube access.',
          requiresReauth: true 
        },
        { status: 401 }
      );
    }

    // Initialize YouTube service with refreshed token
    const youtubeService = new YouTubeService(accessToken, account.refresh_token || undefined);

    // Enhanced channel verification with ownership check
    let verificationResult;
    try {
      verificationResult = await youtubeService.verifyChannelOwnership(
        session.user.id,
        youtubeChannelId
      );
    } catch (error: unknown) {
      console.error('Channel verification error:', error);
      const gaxiosError = error as { code?: number; errors?: Array<{ reason?: string }> };
      
      if (gaxiosError.code === 403) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Insufficient YouTube permissions. Please re-authorize with all required permissions.',
            requiresReauth: true,
            authUrl: generateYouTubeAuthUrl(session.user.id),
          },
          { status: 403 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: 'Failed to verify channel. Please try again.' },
        { status: 500 }
      );
    }

    if (!verificationResult.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: verificationResult.error || 'Channel not found or invalid.',
          verificationDetails: verificationResult 
        },
        { status: 404 }
      );
    }

    if (!verificationResult.isOwned && !skipOwnershipCheck) {
      return NextResponse.json(
        { 
          success: false, 
          error: verificationResult.error || 'Channel ownership could not be verified.',
          verificationDetails: verificationResult,
          requiresOwnershipVerification: true 
        },
        { status: 403 }
      );
    }

    const channel = verificationResult.channel;

    // Get enhanced analytics with requirements check
    const analytics = await youtubeService.getChannelAnalytics(youtubeChannelId);
    
    // Check monetization status
    const monetizationStatus = await youtubeService.checkMonetizationStatus(youtubeChannelId);
    
    // Get recent videos
    const recentVideos = await youtubeService.getRecentVideos(youtubeChannelId, 10);
    
    // Get revenue data (actual or estimated)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const revenueData = await youtubeService.getActualRevenueData(
      youtubeChannelId,
      startDate,
      endDate
    );

    // Determine channel status based on requirements
    let channelStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' = 'PENDING';
    const requirementsSummary = analytics.requirementsSummary;
    
    if (requirementsSummary.passed >= requirementsSummary.total - 1) {
      // Allow if most requirements are met
      channelStatus = 'VERIFIED';
    } else if (requirementsSummary.passed < 2) {
      // Reject if too few requirements met
      channelStatus = 'REJECTED';
    }

    // Create or update channel record
    const channelRecord = await prisma.channel.upsert({
      where: { youtubeChannelId },
      update: {
        verified: channelStatus === 'VERIFIED',
        analytics: JSON.parse(JSON.stringify({
          ...analytics,
          recentVideos,
          monetizationStatus,
          lastUpdated: new Date().toISOString(),
        })),
        revenueData: JSON.parse(JSON.stringify(revenueData)),
        status: channelStatus,
        updatedAt: new Date(),
      },
      create: {
        youtubeChannelId,
        channelName: analytics.title || 'Unknown Channel',
        channelUrl: `https://youtube.com/channel/${youtubeChannelId}`,
        ownerId: session.user.id,
        verified: channelStatus === 'VERIFIED',
        analytics: JSON.parse(JSON.stringify({
          ...analytics,
          recentVideos,
          monetizationStatus,
          lastUpdated: new Date().toISOString(),
        })),
        revenueData: JSON.parse(JSON.stringify(revenueData)),
        status: channelStatus,
      },
    });

    // Update user role to CREATOR if channel is verified
    if (channelStatus === 'VERIFIED') {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { role: 'CREATOR' },
      });
    }

    // Log successful channel connection for audit
    console.log(`Channel connected for user ${session.user.id}:`, {
      channelId: youtubeChannelId,
      channelName: analytics.title,
      status: channelStatus,
      requirements: requirementsSummary,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      channel: channelRecord,
      analytics,
      revenueData,
      monetizationStatus,
      verificationDetails: verificationResult,
      status: channelStatus,
      message: channelStatus === 'VERIFIED' 
        ? 'Channel verified successfully!' 
        : channelStatus === 'REJECTED'
        ? 'Channel does not meet minimum requirements.'
        : 'Channel submitted for review.',
    });
  } catch (error) {
    console.error('Channel connection error:', error);
    return NextResponse.json(
      { success: false, error: 'Channel connection failed. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'owned-channels') {
      // Get user's owned channels from YouTube
      const account = await prisma.account.findFirst({
        where: {
          userId: session.user.id,
          provider: 'google',
        },
      });

      if (!account?.access_token) {
        return NextResponse.json({
          success: false,
          error: 'YouTube authentication required',
          requiresAuth: true,
        });
      }

      const accessToken = await getValidAccessToken({
        id: account.id,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
      });

      if (!accessToken) {
        return NextResponse.json({
          success: false,
          error: 'YouTube authentication expired',
          requiresReauth: true,
        });
      }

      const youtubeService = new YouTubeService(accessToken, account.refresh_token || undefined);
      const ownedChannels = await youtubeService.getOwnedChannels();

      return NextResponse.json({
        success: true,
        channels: ownedChannels,
      });
    }

    // Default: Get user's registered channels
    const channels = await prisma.channel.findMany({
      where: { ownerId: session.user.id },
      include: {
        offerings: {
          select: {
            id: true,
            status: true,
            totalShares: true,
            availableShares: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      channels,
    });
  } catch (error) {
    console.error('Channel fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}

// YouTube OAuth scopes needed for channel access
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

function generateYouTubeAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/youtube/callback`,
    response_type: 'code',
    scope: YOUTUBE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: userId,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
    const hasYouTubeScope = account.scope?.includes('youtube');
    if (!hasYouTubeScope) {
      // Generate authorization URL for the client to redirect
      const authUrl = generateYouTubeAuthUrl();
      return NextResponse.json(
        { 
          success: false, 
          error: 'YouTube channel access not authorized. Please grant YouTube permissions to continue.',
          requiresReauth: true,
          authUrl,
        },
        { status: 403 }
      );
    }

    // Get a valid (refreshed if necessary) access token
    const accessToken = await getValidAccessToken({
      id: account.id,
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expires_at: account.expires_at,
    });

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'YouTube authentication expired. Please sign out and sign in again to refresh your access.' },
        { status: 401 }
      );
    }

    // Initialize YouTube service with refreshed token
    const youtubeService = new YouTubeService(accessToken, account.refresh_token || undefined);

    // Verify channel exists and is valid
    let isValid: boolean;
    try {
      isValid = await youtubeService.verifyChannelOwnership(
        session.user.id,
        youtubeChannelId
      );
    } catch (error: unknown) {
      // Check for insufficient permissions error (missing YouTube scope)
      const gaxiosError = error as { code?: number; errors?: Array<{ reason?: string }> };
      if (gaxiosError.code === 403 && gaxiosError.errors?.some(e => e.reason === 'insufficientPermissions')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'YouTube access not authorized. Please sign out completely and sign in again to grant YouTube channel access.',
            requiresReauth: true
          },
          { status: 403 }
        );
      }
      throw error;
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Channel not found. Please check your Channel ID and try again.' },
        { status: 403 }
      );
    }

    // Fetch channel analytics
    const analytics = await youtubeService.getChannelAnalytics(youtubeChannelId);
    const recentVideos = await youtubeService.getRecentVideos(youtubeChannelId, 10);
    
    // Get revenue estimate
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const revenueData = await youtubeService.getRevenueData(
      youtubeChannelId,
      startDate,
      endDate
    );

    // Create or update channel record
    const channel = await prisma.channel.upsert({
      where: { youtubeChannelId },
      update: {
        verified: true,
        analytics: JSON.parse(JSON.stringify({
          ...analytics,
          recentVideos,
        })),
        revenueData: JSON.parse(JSON.stringify(revenueData)),
        status: 'VERIFIED',
      },
      create: {
        youtubeChannelId,
        channelName: analytics.title || 'Unknown Channel',
        channelUrl: `https://youtube.com/channel/${youtubeChannelId}`,
        ownerId: session.user.id,
        verified: true,
        analytics: JSON.parse(JSON.stringify({
          ...analytics,
          recentVideos,
        })),
        revenueData: JSON.parse(JSON.stringify(revenueData)),
        status: 'VERIFIED',
      },
    });

    // Update user role to CREATOR
    await prisma.user.update({
      where: { id: session.user.id },
      data: { role: 'CREATOR' },
    });

    return NextResponse.json({
      success: true,
      channel,
      analytics,
      revenueData,
    });
  } catch (error) {
    console.error('Channel verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Channel verification failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const channels = await prisma.channel.findMany({
      where: { ownerId: session.user.id },
      include: {
        offerings: {
          select: {
            id: true,
            status: true,
            totalShares: true,
            availableShares: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      channels,
    });
  } catch (error) {
    console.error('Channel fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}

// YouTube OAuth scopes needed for channel access
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

function generateYouTubeAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/youtube/callback`,
    response_type: 'code',
    scope: YOUTUBE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
