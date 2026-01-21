import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Handle the OAuth callback from Google for YouTube scope
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state'); // Contains the user ID

    // Handle errors from Google
    if (error) {
      console.error('YouTube OAuth error:', error);
      const errorMessage = encodeURIComponent('YouTube authorization was cancelled or failed.');
      return NextResponse.redirect(
        new URL(`/creator/onboard?youtube_error=${errorMessage}`, process.env.NEXTAUTH_URL)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/creator/onboard?youtube_error=No%20authorization%20code%20received', process.env.NEXTAUTH_URL)
      );
    }

    // Get the current session to verify the user
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.redirect(
        new URL('/auth/signin?callbackUrl=/creator/onboard', process.env.NEXTAUTH_URL)
      );
    }

    // Verify state matches the user ID (security check)
    if (state && state !== session.user.id) {
      console.warn('State mismatch in YouTube OAuth callback');
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
      const errorMessage = encodeURIComponent(tokens.error_description || 'Failed to exchange authorization code');
      return NextResponse.redirect(
        new URL(`/creator/onboard?youtube_error=${errorMessage}`, process.env.NEXTAUTH_URL)
      );
    }

    // Get the existing Google account
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google',
      },
    });

    if (!existingAccount) {
      return NextResponse.redirect(
        new URL('/creator/onboard?youtube_error=No%20Google%20account%20found', process.env.NEXTAUTH_URL)
      );
    }

    // Merge existing scopes with new YouTube scopes
    const existingScopes = existingAccount.scope?.split(' ') || [];
    const newScopes = tokens.scope?.split(' ') || [];
    const mergedScopes = [...new Set([...existingScopes, ...newScopes])].join(' ');

    // Update the account with new tokens and scopes
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

    // Redirect back to onboarding with success
    return NextResponse.redirect(
      new URL('/creator/onboard?youtube_success=true', process.env.NEXTAUTH_URL)
    );
  } catch (error) {
    console.error('YouTube callback error:', error);
    return NextResponse.redirect(
      new URL('/creator/onboard?youtube_error=An%20unexpected%20error%20occurred', process.env.NEXTAUTH_URL)
    );
  }
}
