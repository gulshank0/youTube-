'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Wallet, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ArrowLeft,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Building,
  User,
  Shield,
  TrendingUp,
  ArrowUpRight
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  failureReason?: string;
  requestedAt: string;
  processedAt?: string;
  completedAt?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    kycStatus: string;
  };
  bankAccount: {
    bankName: string;
    accountNumberLast4: string;
    accountType: string;
    accountHolderName: string;
  };
}

interface Stats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminWithdrawalsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('PENDING');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [failureReason, setFailureReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') {
        router.push('/');
        return;
      }
      fetchWithdrawals();
    }
  }, [status, session, router, selectedStatus]);

  const fetchWithdrawals = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: selectedStatus,
        page: page.toString(),
        limit: '10',
      });

      const res = await fetch(`/api/admin/withdrawals?${params}`);
      if (!res.ok) throw new Error('Failed to fetch withdrawals');

      const data = await res.json();
      setWithdrawals(data.withdrawals);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (err) {
      setError('Failed to load withdrawals');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (withdrawalId: string, action: 'approve' | 'complete' | 'reject') => {
    try {
      setActionLoading(true);
      setProcessingId(withdrawalId);

      const body: any = { withdrawalId, action };
      if (action === 'reject' && failureReason) {
        body.failureReason = failureReason;
      }

      const res = await fetch('/api/admin/withdrawals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Failed to ${action} withdrawal`);

      await fetchWithdrawals(pagination?.page || 1);
      setSelectedWithdrawal(null);
      setShowRejectModal(false);
      setFailureReason('');
    } catch (err) {
      setError(`Failed to ${action} withdrawal`);
      console.error(err);
    } finally {
      setActionLoading(false);
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (status === 'loading') {
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="inline-flex items-center text-gray-400 hover:text-white mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Withdrawal Management</h1>
                <p className="text-gray-400 text-sm">Process and manage user withdrawal requests</p>
              </div>
            </div>
          </div>
          <Button 
            onClick={() => fetchWithdrawals(pagination?.page || 1)}
            variant="outline"
            className="border-zinc-700 text-gray-300 hover:bg-zinc-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-red-400">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-gray-400 hover:text-white">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <button
              onClick={() => setSelectedStatus('PENDING')}
              className={`p-4 rounded-lg border transition-all ${
                selectedStatus === 'PENDING'
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Clock className={`w-5 h-5 ${selectedStatus === 'PENDING' ? 'text-yellow-500' : 'text-gray-500'}`} />
                <div className="text-left">
                  <p className="text-2xl font-bold text-white">{stats.pending}</p>
                  <p className="text-sm text-gray-400">Pending</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setSelectedStatus('PROCESSING')}
              className={`p-4 rounded-lg border transition-all ${
                selectedStatus === 'PROCESSING'
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Loader2 className={`w-5 h-5 ${selectedStatus === 'PROCESSING' ? 'text-blue-500' : 'text-gray-500'}`} />
                <div className="text-left">
                  <p className="text-2xl font-bold text-white">{stats.processing}</p>
                  <p className="text-sm text-gray-400">Processing</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setSelectedStatus('COMPLETED')}
              className={`p-4 rounded-lg border transition-all ${
                selectedStatus === 'COMPLETED'
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <CheckCircle className={`w-5 h-5 ${selectedStatus === 'COMPLETED' ? 'text-green-500' : 'text-gray-500'}`} />
                <div className="text-left">
                  <p className="text-2xl font-bold text-white">{stats.completed}</p>
                  <p className="text-sm text-gray-400">Completed</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`p-4 rounded-lg border transition-all ${
                selectedStatus === 'ALL'
                  ? 'bg-purple-500/10 border-purple-500/30'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Filter className={`w-5 h-5 ${selectedStatus === 'ALL' ? 'text-purple-500' : 'text-gray-500'}`} />
                <div className="text-left">
                  <p className="text-2xl font-bold text-white">
                    {stats.pending + stats.processing + stats.completed + stats.failed}
                  </p>
                  <p className="text-sm text-gray-400">All</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Withdrawals List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2">
            <Card className="bg-zinc-900 border-zinc-800">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : withdrawals.length === 0 ? (
                <div className="text-center py-12">
                  <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No withdrawals found</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {withdrawals.map((withdrawal) => (
                    <button
                      key={withdrawal.id}
                      type="button"
                      className={`w-full text-left p-4 hover:bg-zinc-800/50 cursor-pointer transition-colors ${
                        selectedWithdrawal?.id === withdrawal.id ? 'bg-zinc-800' : ''
                      }`}
                      onClick={() => setSelectedWithdrawal(withdrawal)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                          <Wallet className="w-6 h-6 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white">
                              {formatCurrency(withdrawal.amount)}
                            </p>
                            {getStatusBadge(withdrawal.status)}
                          </div>
                          <p className="text-sm text-gray-400 truncate">
                            {withdrawal.user?.name || withdrawal.user?.email}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(withdrawal.requestedAt).toLocaleString()}
                          </p>
                        </div>
                        <ArrowUpRight className="w-5 h-5 text-gray-500" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
                  <p className="text-sm text-gray-400">
                    Page {pagination.page} of {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => fetchWithdrawals(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      variant="outline"
                      size="sm"
                      className="border-zinc-700"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => fetchWithdrawals(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      variant="outline"
                      size="sm"
                      className="border-zinc-700"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Details Panel */}
          <div className="lg:col-span-1">
            {selectedWithdrawal ? (
              <Card className="bg-zinc-900 border-zinc-800 p-6 sticky top-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Withdrawal Details</h3>
                  {getStatusBadge(selectedWithdrawal.status)}
                </div>

                <div className="space-y-4">
                  {/* Amount */}
                  <div className="p-4 bg-zinc-800 rounded-lg">
                    <p className="text-sm text-gray-400 mb-1">Withdrawal Amount</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(selectedWithdrawal.amount)}
                    </p>
                    <div className="flex justify-between mt-2 text-sm">
                      <span className="text-gray-500">Fee (1.5%)</span>
                      <span className="text-gray-400">-{formatCurrency(selectedWithdrawal.fee)}</span>
                    </div>
                    <div className="flex justify-between mt-1 text-sm border-t border-zinc-700 pt-2">
                      <span className="text-gray-400">Net Amount</span>
                      <span className="text-green-400 font-medium">{formatCurrency(selectedWithdrawal.netAmount)}</span>
                    </div>
                  </div>

                  {/* User Info */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <User className="w-4 h-4 text-gray-500 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500">User</p>
                        <p className="text-sm text-white">{selectedWithdrawal.user?.name || '-'}</p>
                        <p className="text-xs text-gray-400">{selectedWithdrawal.user?.email}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Shield className="w-4 h-4 text-gray-500 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500">KYC Status</p>
                        <p className={`text-sm ${
                          selectedWithdrawal.user?.kycStatus === 'VERIFIED' 
                            ? 'text-green-400' 
                            : 'text-yellow-400'
                        }`}>
                          {selectedWithdrawal.user?.kycStatus || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bank Details */}
                  <div className="pt-4 border-t border-zinc-800">
                    <p className="text-sm font-medium text-white mb-3">Bank Account</p>
                    <div className="p-3 bg-zinc-800 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-white">{selectedWithdrawal.bankAccount.bankName}</span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {selectedWithdrawal.bankAccount.accountHolderName}
                      </p>
                      <p className="text-sm text-gray-400">
                        ****{selectedWithdrawal.bankAccount.accountNumberLast4} ({selectedWithdrawal.bankAccount.accountType})
                      </p>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="pt-4 border-t border-zinc-800 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Requested</span>
                      <span className="text-gray-300">
                        {new Date(selectedWithdrawal.requestedAt).toLocaleString()}
                      </span>
                    </div>
                    {selectedWithdrawal.processedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Processed</span>
                        <span className="text-gray-300">
                          {new Date(selectedWithdrawal.processedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedWithdrawal.completedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Completed</span>
                        <span className="text-gray-300">
                          {new Date(selectedWithdrawal.completedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Failure Reason */}
                  {selectedWithdrawal.failureReason && (
                    <div className="p-3 bg-red-500/10 rounded-lg">
                      <p className="text-xs text-red-400 font-medium mb-1">Failure Reason</p>
                      <p className="text-sm text-gray-300">{selectedWithdrawal.failureReason}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {selectedWithdrawal.status === 'PENDING' && (
                    <div className="pt-4 border-t border-zinc-800 space-y-2">
                      <Button
                        onClick={() => handleAction(selectedWithdrawal.id, 'approve')}
                        disabled={actionLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {actionLoading && processingId === selectedWithdrawal.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <TrendingUp className="w-4 h-4 mr-2" />
                        )}
                        Approve & Process
                      </Button>
                      <Button
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionLoading}
                        variant="outline"
                        className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {selectedWithdrawal.status === 'PROCESSING' && (
                    <div className="pt-4 border-t border-zinc-800 space-y-2">
                      <Button
                        onClick={() => handleAction(selectedWithdrawal.id, 'complete')}
                        disabled={actionLoading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        {actionLoading && processingId === selectedWithdrawal.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Mark as Completed
                      </Button>
                      <Button
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionLoading}
                        variant="outline"
                        className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Mark as Failed
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="bg-zinc-900 border-zinc-800 p-8 text-center">
                <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Select a withdrawal to view details</p>
              </Card>
            )}
          </div>
        </div>

        {/* Reject Modal */}
        {showRejectModal && selectedWithdrawal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <Card className="bg-zinc-900 border-zinc-800 p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-2">Reject Withdrawal</h3>
              <p className="text-gray-400 text-sm mb-4">
                Please provide a reason for rejecting this withdrawal of {formatCurrency(selectedWithdrawal.amount)}.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="failureReason" className="block text-sm font-medium text-gray-300 mb-2">
                    Failure Reason
                  </label>
                  <textarea
                    id="failureReason"
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    placeholder="Enter the reason (optional)..."
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 min-h-[100px]"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowRejectModal(false);
                      setFailureReason('');
                    }}
                    variant="outline"
                    className="flex-1 border-zinc-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleAction(selectedWithdrawal.id, 'reject')}
                    disabled={actionLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
