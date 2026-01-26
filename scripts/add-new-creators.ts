import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// New creator channels without offerings (to test marketplace visibility)
const newCreatorTemplates = [
  { name: 'Fresh Gaming Hub', category: 'Gaming', niche: 'Indie Games', profileImage: 'https://i.pravatar.cc/150?img=40' },
  { name: 'Urban Cooking', category: 'Food', niche: 'Street Food', profileImage: 'https://i.pravatar.cc/150?img=41' },
  { name: 'Tech Startup Stories', category: 'Business', niche: 'Startups', profileImage: 'https://i.pravatar.cc/150?img=42' },
  { name: 'Minimalist Living', category: 'Lifestyle', niche: 'Minimalism', profileImage: 'https://i.pravatar.cc/150?img=43' },
  { name: 'Crypto Trading Academy', category: 'Finance', niche: 'Crypto Education', profileImage: 'https://i.pravatar.cc/150?img=44' },
];

// Helper function to generate random number in range
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to generate realistic subscriber count for new creators
function generateNewCreatorSubscribers(): number {
  // New creators typically have smaller subscriber counts
  const ranges = [
    { min: 10000, max: 50000, weight: 0.4 },
    { min: 50000, max: 150000, weight: 0.3 },
    { min: 150000, max: 300000, weight: 0.2 },
    { min: 300000, max: 500000, weight: 0.1 },
  ];
  
  const rand = Math.random();
  let cumulative = 0;
  
  for (const range of ranges) {
    cumulative += range.weight;
    if (rand <= cumulative) {
      return randomInRange(range.min, range.max);
    }
  }
  
  return randomInRange(25000, 100000);
}

async function main() {
  console.log('🌱 Adding new creators without offerings...');
  console.log('━'.repeat(50));

  // Create new creators
  console.log('\n📝 Creating new creator users...');
  
  const newCreators = [];
  for (let i = 1; i <= newCreatorTemplates.length; i++) {
    const creator = await prisma.user.upsert({
      where: { email: `newcreator${i}@example.com` },
      update: {},
      create: {
        email: `newcreator${i}@example.com`,
        name: newCreatorTemplates[i - 1]?.name.split(' ')[0] + ` Creator`,
        role: 'CREATOR',
        kycStatus: 'VERIFIED',
        emailVerified: new Date(),
      },
    });
    newCreators.push(creator);
  }

  console.log(`   ✅ Created ${newCreators.length} new creators`);

  // Create wallets for new creators
  console.log('\n💰 Creating wallets for new creators...');
  
  for (const creator of newCreators) {
    const earnings = randomInRange(5000, 25000);
    
    await prisma.wallet.upsert({
      where: { userId: creator.id },
      update: {},
      create: {
        userId: creator.id,
        balance: earnings,
        totalDeposited: 0,
        totalInvested: 0,
        totalEarnings: earnings,
        currency: 'INR',
        isActive: true,
      },
    });
  }

  console.log(`   ✅ Created wallets for ${newCreators.length} new creators`);

  // Create channels WITHOUT offerings
  console.log('\n📺 Creating YouTube channels (without offerings)...');

  const newChannels = [];
  for (let i = 0; i < newCreatorTemplates.length; i++) {
    const template = newCreatorTemplates[i];
    const creator = newCreators[i];
    
    const subscriberCount = generateNewCreatorSubscribers();
    const videoCount = randomInRange(50, 300);
    const viewCount = subscriberCount * randomInRange(20, 80);
    const averageViews = Math.floor(viewCount / videoCount);
    const engagementRate = (Math.random() * 8 + 4).toFixed(1);
    
    // Calculate revenue based on subscribers and engagement (lower for new creators)
    const baseRevenue = (subscriberCount / 1000) * randomInRange(8, 20);
    const cpm = (Math.random() * 5 + 4).toFixed(1);
    const sponsorships = subscriberCount > 100000 
      ? randomInRange(2000, 15000) 
      : randomInRange(500, 5000);
    
    const channelSlug = template.name.toLowerCase().replaceAll(/\s+/g, '_');
    const channelHandle = template.name.toLowerCase().replaceAll(/\s+/g, '');
    
    const channel = await prisma.channel.upsert({
      where: { youtubeChannelId: `UC_new_${channelSlug}_${i}` },
      update: {},
      create: {
        youtubeChannelId: `UC_new_${channelSlug}_${i}`,
        channelName: template.name,
        channelUrl: `https://youtube.com/@${channelHandle}`,
        ownerId: creator.id,
        verified: true,
        status: 'VERIFIED', // This makes them visible on marketplace
        analytics: {
          subscriberCount,
          viewCount,
          videoCount,
          averageViews,
          engagementRate: Number.parseFloat(engagementRate),
          category: template.category,
          niche: template.niche,
          profileImage: template.profileImage,
          description: `Welcome to ${template.name}! We create amazing ${template.niche.toLowerCase()} content for our growing community. Join us on this exciting journey!`,
        },
        revenueData: {
          monthlyRevenue: Math.floor(baseRevenue),
          cpm: Number.parseFloat(cpm),
          sponsorships,
        },
      },
    });
    
    newChannels.push(channel);
  }

  console.log(`   ✅ Created ${newChannels.length} new YouTube channels (without offerings)`);

  // Display summary
  console.log('\n' + '━'.repeat(50));
  console.log('🎉 New creators added successfully!');
  console.log('━'.repeat(50));
  console.log('\n📈 Summary:');
  console.log(`   👥 ${newCreators.length} New Creators`);
  console.log(`   📺 ${newChannels.length} New Channels (without offerings)`);
  console.log(`   💰 ${newCreators.length} New Wallets`);
  console.log('\n💡 These channels will appear on the marketplace as "Coming Soon" items');
  console.log('   • They show channel stats instead of investment metrics');
  console.log('   • Users can view channel details and visit YouTube');
  console.log('   • Creators can later add investment offerings');
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('❌ Error adding new creators:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });