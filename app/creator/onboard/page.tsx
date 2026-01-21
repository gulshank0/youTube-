'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  Video, 
  IndianRupee, 
  Users, 
  AlertCircle, 
  Loader2,
  ArrowRight,
  Sparkles
} from 'lucide-react';

// Types
interface ChannelData {
  id: string;
  youtubeChannelId: string;
  channelName: string;
  analytics: {
    subscriberCount?: number;
    viewCount?: number;
    videoCount?: number;
    title?: string;
  };
}

interface OnboardingState {
  channelConnected: boolean;
  offeringCreated: boolean;
  channel: ChannelData | null;
}

// Helper function to get step class names
const getStepClassName = (isActive: boolean, isPast: boolean): string => {
  if (isActive) return 'bg-red-600/10 border border-red-600/50';
  if (isPast) return 'bg-green-600/10 border border-green-600/50';
  return 'bg-zinc-900 border border-zinc-800';
};

const getStepIconClassName = (isActive: boolean, isPast: boolean): string => {
  if (isPast) return 'bg-green-600';
  if (isActive) return 'bg-red-600';
  return 'bg-zinc-800';
};

const getStepTextClassName = (isActive: boolean, isPast: boolean): string => {
  if (isPast) return 'text-green-400';
  if (isActive) return 'text-red-400';
  return 'text-gray-600';
};

// Skeleton Loader Component
const SkeletonCard = () => (
  <div className="youtube-card p-6 animate-pulse">
    <div className="h-6 bg-zinc-800 rounded w-1/3 mb-4"></div>
    <div className="h-4 bg-zinc-800 rounded w-2/3 mb-2"></div>
    <div className="h-4 bg-zinc-800 rounded w-1/2"></div>
  </div>
);

// Progress Step Component
const ProgressStep = ({ 
  step, 
  current, 
  completed, 
  title, 
  icon: Icon 
}: { 
  step: number; 
  current: number; 
  completed: boolean; 
  title: string; 
  icon: React.ElementType;
}) => {
  const isActive = step === current;
  const isPast = step < current || completed;
  
  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg transition-all ${getStepClassName(isActive, isPast)}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStepIconClassName(isActive, isPast)}`}>
        {isPast ? (
          <CheckCircle className="h-5 w-5 text-white" />
        ) : (
          <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
        )}
      </div>
      <div>
        <p className={`font-medium ${isPast || isActive ? 'text-white' : 'text-gray-500'}`}>
          Step {step}
        </p>
        <p className={`text-sm ${getStepTextClassName(isActive, isPast)}`}>
          {title}
        </p>
      </div>
    </div>
  );
};

export default function CreatorOnboardPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Core state
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Onboarding state
  const [state, setState] = useState<OnboardingState>({
    channelConnected: false,
    offeringCreated: false,
    channel: null,
  });

  // Form states
  const [youtubeChannelId, setYoutubeChannelId] = useState('');
  const [offeringData, setOfferingData] = useState({
    title: '',
    description: '',
    sharePercentage: 10,
    totalShares: 1000,
    pricePerShare: 100,
    minInvestment: 500,
    maxInvestment: 10000,
    duration: 24,
  });

  // Check progress on mount - optimized single call pattern
  const checkProgress = useCallback(async () => {
    if (!session?.user) return;
    
    try {
      setLoading(true);
      
      // Parallel API calls for better performance
      const [channelRes, offeringRes] = await Promise.all([
        fetch('/api/creator/channel'),
        fetch('/api/creator/offering'),
      ]);

      const [channelResult, offeringResult] = await Promise.all([
        channelRes.json(),
        offeringRes.json(),
      ]);

      const hasChannel = channelResult.success && channelResult.channels?.length > 0;
      const hasOffering = offeringResult.success && offeringResult.offerings?.length > 0;

      setState({
        channelConnected: hasChannel,
        offeringCreated: hasOffering,
        channel: hasChannel ? channelResult.channels[0] : null,
      });

      // Determine current step
      if (!hasChannel) {
        setCurrentStep(1);
      } else if (hasOffering) {
        setCurrentStep(3);
      } else {
        setCurrentStep(2);
        // Pre-fill offering title from channel name
        if (channelResult.channels[0]?.channelName) {
          setOfferingData(prev => ({
            ...prev,
            title: `Invest in ${channelResult.channels[0].channelName}`,
          }));
        }
      }
    } catch (err) {
      console.error('Progress check error:', err);
      setError('Failed to load progress. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  // Handle OAuth callback
  useEffect(() => {
    const youtubeSuccess = searchParams.get('youtube_success');
    const youtubeError = searchParams.get('youtube_error');
    
    if (youtubeError) {
      setError(decodeURIComponent(youtubeError));
      globalThis.history.replaceState({}, '', '/creator/onboard');
    } else if (youtubeSuccess) {
      setError('');
      globalThis.history.replaceState({}, '', '/creator/onboard');
      // Refresh progress after successful auth
      checkProgress();
    }
  }, [searchParams, checkProgress]);

  // Initial load
  useEffect(() => {
    if (session?.user) {
      checkProgress();
    } else if (authStatus !== 'loading') {
      setLoading(false);
    }
  }, [session?.user, authStatus, checkProgress]);

  // Connect YouTube Channel
  const handleChannelConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeChannelId.trim()) {
      setError('Please enter your YouTube Channel ID');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // First check if we need YouTube OAuth
      const authCheck = await fetch('/api/auth/youtube');
      const authResult = await authCheck.json();

      if (!authResult.hasYouTubeAccess && authResult.authUrl) {
        // Redirect to YouTube OAuth
        globalThis.location.href = authResult.authUrl;
        return;
      }

      // Connect channel
      const response = await fetch('/api/creator/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeChannelId: youtubeChannelId.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        setState(prev => ({
          ...prev,
          channelConnected: true,
          channel: result.channel,
        }));
        setOfferingData(prev => ({
          ...prev,
          title: `Invest in ${result.channel.channelName || 'My Channel'}`,
        }));
        setCurrentStep(2);
      } else if (result.requiresReauth && result.authUrl) {
        globalThis.location.href = result.authUrl;
      } else {
        setError(result.error || 'Failed to connect channel');
      }
    } catch (err) {
      console.error('Channel connect error:', err);
      setError('Failed to connect channel. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Create Offering
  const handleOfferingCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.channel) {
      setError('Please connect your channel first');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/creator/offering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...offeringData,
          channelId: state.channel.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setState(prev => ({ ...prev, offeringCreated: true }));
        setCurrentStep(3);
      } else {
        setError(result.error || 'Failed to create offering');
      }
    } catch (err) {
      console.error('Offering creation error:', err);
      setError('Failed to create offering. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Auth loading state
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
      </div>
    );
  }

  // Not signed in
  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 py-16 px-4">
        <div className="max-w-xl mx-auto text-center space-y-8">
          <Video className="h-16 w-16 text-red-600 mx-auto" />
          <h1 className="text-4xl font-bold text-white">
            Become a Creator
          </h1>
          <p className="text-xl text-gray-400">
            Sign in with Google to start monetizing your YouTube channel
          </p>
          <Button 
            className="youtube-button text-lg px-8 py-4 h-auto" 
            onClick={() => router.push('/auth/signin?callbackUrl=/creator/onboard')}
          >
            Sign In with Google
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  // Loading progress
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 py-16 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Creator Onboarding
            </h1>
            <p className="text-gray-400">Loading your progress...</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Creator <span className="text-red-600">Onboarding</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Connect your channel and create your investment offering in minutes
          </p>
        </div>

        {/* Progress Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ProgressStep 
            step={1} 
            current={currentStep} 
            completed={state.channelConnected}
            title="Connect Channel"
            icon={Video}
          />
          <ProgressStep 
            step={2} 
            current={currentStep} 
            completed={state.offeringCreated}
            title="Create Offering"
            icon={IndianRupee}
          />
          <ProgressStep 
            step={3} 
            current={currentStep} 
            completed={currentStep === 3}
            title="Go Live"
            icon={Users}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-950/30 border border-red-600/50 rounded-lg p-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
              <button 
                onClick={() => setError('')}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Connect YouTube Channel */}
        {currentStep === 1 && (
          <div className="youtube-card">
            <div className="p-6 md:p-8 border-b border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <Video className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-bold text-white">Connect Your YouTube Channel</h2>
              </div>
              <p className="text-gray-400">
                Link your channel to enable revenue sharing with investors
              </p>
            </div>

            <form onSubmit={handleChannelConnect} className="p-6 md:p-8 space-y-6">
              <div>
                <label htmlFor="youtube-channel-id" className="block text-sm font-medium text-gray-300 mb-2">
                  YouTube Channel ID
                </label>
                <input
                  id="youtube-channel-id"
                  type="text"
                  required
                  value={youtubeChannelId}
                  onChange={(e) => setYoutubeChannelId(e.target.value)}
                  placeholder="UCxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-lg focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Find it at: YouTube Studio → Settings → Channel → Advanced Settings
                </p>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                <h3 className="font-medium text-white mb-3">What happens next?</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                    <span>We&apos;ll verify you own the channel</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                    <span>Fetch your channel analytics (subscribers, views)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                    <span>You&apos;ll be redirected to Google for authorization</span>
                  </li>
                </ul>
              </div>

              <Button 
                type="submit" 
                disabled={submitting}
                className="youtube-button w-full text-lg py-6 h-auto"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect Channel
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Step 2: Create Offering */}
        {currentStep === 2 && (
          <div className="youtube-card">
            <div className="p-6 md:p-8 border-b border-zinc-800">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="h-6 w-6 text-red-600" />
                <h2 className="text-2xl font-bold text-white">Create Your Offering</h2>
              </div>
              <p className="text-gray-400">
                Set your revenue sharing terms for investors
              </p>
            </div>

            <form onSubmit={handleOfferingCreate} className="p-6 md:p-8 space-y-6">
              {/* Connected Channel Info */}
              {state.channel && (
                <div className="bg-green-950/20 border border-green-600/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <div>
                      <p className="font-medium text-white">{state.channel.channelName}</p>
                      <p className="text-sm text-gray-400">
                        {(state.channel.analytics?.subscriberCount || 0).toLocaleString()} subscribers • {(state.channel.analytics?.videoCount || 0).toLocaleString()} videos
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="offering-title" className="block text-sm font-medium text-gray-300 mb-2">
                    Offering Title
                  </label>
                  <input
                    id="offering-title"
                    type="text"
                    required
                    value={offeringData.title}
                    onChange={(e) => setOfferingData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Invest in My Gaming Channel"
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:border-red-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="offering-description" className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    id="offering-description"
                    required
                    value={offeringData.description}
                    onChange={(e) => setOfferingData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Tell investors about your channel and growth plans..."
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:border-red-600 focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Key Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="share-percentage" className="block text-sm font-medium text-gray-300 mb-2">
                    Revenue Share %
                  </label>
                  <input
                    id="share-percentage"
                    type="number"
                    required
                    min="1"
                    max="50"
                    value={offeringData.sharePercentage}
                    onChange={(e) => setOfferingData(prev => ({ ...prev, sharePercentage: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:border-red-600 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Share of revenue for investors (1-50%)</p>
                </div>

                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-gray-300 mb-2">
                    Duration (months)
                  </label>
                  <input
                    id="duration"
                    type="number"
                    required
                    min="12"
                    max="60"
                    value={offeringData.duration}
                    onChange={(e) => setOfferingData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:border-red-600 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">How long investors receive payouts</p>
                </div>

                <div>
                  <label htmlFor="price-per-share" className="block text-sm font-medium text-gray-300 mb-2">
                    Price per Share (₹)
                  </label>
                  <input
                    id="price-per-share"
                    type="number"
                    required
                    min="10"
                    value={offeringData.pricePerShare}
                    onChange={(e) => setOfferingData(prev => ({ ...prev, pricePerShare: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:border-red-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="total-shares" className="block text-sm font-medium text-gray-300 mb-2">
                    Total Shares
                  </label>
                  <input
                    id="total-shares"
                    type="number"
                    required
                    min="100"
                    value={offeringData.totalShares}
                    onChange={(e) => setOfferingData(prev => ({ ...prev, totalShares: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white focus:border-red-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-linear-to-r from-red-950/30 to-zinc-900 border border-red-600/30 rounded-lg p-5">
                <h3 className="font-semibold text-white mb-3">Offering Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Funding Goal</p>
                    <p className="text-xl font-bold text-white">
                      ₹{(offeringData.totalShares * offeringData.pricePerShare).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Revenue Share</p>
                    <p className="text-xl font-bold text-white">
                      {offeringData.sharePercentage}% for {offeringData.duration}mo
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 border-zinc-700 text-gray-300 hover:bg-zinc-800 hover:text-white py-6"
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="youtube-button flex-1 text-lg py-6 h-auto"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Offering
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Success */}
        {currentStep === 3 && (
          <div className="youtube-card">
            <div className="p-8 md:p-12 text-center space-y-6">
              <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-10 w-10 text-green-400" />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-3xl font-bold text-white">You&apos;re Live! 🎉</h2>
                <p className="text-lg text-gray-400 max-w-xl mx-auto">
                  Congratulations! Your offering is <span className="text-green-400 font-semibold">instantly live</span> on the marketplace — no approval needed! Investors can start investing right now.
                </p>
              </div>

              <div className="bg-green-950/30 border border-green-600/30 rounded-lg p-4 max-w-md mx-auto">
                <h3 className="font-medium text-green-400 mb-2">✓ Onboarding Complete</h3>
                <ul className="text-sm text-gray-300 text-left space-y-2">
                  <li>• Your offering is <span className="text-green-400">live</span> in the marketplace</li>
                  <li>• Investors can purchase shares immediately</li>
                  <li>• Track investments from your creator dashboard</li>
                  <li>• Complete KYC before your first payout</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button 
                  onClick={() => router.push('/dashboard/creator')}
                  className="youtube-button text-lg px-8 py-4 h-auto"
                >
                  Go to Dashboard
                </Button>
                <Button 
                  onClick={() => router.push('/marketplace')}
                  variant="outline"
                  className="border-zinc-700 text-black hover:bg-zinc-800 text-lg px-8 py-4 h-auto"
                >
                  View Marketplace
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Benefits - Show on step 1 and 2 only */}
        {currentStep < 3 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="youtube-card p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Keep Full Control</h3>
                  <p className="text-sm text-gray-400">Maintain creative freedom and channel ownership</p>
                </div>
              </div>
            </div>
            <div className="youtube-card p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center shrink-0">
                  <IndianRupee className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Upfront Capital</h3>
                  <p className="text-sm text-gray-400">Get funding now for equipment and growth</p>
                </div>
              </div>
            </div>
            <div className="youtube-card p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Community Investors</h3>
                  <p className="text-sm text-gray-400">Your fans become invested in your success</p>
                </div>
              </div>
            </div>
            <div className="youtube-card p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Simple Process</h3>
                  <p className="text-sm text-gray-400">No complex paperwork or lengthy approvals</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}