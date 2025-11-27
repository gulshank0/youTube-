'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Clock, ShieldAlert } from 'lucide-react';
import ProfileSettings from '@/components/profile/ProfileSettings';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const kycStatus = session.user?.kycStatus;

  const getKycBadge = () => {
    switch (kycStatus) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            KYC Verified
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            KYC Pending Review
          </span>
        );
      case 'REJECTED':
        return (
          <button 
            onClick={() => router.push('/profile?tab=kyc')}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            <AlertCircle className="w-4 h-4" />
            KYC Rejected - Click to Resubmit
          </button>
        );
      default:
        return (
          <button 
            onClick={() => router.push('/profile?tab=kyc')}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium hover:bg-orange-500/30 transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            Complete KYC to Enable Withdrawals
          </button>
        );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 pt-24 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
            <h1 className="text-4xl font-bold text-white">Profile Settings</h1>
            {getKycBadge()}
          </div>
          <p className="text-gray-400">Manage your account settings and preferences</p>
        </div>
        <ProfileSettings />
      </div>
    </div>
  );
}
