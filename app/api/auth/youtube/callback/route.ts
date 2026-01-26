import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.redirect(
        new URL('/auth/signin?error=unauthorized', request.url)
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      const errorMessage = error === 'access_denied' 
        ? 'YouTube access was denied. Please grant all required permissions to continue.'
        : `OAuth error: ${error}`;
      
      return NextResponse.redirect(
        new URL(`/creator/onboard?error=${encodeURIComponent(errorMessage)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/creator/onboard?error=No authorization code received', request.url)
      );
    }

    // Verify state parameter (CSRF protection)
    if (!state || state !== session.user.id) {
      return NextResponse.redirect(
        new URL('/creator/onboard?error=Invalid state parameter', request.url)
      );
    }

    // Process the OAuth callback through our API
    const callbackResponse = await fetch(`${request.nextUrl.origin}/api/auth/youtube`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ code, state }),
    });

    const result = await callbackResponse.json();

    if (result.success) {
      // Successful authorization - redirect to onboarding with success message
      return NextResponse.redirect(
        new URL('/creator/onboard?youtube_success=true', request.url)
      );
    } else {
      // Authorization failed - redirect with error
      const errorMessage = result.error || 'Failed to process YouTube authorization';
      return NextResponse.redirect(
        new URL(`/creator/onboard?error=${encodeURIComponent(errorMessage)}`, request.url)
      );
    }
  } catch (error) {
    console.error('YouTube OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/creator/onboard?error=Authorization callback failed', request.url)
    );
  }
}