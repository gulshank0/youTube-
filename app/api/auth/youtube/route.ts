import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Enhanced YouTube OAuth scopes for comprehensive access
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/youtube.channel-memberships.creator',
  'https://www.googleapis.com/auth/youtubepartner-channel-audit',
];

// Rate limiting map (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function checkRateLimit(userId: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: false, resetTime: userLimit.resetTime };
  }
  
  userLimit.count++;
  return { allowed: true };
}

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

    // Check rate limit
    const rateLimit = checkRateLimit(session.user.id);
    if (!rateLimit.allowed) {
      const resetIn = Math.ceil((rateLimit.resetTime! - Date.now()) / 1000 / 60);
      return NextResponse.json(
        { 
          success: false, 
          error: `Too many attempts. Please try again in ${resetIn} minutes.`,
          rateLimited: true,
          resetTime: rateLimit.resetTime 
        },
        { status: 429 }
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
        refresh_token: true,
      },
    });

    if (!account) {
      return NextResponse.json({
        success: true,
        hasYouTubeAccess: false,
        needsReauth: true,
        message: 'No Google account linked. Please sign out and sign in again.',
        authUrl: generateYouTubeAuthUrl(session.user.id),
      });
    }

    // Check for required YouTube scopes
    const hasRequiredScopes = YOUTUBE_SCOPES.every(scope => 
      account.scope?.includes(scope.split('/').pop() || scope)
    );
    
    if (hasRequiredScopes && account.access_token) {
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      const isExpired = account.expires_at ? account.expires_at < now + 300 : true;
      
      if (!isExpired) {
        return NextResponse.json({
          success: true,
          hasYouTubeAccess: true,
          message: 'YouTube access verified',
          scopes: account.scope?.split(' ') || [],
        });
      } else if (account.refresh_token) {
        return NextResponse.json({
          success: true,
          hasYouTubeAccess: true,
          tokenExpired: true,
          message: 'YouTube access available (token will be refreshed)',
        });
      }
    }

    // Generate authorization URL for missing scopes
    return NextResponse.json({
      success: true,
      hasYouTubeAccess: false,
      needsReauth: true,
      message: 'YouTube channel access required. Please grant permissions.',
      authUrl: generateYouTubeAuthUrl(session.user.id),
      requiredScopes: YOUTUBE_SCOPES,
    });
  } catch (error) {
    console.error('YouTube auth check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check YouTube access' },
      { status: 500 }
    );
  }
}

// POST: Handle OAuth callback and token exchange
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { code, state, error } = await request.json();

    if (error) {
      return NextResponse.json(
        { success: false, error: `OAuth error: ${error}` },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Authorization code required' },
        { status: 400 }
      );
    }

    // Verify state parameter (CSRF protection)
    if (!state || state !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Invalid state parameter' },
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
        { success: false, error: 'Failed to exchange authorization code' },
        { status: 400 }
      );
    }

    // Verify that we received the required scopes
    const grantedScopes = tokens.scope?.split(' ') || [];
    const hasAllRequiredScopes = YOUTUBE_SCOPES.every(scope => 
      grantedScopes.some(granted => granted.includes(scope.split('/').pop() || scope))
    );

    if (!hasAllRequiredScopes) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Required YouTube permissions not granted. Please try again and accept all permissions.',
          grantedScopes,
          requiredScopes: YOUTUBE_SCOPES,
        },
        { status: 400 }
      );
    }

    // Update account with new tokens and scopes
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google',
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Google account not found' },
        { status: 404 }
      );
    }

    // Merge scopes (preserve existing + add new)
    const existingScopes = account.scope?.split(' ') || [];
    const allScopes = [...new Set([...existingScopes, ...grantedScopes])];

    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || account.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        scope: allScopes.join(' '),
      },
    });

    // Log successful authorization for audit
    console.log(`YouTube access granted for user ${session.user.id}:`, {
      scopes: allScopes,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'YouTube access granted successfully',
      scopes: allScopes,
    });
  } catch (error) {
    console.error('YouTube OAuth callback error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process YouTube authorization' },
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
    include_granted_scopes: 'true',
    state: userId, // CSRF protection
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
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
