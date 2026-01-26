import { google, Auth } from 'googleapis';

export class YouTubeService {
  private readonly youtube;
  private readonly youtubeAnalytics;
  private readonly auth: Auth.OAuth2Client;

  constructor(accessToken?: string, refreshToken?: string) {
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    
    if (accessToken) {
      this.auth.setCredentials({ 
        access_token: accessToken,
        refresh_token: refreshToken 
      });
    }

    this.youtube = google.youtube({ version: 'v3', auth: this.auth });
    this.youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth: this.auth });
  }

  // Method to refresh the access token if needed
  async refreshAccessToken(): Promise<string | null> {
    try {
      const { credentials } = await this.auth.refreshAccessToken();
      return credentials.access_token || null;
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      return null;
    }
  }

  // Get the current credentials (useful for saving updated tokens)
  getCredentials() {
    return this.auth.credentials;
  }

  // Enhanced channel ownership verification with multiple checks
  async verifyChannelOwnership(userId: string, channelId: string): Promise<{
    isValid: boolean;
    isOwned: boolean;
    channel?: any;
    error?: string;
  }> {
    try {
      // First, check if channel exists and get basic info
      const channelResponse = await this.youtube.channels.list({
        part: ['id', 'snippet', 'statistics', 'status', 'brandingSettings'],
        id: [channelId],
      });

      const channels = channelResponse.data.items || [];
      if (channels.length === 0) {
        return { isValid: false, isOwned: false, error: 'Channel not found' };
      }

      const channel = channels[0];

      // Check if channel is accessible (basic validation)
      if (!channel.id || channel.id !== channelId) {
        return { isValid: false, isOwned: false, error: 'Invalid channel ID' };
      }

      // Check if channel is active and not terminated
      if (channel.status?.privacyStatus === 'private') {
        return { isValid: false, isOwned: false, error: 'Channel is private' };
      }

      // Verify ownership by checking if we can access channel's own channels list
      // This requires the user to have management access to the channel
      try {
        const myChannelsResponse = await this.youtube.channels.list({
          part: ['id', 'snippet'],
          mine: true,
        });

        const myChannels = myChannelsResponse.data.items || [];
        const isOwned = myChannels.some(myChannel => myChannel.id === channelId);

        if (!isOwned) {
          return { 
            isValid: true, 
            isOwned: false, 
            channel,
            error: 'You do not own this channel. Please ensure you are signed in with the correct Google account.' 
          };
        }

        return { isValid: true, isOwned: true, channel };
      } catch (ownershipError: any) {
        // If we can't check ownership, it might be a scope issue
        if (ownershipError.code === 403) {
          return { 
            isValid: true, 
            isOwned: false, 
            channel,
            error: 'Unable to verify channel ownership. Please ensure you have granted all required permissions.' 
          };
        }
        throw ownershipError;
      }
    } catch (error: any) {
      console.error('Channel verification error:', error);
      if (error.code === 403) {
        return { 
          isValid: false, 
          isOwned: false, 
          error: 'Insufficient permissions. Please grant YouTube channel access.' 
        };
      }
      return { 
        isValid: false, 
        isOwned: false, 
        error: 'Failed to verify channel. Please try again.' 
      };
    }
  }

  // Get user's owned channels
  async getOwnedChannels(): Promise<any[]> {
    try {
      const response = await this.youtube.channels.list({
        part: ['id', 'snippet', 'statistics', 'status'],
        mine: true,
        maxResults: 50,
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Failed to fetch owned channels:', error);
      return [];
    }
  }

  // Check if channel is monetized
  async checkMonetizationStatus(channelId: string): Promise<{
    isMonetized: boolean;
    hasAdSense: boolean;
    error?: string;
  }> {
    try {
      // Check if channel has monetization enabled
      const channelResponse = await this.youtube.channels.list({
        part: ['monetizationDetails', 'status'],
        id: [channelId],
      });

      const channel = channelResponse.data.items?.[0];
      if (!channel) {
        return { isMonetized: false, hasAdSense: false, error: 'Channel not found' };
      }

      // Note: monetizationDetails is only available if the channel is owned by the authenticated user
      // and requires specific scopes
      const isMonetized = channel.status?.isLinked || false;
      
      return { isMonetized, hasAdSense: isMonetized };
    } catch (error: any) {
      console.error('Monetization check error:', error);
      // If we can't check monetization, assume it's not available
      return { 
        isMonetized: false, 
        hasAdSense: false, 
        error: 'Unable to verify monetization status' 
      };
    }
  }

  // Get enhanced channel analytics with validation
  async getChannelAnalytics(channelId: string): Promise<any> {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics', 'brandingSettings', 'status'],
        id: [channelId],
      });

      const channel = response.data.items?.[0];
      if (!channel) {
        throw new Error('Channel not found');
      }

      const stats = channel.statistics;
      const snippet = channel.snippet;
      const branding = channel.brandingSettings;

      // Validate minimum requirements
      const subscriberCount = parseInt(stats?.subscriberCount || '0');
      const viewCount = parseInt(stats?.viewCount || '0');
      const videoCount = parseInt(stats?.videoCount || '0');

      // Check minimum requirements for platform
      const meetsRequirements = {
        minSubscribers: subscriberCount >= 1000, // YouTube Partner Program requirement
        minViews: viewCount >= 4000, // YouTube Partner Program requirement
        minVideos: videoCount >= 5,
        hasDescription: snippet?.description && snippet.description.length > 50,
        hasCustomUrl: snippet?.customUrl !== undefined,
      };

      return {
        channelId: channel.id,
        title: snippet?.title,
        description: snippet?.description,
        customUrl: snippet?.customUrl,
        publishedAt: snippet?.publishedAt,
        thumbnails: snippet?.thumbnails,
        country: snippet?.country,
        subscriberCount,
        viewCount,
        videoCount,
        hiddenSubscriberCount: stats?.hiddenSubscriberCount === 'true',
        profileImage: snippet?.thumbnails?.default?.url,
        bannerImage: branding?.image?.bannerExternalUrl,
        keywords: branding?.channel?.keywords,
        meetsRequirements,
        requirementsSummary: {
          total: Object.keys(meetsRequirements).length,
          passed: Object.values(meetsRequirements).filter(Boolean).length,
        },
      };
    } catch (error) {
      console.error('Analytics fetch error:', error);
      throw error;
    }
  }

  // Get actual revenue data from YouTube Analytics API
  async getActualRevenueData(channelId: string, startDate: string, endDate: string): Promise<any> {
    try {
      // This requires YouTube Analytics API access and monetization
      const response = await this.youtubeAnalytics.reports.query({
        ids: `channel==${channelId}`,
        startDate,
        endDate,
        metrics: 'estimatedRevenue,estimatedAdRevenue,estimatedRedPartnerRevenue',
        dimensions: 'month',
      });

      const rows = response.data.rows || [];
      const totalRevenue = rows.reduce((sum, row) => sum + (row[1] || 0), 0);
      const monthlyAverage = rows.length > 0 ? totalRevenue / rows.length : 0;

      return {
        totalRevenue,
        monthlyAverage,
        hasActualData: true,
        dataPoints: rows.length,
        currency: 'USD', // YouTube Analytics returns USD
      };
    } catch (error: any) {
      console.error('Revenue data fetch error:', error);
      
      // If we can't get actual revenue data, return estimated
      const analytics = await this.getChannelAnalytics(channelId);
      const estimatedMonthlyRevenue = this.estimateRevenue(analytics.viewCount, analytics.videoCount);
      
      return {
        totalRevenue: estimatedMonthlyRevenue * 12,
        monthlyAverage: estimatedMonthlyRevenue,
        hasActualData: false,
        isEstimated: true,
        currency: 'USD',
        error: 'Actual revenue data not available. Showing estimates.',
      };
    }
  }

  // Improved revenue estimation
  private estimateRevenue(totalViews: number, videoCount: number): number {
    if (!totalViews || !videoCount) return 0;
    
    // More sophisticated estimation based on channel metrics
    const avgViewsPerVideo = totalViews / videoCount;
    const monthlyViews = avgViewsPerVideo * Math.min(videoCount * 0.1, 30); // Assume 10% of videos get views monthly, max 30 videos
    
    // Variable RPM based on channel size
    let rpm = 2.5; // Base RPM
    if (totalViews > 10000000) rpm = 4.0; // Large channels get higher RPM
    else if (totalViews > 1000000) rpm = 3.5;
    else if (totalViews > 100000) rpm = 3.0;
    
    return Math.floor((monthlyViews / 1000) * rpm);
  }

  // Get recent videos with enhanced metadata
  async getRecentVideos(channelId: string, maxResults: number = 10): Promise<any[]> {
    try {
      const response = await this.youtube.search.list({
        part: ['snippet'],
        channelId,
        type: ['video'],
        order: 'date',
        maxResults,
      });

      const videos = response.data.items || [];
      
      // Get detailed video statistics
      if (videos.length > 0) {
        const videoIds = videos.map(video => video.id?.videoId).filter(Boolean);
        const statsResponse = await this.youtube.videos.list({
          part: ['statistics', 'contentDetails'],
          id: videoIds,
        });

        const statsMap = new Map();
        statsResponse.data.items?.forEach(video => {
          if (video.id) {
            statsMap.set(video.id, {
              viewCount: parseInt(video.statistics?.viewCount || '0'),
              likeCount: parseInt(video.statistics?.likeCount || '0'),
              commentCount: parseInt(video.statistics?.commentCount || '0'),
              duration: video.contentDetails?.duration,
            });
          }
        });

        return videos.map(video => ({
          id: video.id?.videoId,
          title: video.snippet?.title,
          description: video.snippet?.description,
          publishedAt: video.snippet?.publishedAt,
          thumbnails: video.snippet?.thumbnails,
          ...statsMap.get(video.id?.videoId),
        }));
      }

      return videos;
    } catch (error) {
      console.error('Recent videos fetch error:', error);
      return [];
    }
  }

  // Add search functionality
  static async searchChannels(query: string, maxResults: number = 20) {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YouTube API key not configured');
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });

    try {
      // Search for channels
      const searchResponse = await youtube.search.list({
        part: ['snippet'],
        q: query,
        type: ['channel'],
        maxResults,
        order: 'relevance'
      });

      if (!searchResponse.data.items?.length) {
        return [];
      }

      // Get channel IDs
      const channelIds = searchResponse.data.items
        .map(item => item.snippet?.channelId)
        .filter(Boolean) as string[];

      if (!channelIds.length) {
        return [];
      }

      // Get detailed channel information
      const channelsResponse = await youtube.channels.list({
        part: ['snippet', 'statistics', 'brandingSettings'],
        id: channelIds
      });

      return channelsResponse.data.items?.map(channel => ({
        id: channel.id,
        title: channel.snippet?.title,
        description: channel.snippet?.description,
        thumbnails: channel.snippet?.thumbnails,
        subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
        viewCount: parseInt(channel.statistics?.viewCount || '0'),
        videoCount: parseInt(channel.statistics?.videoCount || '0'),
      })) || [];
    } catch (error) {
      console.error('Channel search error:', error);
      return [];
    }
  }
}
        title: channel.snippet?.title || 'Unknown Channel',
        description: channel.snippet?.description || '',
        thumbnails: channel.snippet?.thumbnails || {},
        subscriberCount: Number.parseInt(channel.statistics?.subscriberCount || '0'),
        viewCount: Number.parseInt(channel.statistics?.viewCount || '0'),
        videoCount: Number.parseInt(channel.statistics?.videoCount || '0'),
        country: channel.snippet?.country || '',
        publishedAt: channel.snippet?.publishedAt || '',
        customUrl: channel.snippet?.customUrl || '',
        bannerImageUrl: channel.brandingSettings?.image?.bannerExternalUrl || ''
      })) || [];
    } catch (error) {
      console.error('YouTube search error:', error);
      throw new Error('Failed to search YouTube creators');
    }
  }

  async verifyChannelOwnership(userId: string, channelId: string): Promise<boolean> {
    // Allow anyone with a valid YouTube channel to connect
    // Simply verify that the channel exists and is accessible
    const response = await this.youtube.channels.list({
      part: ['id', 'snippet'],
      id: [channelId],
    });

    const channels = response.data.items || [];
    
    // Return true if the channel exists and is valid
    return channels.length > 0 && channels[0].id === channelId;
  }

  async getChannelAnalytics(channelId: string) {
    try {
      const response = await this.youtube.channels.list({
        part: ['statistics', 'snippet', 'brandingSettings'],
        id: [channelId],
      });

      const channel = response.data.items?.[0];
      if (!channel) {
        throw new Error('Channel not found');
      }

      return {
        channelId: channel.id,
        title: channel.snippet?.title,
        description: channel.snippet?.description,
        subscriberCount: Number.parseInt(channel.statistics?.subscriberCount || '0'),
        viewCount: Number.parseInt(channel.statistics?.viewCount || '0'),
        videoCount: Number.parseInt(channel.statistics?.videoCount || '0'),
        thumbnails: channel.snippet?.thumbnails,
        country: channel.snippet?.country,
      };
    } catch (error) {
      console.error('Analytics fetch error:', error);
      throw error;
    }
  }

  async getRecentVideos(channelId: string, maxResults = 10) {
    try {
      const response = await this.youtube.search.list({
        part: ['snippet'],
        channelId,
        order: 'date',
        maxResults,
        type: ['video'],
      });

      return response.data.items?.map(video => ({
        videoId: video.id?.videoId,
        title: video.snippet?.title,
        publishedAt: video.snippet?.publishedAt,
        thumbnails: video.snippet?.thumbnails,
      })) || [];
    } catch (error) {
      console.error('Recent videos fetch error:', error);
      throw error;
    }
  }

  // Note: YouTube Analytics API requires separate approval and monetization access
  async getRevenueData(channelId: string, startDate: string, endDate: string) {
    // This would require YouTube Analytics API and monetization permissions
    // For MVP, we'll use estimated revenue based on views and industry averages
    try {
      const analytics = await this.getChannelAnalytics(channelId);
      
      // Rough estimation: $1-5 per 1000 views (varies greatly)
      const estimatedRPM = 2.5; // Revenue per mille
      const monthlyViews = analytics.viewCount * 0.1; // Assume 10% of total views per month
      const estimatedMonthlyRevenue = (monthlyViews / 1000) * estimatedRPM;

      return {
        estimatedMonthlyRevenue,
        actualRevenue: null, // Would come from YouTube Analytics API
        note: 'Revenue estimation based on industry averages. Actual revenue requires creator permission.',
      };
    } catch (error) {
      console.error('Revenue data fetch error:', error);
      throw error;
    }
  }
}