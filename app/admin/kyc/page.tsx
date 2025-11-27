'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ArrowLeft,
  Search,
  Eye,
  UserCheck,
  UserX,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Phone,
  MapPin,
  FileText,
  Calendar,
  User
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface KYCApplication {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  kycData: any;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  pending: number;
  verified: number;
  rejected: number;
  total: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminKYCPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [applications, setApplications] = useState<KYCApplication[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<KYCApplication | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
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
      fetchApplications();
    }
  }, [status, session, router, selectedStatus, searchQuery]);

  const fetchApplications = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: selectedStatus,
        page: page.toString(),
        limit: '10',
      });
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const res = await fetch(`/api/admin/kyc?${params}`);
      if (!res.ok) throw new Error('Failed to fetch applications');

      const data = await res.json();
      setApplications(data.applications);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch (err) {
      setError('Failed to load KYC applications');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      setActionLoading(true);
      setProcessingId(userId);

      const res = await fetch('/api/admin/kyc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'approve' }),
      });

      if (!res.ok) throw new Error('Failed to approve KYC');

      await fetchApplications(pagination?.page || 1);
      setSelectedApplication(null);
    } catch (err) {
      setError('Failed to approve KYC');
      console.error(err);
    } finally {
      setActionLoading(false);
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication || !rejectionReason.trim()) return;

    try {
      setActionLoading(true);
      setProcessingId(selectedApplication.id);

      const res = await fetch('/api/admin/kyc', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: selectedApplication.id, 
          action: 'reject',
          reason: rejectionReason.trim(),
        }),
      });

      if (!res.ok) throw new Error('Failed to reject KYC');

      await fetchApplications(pagination?.page || 1);
      setSelectedApplication(null);
      setShowRejectModal(false);
      setRejectionReason('');
    } catch (err) {
      setError('Failed to reject KYC');
      console.error(err);
    } finally {
      setActionLoading(false);
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle className="w-3 h-3" />
            Verified
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
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
              <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">KYC Management</h1>
                <p className="text-gray-400 text-sm">Review and manage user identity verifications</p>
              </div>
            </div>
          </div>
          <Button 
            onClick={() => fetchApplications(pagination?.page || 1)}
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
              onClick={() => setSelectedStatus('VERIFIED')}
              className={`p-4 rounded-lg border transition-all ${
                selectedStatus === 'VERIFIED'
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <CheckCircle className={`w-5 h-5 ${selectedStatus === 'VERIFIED' ? 'text-green-500' : 'text-gray-500'}`} />
                <div className="text-left">
                  <p className="text-2xl font-bold text-white">{stats.verified}</p>
                  <p className="text-sm text-gray-400">Verified</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setSelectedStatus('REJECTED')}
              className={`p-4 rounded-lg border transition-all ${
                selectedStatus === 'REJECTED'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <XCircle className={`w-5 h-5 ${selectedStatus === 'REJECTED' ? 'text-red-500' : 'text-gray-500'}`} />
                <div className="text-left">
                  <p className="text-2xl font-bold text-white">{stats.rejected}</p>
                  <p className="text-sm text-gray-400">Rejected</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`p-4 rounded-lg border transition-all ${
                selectedStatus === 'ALL'
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <Filter className={`w-5 h-5 ${selectedStatus === 'ALL' ? 'text-blue-500' : 'text-gray-500'}`} />
                <div className="text-left">
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-sm text-gray-400">Total</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="pl-10 bg-zinc-900 border-zinc-800 text-white"
            />
          </div>
        </div>

        {/* Applications List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2">
            <Card className="bg-zinc-900 border-zinc-800">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                </div>
              ) : applications.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No KYC applications found</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {applications.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      className={`w-full text-left p-4 hover:bg-zinc-800/50 cursor-pointer transition-colors ${
                        selectedApplication?.id === app.id ? 'bg-zinc-800' : ''
                      }`}
                      onClick={() => setSelectedApplication(app)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                          {app.image ? (
                            <Image
                              src={app.image}
                              alt={app.name || 'User'}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-white truncate">
                              {app.kycData?.firstName} {app.kycData?.lastName}
                            </p>
                            {getStatusBadge(app.kycStatus)}
                          </div>
                          <p className="text-sm text-gray-400 truncate">{app.email}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Submitted: {new Date(app.kycData?.submittedAt || app.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Eye className="w-5 h-5 text-gray-500" />
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
                      onClick={() => fetchApplications(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      variant="outline"
                      size="sm"
                      className="border-zinc-700"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => fetchApplications(pagination.page + 1)}
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
            {selectedApplication ? (
              <Card className="bg-zinc-900 border-zinc-800 p-6 sticky top-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">Application Details</h3>
                  {getStatusBadge(selectedApplication.kycStatus)}
                </div>

                <div className="space-y-4">
                  {/* User Info */}
                  <div className="flex items-center gap-4 pb-4 border-b border-zinc-800">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                      {selectedApplication.image ? (
                        <Image
                          src={selectedApplication.image}
                          alt="User"
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-8 h-8 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {selectedApplication.kycData?.firstName} {selectedApplication.kycData?.lastName}
                      </p>
                      <p className="text-sm text-gray-400">{selectedApplication.email}</p>
                    </div>
                  </div>

                  {/* KYC Data */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 text-gray-500 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500">Date of Birth</p>
                        <p className="text-sm text-white">
                          {selectedApplication.kycData?.dateOfBirth 
                            ? new Date(selectedApplication.kycData.dateOfBirth).toLocaleDateString('en-IN')
                            : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 text-gray-500 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500">Phone Number</p>
                        <p className="text-sm text-white">+91 {selectedApplication.kycData?.phoneNumber || '-'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-gray-500 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500">Address</p>
                        <p className="text-sm text-white">
                          {selectedApplication.kycData?.address 
                            ? `${selectedApplication.kycData.address.street}, ${selectedApplication.kycData.address.city}, ${selectedApplication.kycData.address.state} - ${selectedApplication.kycData.address.pincode}`
                            : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-gray-500 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500">PAN Number</p>
                        <p className="text-sm text-white font-mono">
                          {selectedApplication.kycData?.panNumber 
                            ? `****${selectedApplication.kycData.panNumber.slice(-4)}`
                            : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-gray-500 mt-1" />
                      <div>
                        <p className="text-xs text-gray-500">Document Type</p>
                        <p className="text-sm text-white capitalize">
                          {selectedApplication.kycData?.documentType?.replace('_', ' ') || '-'}
                        </p>
                      </div>
                    </div>

                    {selectedApplication.kycData?.aadhaarNumber && (
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 text-gray-500 mt-1" />
                        <div>
                          <p className="text-xs text-gray-500">Aadhaar Number</p>
                          <p className="text-sm text-white font-mono">
                            ****-****-{selectedApplication.kycData.aadhaarNumber.slice(-4)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Document Images */}
                  {(selectedApplication.kycData?.documentFrontUrl || selectedApplication.kycData?.selfieUrl) && (
                    <div className="pt-4 border-t border-zinc-800">
                      <p className="text-sm font-medium text-white mb-3">Uploaded Documents</p>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedApplication.kycData?.documentFrontUrl && (
                          <a 
                            href={selectedApplication.kycData.documentFrontUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-zinc-800 rounded-lg text-center hover:bg-zinc-700 transition-colors"
                          >
                            <FileText className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                            <p className="text-xs text-gray-400">ID Front</p>
                          </a>
                        )}
                        {selectedApplication.kycData?.documentBackUrl && (
                          <a 
                            href={selectedApplication.kycData.documentBackUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-zinc-800 rounded-lg text-center hover:bg-zinc-700 transition-colors"
                          >
                            <FileText className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                            <p className="text-xs text-gray-400">ID Back</p>
                          </a>
                        )}
                        {selectedApplication.kycData?.selfieUrl && (
                          <a 
                            href={selectedApplication.kycData.selfieUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 bg-zinc-800 rounded-lg text-center hover:bg-zinc-700 transition-colors"
                          >
                            <User className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                            <p className="text-xs text-gray-400">Selfie</p>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {selectedApplication.kycStatus === 'REJECTED' && selectedApplication.kycData?.rejectionReason && (
                    <div className="pt-4 border-t border-zinc-800">
                      <div className="p-3 bg-red-500/10 rounded-lg">
                        <p className="text-xs text-red-400 font-medium mb-1">Rejection Reason</p>
                        <p className="text-sm text-gray-300">{selectedApplication.kycData.rejectionReason}</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {selectedApplication.kycStatus === 'PENDING' && (
                    <div className="pt-4 border-t border-zinc-800 space-y-2">
                      <Button
                        onClick={() => handleApprove(selectedApplication.id)}
                        disabled={actionLoading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        {actionLoading && processingId === selectedApplication.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <UserCheck className="w-4 h-4 mr-2" />
                        )}
                        Approve KYC
                      </Button>
                      <Button
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionLoading}
                        variant="outline"
                        className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <UserX className="w-4 h-4 mr-2" />
                        Reject KYC
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="bg-zinc-900 border-zinc-800 p-8 text-center">
                <Eye className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Select an application to view details</p>
              </Card>
            )}
          </div>
        </div>

        {/* Reject Modal */}
        {showRejectModal && selectedApplication && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <Card className="bg-zinc-900 border-zinc-800 p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-2">Reject KYC Application</h3>
              <p className="text-gray-400 text-sm mb-4">
                Please provide a reason for rejecting {selectedApplication.kycData?.firstName}&apos;s KYC application.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="rejectionReason" className="block text-sm font-medium text-gray-300 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter the reason for rejection..."
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 min-h-[100px]"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectionReason('');
                    }}
                    variant="outline"
                    className="flex-1 border-zinc-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={!rejectionReason.trim() || actionLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <UserX className="w-4 h-4 mr-2" />
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
