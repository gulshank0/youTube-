'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Shield, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  Wallet,
  TrendingUp,
  AlertTriangle,
  Loader2,
  LayoutDashboard
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DashboardStats {
  kyc: {
    pending: number;
    verified: number;
    rejected: number;
    total: number;
  };
  withdrawals: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      // Check if user is admin
      if (session?.user?.role !== 'ADMIN') {
        router.push('/');
        return;
      }
      fetchStats();
    }
  }, [status, session, router]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [kycRes, withdrawalsRes] = await Promise.all([
        fetch('/api/admin/kyc'),
        fetch('/api/admin/withdrawals'),
      ]);

      if (!kycRes.ok || !withdrawalsRes.ok) {
        throw new Error('Failed to fetch stats');
      }

      const kycData = await kycRes.json();
      const withdrawalsData = await withdrawalsRes.json();

      setStats({
        kyc: kycData.stats,
        withdrawals: withdrawalsData.stats,
      });
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Card className="bg-zinc-900 border-zinc-800 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You don&apos;t have permission to access this page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          </div>
          <p className="text-gray-400">Manage KYC verifications and withdrawals</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Pending KYC */}
          <Card className="bg-zinc-900 border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <span className="text-3xl font-bold text-white">{stats?.kyc.pending || 0}</span>
            </div>
            <h3 className="text-gray-400 text-sm font-medium">Pending KYC</h3>
            <p className="text-xs text-gray-500 mt-1">Awaiting review</p>
          </Card>

          {/* Verified KYC */}
          <Card className="bg-zinc-900 border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <span className="text-3xl font-bold text-white">{stats?.kyc.verified || 0}</span>
            </div>
            <h3 className="text-gray-400 text-sm font-medium">Verified Users</h3>
            <p className="text-xs text-gray-500 mt-1">KYC approved</p>
          </Card>

          {/* Pending Withdrawals */}
          <Card className="bg-zinc-900 border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-3xl font-bold text-white">{stats?.withdrawals.pending || 0}</span>
            </div>
            <h3 className="text-gray-400 text-sm font-medium">Pending Withdrawals</h3>
            <p className="text-xs text-gray-500 mt-1">Needs processing</p>
          </Card>

          {/* Completed Withdrawals */}
          <Card className="bg-zinc-900 border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
              <span className="text-3xl font-bold text-white">{stats?.withdrawals.completed || 0}</span>
            </div>
            <h3 className="text-gray-400 text-sm font-medium">Completed Withdrawals</h3>
            <p className="text-xs text-gray-500 mt-1">Successfully processed</p>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* KYC Management */}
          <Card className="bg-zinc-900 border-zinc-800 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl flex items-center justify-center">
                <Shield className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">KYC Management</h2>
                <p className="text-gray-400 text-sm">Review and verify user identities</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span className="text-gray-300">Pending Reviews</span>
                </div>
                <span className="text-white font-semibold">{stats?.kyc.pending || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-gray-300">Approved</span>
                </div>
                <span className="text-white font-semibold">{stats?.kyc.verified || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-gray-300">Rejected</span>
                </div>
                <span className="text-white font-semibold">{stats?.kyc.rejected || 0}</span>
              </div>
            </div>

            <Link href="/admin/kyc">
              <Button className="w-full bg-red-600 hover:bg-red-700 text-white">
                Manage KYC
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </Card>

          {/* Withdrawal Management */}
          <Card className="bg-zinc-900 border-zinc-800 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center">
                <Wallet className="w-7 h-7 text-blue-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Withdrawal Management</h2>
                <p className="text-gray-400 text-sm">Process user withdrawal requests</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span className="text-gray-300">Pending</span>
                </div>
                <span className="text-white font-semibold">{stats?.withdrawals.pending || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-500" />
                  <span className="text-gray-300">Processing</span>
                </div>
                <span className="text-white font-semibold">{stats?.withdrawals.processing || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-gray-300">Completed</span>
                </div>
                <span className="text-white font-semibold">{stats?.withdrawals.completed || 0}</span>
              </div>
            </div>

            <Link href="/admin/withdrawals">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Manage Withdrawals
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </Card>
        </div>

        {/* Users Overview */}
        <Card className="bg-zinc-900 border-zinc-800 p-6 mt-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500/20 to-teal-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">User Overview</h2>
                <p className="text-gray-400 text-sm">Total registered users with KYC data</p>
              </div>
            </div>
            <span className="text-3xl font-bold text-white">{stats?.kyc.total || 0}</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-zinc-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-500">{stats?.kyc.pending || 0}</p>
              <p className="text-sm text-gray-400">Pending</p>
            </div>
            <div className="p-4 bg-zinc-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-500">{stats?.kyc.verified || 0}</p>
              <p className="text-sm text-gray-400">Verified</p>
            </div>
            <div className="p-4 bg-zinc-800 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-500">{stats?.kyc.rejected || 0}</p>
              <p className="text-sm text-gray-400">Rejected</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
