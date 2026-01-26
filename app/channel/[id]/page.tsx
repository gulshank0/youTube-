'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Youtube, Users, Play, Eye, Calendar, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function ChannelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [channel, setChannel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchChannel();
    }
  }, [params.id]);

  const fetchChannel = async () => {
    try {
      const res = await fetch(`/api/channel/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setChannel(data.channel);
      }
    } catch (error) {
      console.error('Failed to fetch channel:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading channel...</p>
        </div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Channel Not Found</h2>
          <p className="text-gray-400 mb-6">The channel you're looking for doesn't exist.</p>
          <Button onClick={() => router.back()} className="youtube-button">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const analytics = channel.analytics as any;
  const revenueData = channel.revenueData as any;

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Button 
          variant="outline" 
          onClick={() => router.back()}
          className="mb-6 border-zinc-700 text-gray-300 hover:bg-zinc-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Channel Header */}
        <div className="youtube-card p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Channel Avatar */}
            <div className="flex-shrink-0">
              {analytics?.profileImage ? (
                <img 
                  src={analytics.profileImage} 
                  alt={channel.channelName}
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">
                    {channel.channelName[0]?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Channel Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">
                    {channel.channelName}
                  </h1>
                  <div className="flex items-center gap-4 text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {analytics?.subscriberCount?.toLocaleString() || 'N/A'} subscribers
                    </span>
                    <span className="flex items-center gap-1">
                      <Play className="w-4 h-4" />
                      {analytics?.videoCount?.toLocaleString() || 'N/A'} videos
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {analytics?.viewCount?.toLocaleString() || 'N/A'} views
                    </span>
                  </div>
                </div>
                <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/30">
                  New Creator
                </Badge>
              </div>

              {analytics?.description && (
                <p className="text-gray-300 mb-4 line-clamp-3">
                  {analytics.description}
                </p>
              )}

              <div className="flex gap-3">
                <Link href={channel.channelUrl} target="_blank">
                  <Button className="youtube-button">
                    <Youtube className="w-4 h-4 mr-2" />
                    Visit Channel
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="youtube-card p-8 mb-8 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-yellow-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-yellow-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">
              Investment Opportunity Coming Soon!
            </h2>
            <p className="text-gray-400 mb-6">
              This creator has recently joined our platform and is preparing their investment offering. 
              Check back soon or visit their YouTube channel to stay updated.
            </p>
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">
                💡 Tip: Follow this creator on YouTube to be notified when they launch their investment opportunity!
              </p>
            </div>
          </div>
        </div>

        {/* Channel Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="youtube-card p-6 text-center">
            <Users className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <div className="text-2xl font-bold text-white mb-1">
              {analytics?.subscriberCount?.toLocaleString() || 'N/A'}
            </div>
            <div className="text-gray-400 text-sm">Subscribers</div>
          </div>
          
          <div className="youtube-card p-6 text-center">
            <Eye className="w-8 h-8 text-green-400 mx-auto mb-3" />
            <div className="text-2xl font-bold text-white mb-1">
              {analytics?.viewCount?.toLocaleString() || 'N/A'}
            </div>
            <div className="text-gray-400 text-sm">Total Views</div>
          </div>
          
          <div className="youtube-card p-6 text-center">
            <Play className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <div className="text-2xl font-bold text-white mb-1">
              {analytics?.videoCount?.toLocaleString() || 'N/A'}
            </div>
            <div className="text-gray-400 text-sm">Videos</div>
          </div>
        </div>

        {/* Recent Videos */}
        {analytics?.recentVideos && analytics.recentVideos.length > 0 && (
          <div className="youtube-card p-8">
            <h3 className="text-xl font-bold text-white mb-6">Recent Videos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analytics.recentVideos.slice(0, 6).map((video: any, index: number) => (
                <div key={index} className="bg-zinc-800 rounded-lg overflow-hidden">
                  <div className="aspect-video bg-zinc-700 flex items-center justify-center">
                    <Play className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="p-3">
                    <h4 className="text-white text-sm font-medium line-clamp-2 mb-2">
                      {video.title || 'Video Title'}
                    </h4>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{video.viewCount?.toLocaleString() || 'N/A'} views</span>
                      <span>{video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}