import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// YouTube OAuth scopes needed for channel access
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

// GET: Check if user has YouTube access and return authorization URL if not
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user already has YouTube scope
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google',
      },
      select: {
        scope: true,
        access_token: true,
        expires_at: true,
      },
    });

    if (!account) {
      return NextResponse.json({
        success: true,
        hasYouTubeAccess: false,
        needsReauth: true,
        message: 'No Google account linked',
      });
    }

    const hasYouTubeScope = account.scope?.includes('youtube');
    
    if (hasYouTubeScope && account.access_token) {
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      const isExpired = account.expires_at ? account.expires_at < now : true;
      
      return NextResponse.json({
        success: true,
        hasYouTubeAccess: !isExpired,
        needsReauth: isExpired,
        message: isExpired ? 'YouTube access token expired' : 'YouTube access granted',
      });
    }

    // Generate authorization URL for YouTube scope
    const authUrl = generateYouTubeAuthUrl(session.user.id);

    return NextResponse.json({
      success: true,
      hasYouTubeAccess: false,
      needsReauth: true,
      authUrl,
      message: 'YouTube access not authorized',
    });
  } catch (error) {
    console.error('YouTube auth check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check YouTube access' },
      { status: 500 }
    );
  }
}

// POST: Handle the OAuth callback and store tokens
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Authorization code required' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/youtube/callback`,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokens);
      return NextResponse.json(
        { success: false, error: tokens.error_description || 'Token exchange failed' },
        { status: 400 }
      );
    }

    // Update the account with new tokens and scopes
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google',
      },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, error: 'No Google account found' },
        { status: 404 }
      );
    }

    // Merge existing scopes with new YouTube scopes
    const existingScopes = existingAccount.scope?.split(' ') || [];
    const newScopes = tokens.scope?.split(' ') || [];
    const mergedScopes = [...new Set([...existingScopes, ...newScopes])].join(' ');

    await prisma.account.update({
      where: { id: existingAccount.id },
      data: {
        access_token: tokens.access_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        refresh_token: tokens.refresh_token || existingAccount.refresh_token,
        scope: mergedScopes,
        token_type: tokens.token_type,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'YouTube access granted successfully',
    });
  } catch (error) {
    console.error('YouTube auth callback error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to complete YouTube authorization' },
      { status: 500 }
    );
  }
}

function generateYouTubeAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/youtube/callback`,
    response_type: 'code',
    scope: YOUTUBE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: userId, // Used to verify the callback
    include_granted_scopes: 'true', // Important: merge with existing scopes
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
