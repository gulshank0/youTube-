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
  Sparkles,
  Shield,
  Eye,
  Clock,
  Search,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Info
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
    meetsRequirements?: {
      minSubscribers: boolean;
      minViews: boolean;
      minVideos: boolean;
      hasDescription: boolean;
      hasCustomUrl: boolean;
    };
    requirementsSummary?: {
      total: number;
      passed: number;
    };
  };
}

interface OnboardingState {
  channelConnected: boolean;
  offeringCreated: boolean;
  channel: ChannelData | null;
}

interface OwnedChannel {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: { url: string };
    };
  };
  statistics: {
    subscriberCount: string;
    viewCount: string;
    videoCount: string;
  };
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

// Requirements Check Component
const RequirementsCheck = ({ requirements, summary }: { 
  requirements?: any; 
  summary?: { total: number; passed: number } 
}) => {
  if (!requirements || !summary) return null;

  const items = [
    { key: 'minSubscribers', label: '1,000+ Subscribers', icon: Users },
    { key: 'minViews', label: '4,000+ Watch Hours', icon: Eye },
    { key: 'minVideos', label: '5+ Videos', icon: Video },
    { key: 'hasDescription', label: 'Channel Description', icon: Info },
    { key: 'hasCustomUrl', label: 'Custom URL', icon: ExternalLink },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-white">Channel Requirements</h4>
        <span className={`text-sm px-2 py-1 rounded ${
          summary.passed >= summary.total - 1 
            ? 'bg-green-600/20 text-green-400' 
            : summary.passed >= 2
            ? 'bg-yellow-600/20 text-yellow-400'
            : 'bg-red-600/20 text-red-400'
        }`}>
          {summary.passed}/{summary.total} Met
        </span>
      </div>
      <div className="space-y-2">
        {items.map(item => {
          const Icon = item.icon;
          const met = requirements[item.key];
          return (
            <div key={item.key} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                met ? 'bg-green-600' : 'bg-zinc-700'
              }`}>
                {met && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              <Icon className={`w-4 h-4 ${met ? 'text-green-400' : 'text-gray-500'}`} />
              <span className={`text-sm ${met ? 'text-white' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function CreatorOnboardPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [youtubeChannelId, setYoutubeChannelId] = useState('');
  const [showChannelSelector, setShowChannelSelector] = useState(false);
  const [ownedChannels, setOwnedChannels] = useState<OwnedChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [youtubeAuthStatus, setYoutubeAuthStatus] = useState<{
    hasAccess: boolean;
    authUrl?: string;
    scopes?: string[];
  }>({ hasAccess: false });

  const [state, setState] = useState<OnboardingState>({
    channelConnected: false,
    offeringCreated: false,
    channel: null,
  });

  const [offeringData, setOfferingData] = useState({
    title: '',
    description: '',
    sharePercentage: 20,
    totalShares: 10000,
    pricePerShare: 10,
    minInvestment: 1000,
    maxInvestment: 50000,
    duration: 24,
  });

  // Check progress on load
  const checkProgress = useCallback(async () => {
    try {
      const [channelRes, youtubeRes] = await Promise.all([
        fetch('/api/creator/channel'),
        fetch('/api/auth/youtube')
      ]);
      
      const channelData = await channelRes.json();
      const youtubeData = await youtubeRes.json();
      
      setYoutubeAuthStatus({
        hasAccess: youtubeData.hasYouTubeAccess || false,
        authUrl: youtubeData.authUrl,
        scopes: youtubeData.scopes,
      });

      if (channelData.success && channelData.channels?.length > 0) {
        const channel = channelData.channels[0];
        setState(prev => ({
          ...prev,
          channelConnected: true,
          channel,
        }));
        setCurrentStep(2);
        
        // Check if they have offerings
        if (channel.offerings?.length > 0) {
          setState(prev => ({ ...prev, offeringCreated: true }));
          setCurrentStep(3);
        }
      }
    } catch (err) {
      console.error('Progress check error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (session?.user) {
      checkProgress();
    } else if (authStatus !== 'loading') {
      setLoading(false);
    }
  }, [session?.user, authStatus, checkProgress]);

  // Load owned channels
  const loadOwnedChannels = async () => {
    setLoadingChannels(true);
    try {
      const res = await fetch('/api/creator/channel?action=owned-channels');
      const data = await res.json();
      
      if (data.success) {
        setOwnedChannels(data.channels || []);
        setShowChannelSelector(true);
      } else if (data.requiresAuth || data.requiresReauth) {
        // Need to authorize YouTube access first
        setError('Please authorize YouTube access first');
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      } else {
        setError(data.error || 'Failed to load channels');
      }
    } catch (err) {
      console.error('Load channels error:', err);
      setError('Failed to load your channels');
    } finally {
      setLoadingChannels(false);
    }
  };

  // Connect YouTube Channel
  const handleChannelConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeChannelId.trim()) {
      setError('Please enter your YouTube Channel ID or select from your channels');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // First check YouTube auth status
      if (!youtubeAuthStatus.hasAccess) {
        const authCheck = await fetch('/api/auth/youtube');
        const authResult = await authCheck.json();

        if (!authResult.hasYouTubeAccess && authResult.authUrl) {
          // Redirect to YouTube OAuth
          window.location.href = authResult.authUrl;
          return;
        }
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
        
        if (result.status === 'VERIFIED') {
          setCurrentStep(2);
        } else if (result.status === 'REJECTED') {
          setError('Channel does not meet minimum requirements. Please check the requirements below.');
        } else {
          setError('Channel submitted for review. You will be notified once approved.');
        }
      } else if (result.requiresReauth && result.authUrl) {
        window.location.href = result.authUrl;
      } else if (result.rateLimited) {
        setError(result.error);
      } else if (result.conflictType === 'DUPLICATE_CHANNEL') {
        setError(result.error);
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
    <div className="min-h-screen bg-zinc-950 py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Creator Onboarding
          </h1>
          <p className="text-gray-400 text-lg">
            Connect your YouTube channel and start earning from your content
          </p>
        </div>

        {/* Progress Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ProgressStep 
            step={1} 
            current={currentStep} 
            completed={state.channelConnected}
            title="Connect YouTube Channel"
            icon={Video}
          />
          <ProgressStep 
            step={2} 
            current={currentStep} 
            completed={state.offeringCreated}
            title="Create Investment Offering"
            icon={IndianRupee}
          />
          <ProgressStep 
            step={3} 
            current={currentStep} 
            completed={state.offeringCreated}
            title="Go Live"
            icon={Sparkles}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Error</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Connect YouTube Channel */}
        {currentStep === 1 && (
          <div className="youtube-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                <Video className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Connect Your YouTube Channel</h2>
                <p className="text-gray-400">Verify ownership and grant analytics access</p>
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-blue-400 font-medium">Secure Verification</p>
                  <p className="text-blue-300 text-sm mt-1">
                    We verify channel ownership through YouTube's official API. Your data is encrypted and secure.
                  </p>
                </div>
              </div>
            </div>

            {/* YouTube Auth Status */}
            {!youtubeAuthStatus.hasAccess && (
              <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                    <div>
                      <p className="text-yellow-400 font-medium">YouTube Access Required</p>
                      <p className="text-yellow-300 text-sm mt-1">
                        Grant YouTube channel and analytics permissions to continue
                      </p>
                    </div>
                  </div>
                  {youtubeAuthStatus.authUrl && (
                    <Button 
                      onClick={() => window.location.href = youtubeAuthStatus.authUrl!}
                      className="bg-yellow-600 hover:bg-yellow-700 text-black"
                    >
                      Authorize YouTube
                    </Button>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleChannelConnect} className="space-y-6">
              {/* Channel Selection Options */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-white">
                    YouTube Channel ID
                  </label>
                  {youtubeAuthStatus.hasAccess && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadOwnedChannels}
                      disabled={loadingChannels}
                      className="border-zinc-600 text-gray-300 hover:bg-zinc-800"
                    >
                      {loadingChannels ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Browse My Channels
                    </Button>
                  )}
                </div>

                <input
                  type="text"
                  value={youtubeChannelId}
                  onChange={(e) => setYoutubeChannelId(e.target.value)}
                  placeholder="UCxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                />
                <p className="text-sm text-gray-400">
                  Find your Channel ID in YouTube Studio → Settings → Channel → Advanced settings
                </p>
              </div>

              {/* Channel Selector Modal */}
              {showChannelSelector && (
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-white">Select Your Channel</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowChannelSelector(false)}
                      className="border-zinc-600 text-gray-300"
                    >
                      Cancel
                    </Button>
                  </div>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {ownedChannels.map((channel) => (
                      <div
                        key={channel.id}
                        onClick={() => {
                          setYoutubeChannelId(channel.id);
                          setShowChannelSelector(false);
                        }}
                        className="flex items-center gap-3 p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer transition-colors"
                      >
                        <img
                          src={channel.snippet.thumbnails.default.url}
                          alt={channel.snippet.title}
                          className="w-10 h-10 rounded-full"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-white">{channel.snippet.title}</p>
                          <p className="text-sm text-gray-400">
                            {parseInt(channel.statistics.subscriberCount).toLocaleString()} subscribers
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || !youtubeChannelId.trim()}
                className="youtube-button w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Verifying Channel...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Verify Channel Ownership
                  </>
                )}
              </Button>
            </form>

            {/* Requirements Info */}
            <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <h3 className="font-medium text-white mb-4">Channel Requirements</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <span className="text-gray-300">1,000+ Subscribers (recommended)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-green-400" />
                  <span className="text-gray-300">4,000+ Watch Hours (recommended)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-red-400" />
                  <span className="text-gray-300">5+ Published Videos</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-purple-400" />
                  <span className="text-gray-300">Channel in Good Standing</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Channels not meeting all requirements may still be accepted based on content quality and engagement.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Create Offering */}
        {currentStep === 2 && state.channel && (
          <div className="youtube-card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <IndianRupee className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Create Investment Offering</h2>
                <p className="text-gray-400">Set your revenue sharing terms</p>
              </div>
            </div>

            {/* Channel Info */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">
                    {state.channel.channelName[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium text-white">{state.channel.channelName}</h3>
                  <p className="text-sm text-gray-400">
                    {state.channel.analytics.subscriberCount?.toLocaleString()} subscribers • {' '}
                    {state.channel.analytics.videoCount} videos
                  </p>
                </div>
              </div>
            </div>

            {/* Requirements Check */}
            {state.channel.analytics.meetsRequirements && state.channel.analytics.requirementsSummary && (
              <RequirementsCheck 
                requirements={state.channel.analytics.meetsRequirements}
                summary={state.channel.analytics.requirementsSummary}
              />
            )}

            <form onSubmit={handleOfferingCreate} className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Offering Title
                  </label>
                  <input
                    type="text"
                    value={offeringData.title}
                    onChange={(e) => setOfferingData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-red-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Revenue Share (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={offeringData.sharePercentage}
                    onChange={(e) => setOfferingData(prev => ({ ...prev, sharePercentage: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-red-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Price per Share (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={offeringData.pricePerShare}
                    onChange={(e) => setOfferingData(prev => ({ ...prev, pricePerShare: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-red-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Duration (months)
                  </label>
                  <select
                    value={offeringData.duration}
                    onChange={(e) => setOfferingData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-red-600"
                  >
                    <option value={12}>12 months</option>
                    <option value={18}>18 months</option>
                    <option value={24}>24 months</option>
                    <option value={36}>36 months</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Description
                </label>
                <textarea
                  value={offeringData.description}
                  onChange={(e) => setOfferingData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-red-600"
                  placeholder="Describe your channel and what investors can expect..."
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="youtube-button w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating Offering...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Investment Offering
                  </>
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Step 3: Success */}
        {currentStep === 3 && state.offeringCreated && (
          <div className="youtube-card p-8 text-center">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">
              🎉 Welcome to the Creator Program!
            </h2>
            <p className="text-gray-400 text-lg mb-8">
              Your channel is now live on the marketplace and ready for investment
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <Button 
                onClick={() => router.push('/marketplace')}
                className="youtube-button"
              >
                <Eye className="h-4 w-4 mr-2" />
                View on Marketplace
              </Button>
              <Button 
                onClick={() => router.push('/dashboard/creator')}
                variant="outline"
                className="border-zinc-600 text-gray-300 hover:bg-zinc-800"
              >
                <Users className="h-4 w-4 mr-2" />
                Creator Dashboard
              </Button>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
              <h3 className="font-medium text-white mb-4">What's Next?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <Users className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                  <p className="text-white font-medium">Attract Investors</p>
                  <p className="text-gray-400">Share your offering with potential investors</p>
                </div>
                <div className="text-center">
                  <IndianRupee className="h-6 w-6 text-green-400 mx-auto mb-2" />
                  <p className="text-white font-medium">Earn Revenue</p>
                  <p className="text-gray-400">Share profits with your investors monthly</p>
                </div>
                <div className="text-center">
                  <Video className="h-6 w-6 text-red-400 mx-auto mb-2" />
                  <p className="text-white font-medium">Create Content</p>
                  <p className="text-gray-400">Keep producing great content for growth</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}