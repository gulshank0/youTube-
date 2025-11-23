'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { User, Mail, CreditCard, Upload, Save, Loader2, Wallet, DollarSign, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import WalletDepositForm from '@/components/payment/WalletDepositForm';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function ProfileSettings() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'payment'>('profile');
  
  // Wallet state
  const [walletData, setWalletData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  
  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    image: session?.user?.image || '',
  });

  const [imagePreview, setImagePreview] = useState(session?.user?.image || '');
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Fetch wallet data when payment tab is active
  useEffect(() => {
    if (activeTab === 'payment') {
      fetchWalletData();
    }
  }, [activeTab]);

  const fetchWalletData = async () => {
    setIsLoadingWallet(true);
    try {
      const response = await fetch('/api/wallet');
      if (response.ok) {
        const data = await response.json();
        setWalletData(data.wallet);
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setIsLoadingWallet(false);
    }
  };

  const handleDepositClick = async () => {
    const amount = parseFloat(depositAmount);
    
    if (!amount || amount < 10) {
      alert('Minimum deposit is $10');
      return;
    }
    
    if (amount > 100000) {
      alert('Maximum deposit is $100,000');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      if (response.ok) {
        const data = await response.json();
        setClientSecret(data.clientSecret);
        setShowDepositForm(true);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create deposit');
      }
    } catch (error) {
      console.error('Error creating deposit:', error);
      alert('Failed to create deposit. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDepositSuccess = () => {
    setShowDepositForm(false);
    setClientSecret('');
    setDepositAmount('');
    fetchWalletData();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Upload image if a new one was selected
      let imageUrl = formData.image;
      if (imageFile) {
        const formDataImage = new FormData();
        formDataImage.append('file', imageFile);
        
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formDataImage,
        });
        
        if (uploadRes.ok) {
          const { url } = await uploadRes.json();
          imageUrl = url;
        }
      }

      // Update user profile
      const response = await fetch('/api/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          image: imageUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Update the session
      await update({
        ...session,
        user: {
          ...session?.user,
          name: formData.name,
          email: formData.email,
          image: imageUrl,
        },
      });

      alert('Profile updated successfully!');
      router.refresh();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return <ArrowDownRight className="w-5 h-5 text-green-500" />;
      case 'WITHDRAWAL':
        return <ArrowUpRight className="w-5 h-5 text-red-500" />;
      case 'INVESTMENT':
        return <TrendingUp className="w-5 h-5 text-blue-500" />;
      default:
        return <DollarSign className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      COMPLETED: 'bg-green-500/10 text-green-500 border-green-500/20',
      PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      FAILED: 'bg-red-500/10 text-red-500 border-red-500/20',
      CANCELLED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[status as keyof typeof colors] || colors.PENDING}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-4 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-3 font-medium transition-colors relative ${
            activeTab === 'profile'
              ? 'text-red-600'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5" />
            <span>Profile</span>
          </div>
          {activeTab === 'profile' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('payment')}
          className={`px-4 py-3 font-medium transition-colors relative ${
            activeTab === 'payment'
              ? 'text-red-600'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Wallet className="w-5 h-5" />
            <span>Wallet & Payments</span>
          </div>
          {activeTab === 'payment' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600"></div>
          )}
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <Card className="bg-zinc-900 border-zinc-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-300">
                Profile Picture
              </label>
              <div className="flex items-center space-x-6">
                <div className="relative">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-2 border-zinc-700"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-red-600 flex items-center justify-center text-3xl font-bold text-white">
                      {formData.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer inline-flex items-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    JPG, PNG or GIF. Max size 5MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Enter your full name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Account Type
              </label>
              <div className="inline-flex items-center px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg">
                <span className="text-sm font-medium text-white">
                  {session?.user?.role || 'INVESTOR'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Payment Settings Tab */}
      {activeTab === 'payment' && (
        <div className="space-y-6">
          {isLoadingWallet ? (
            <Card className="bg-zinc-900 border-zinc-800 p-8">
              <div className="flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
              </div>
            </Card>
          ) : (
            <>
              {/* Wallet Balance Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-red-600 to-red-700 border-red-500 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white/80 text-sm font-medium">Available Balance</h3>
                    <Wallet className="w-5 h-5 text-white/80" />
                  </div>
                  <p className="text-3xl font-bold text-white">
                    {formatCurrency(walletData?.balance || 0)}
                  </p>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-gray-400 text-sm font-medium">Total Deposited</h3>
                    <ArrowDownRight className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-3xl font-bold text-white">
                    {formatCurrency(walletData?.totalDeposited || 0)}
                  </p>
                </Card>

                <Card className="bg-zinc-900 border-zinc-800 p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-gray-400 text-sm font-medium">Total Invested</h3>
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold text-white">
                    {formatCurrency(walletData?.totalInvested || 0)}
                  </p>
                </Card>
              </div>

              {/* Deposit Section */}
              <Card className="bg-zinc-900 border-zinc-800 p-6">
                <h3 className="text-xl font-bold text-white mb-4">Add Funds to Wallet</h3>
                
                {!showDepositForm ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-300">
                        Deposit Amount (USD)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                          type="number"
                          min="10"
                          max="100000"
                          step="0.01"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                          placeholder="Enter amount (min $10)"
                        />
                      </div>
                      <p className="text-xs text-gray-400">
                        Minimum deposit: $10 • Maximum deposit: $100,000
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {[50, 100, 500, 1000].map((amount) => (
                        <Button
                          key={amount}
                          type="button"
                          variant="outline"
                          onClick={() => setDepositAmount(amount.toString())}
                          className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
                        >
                          ${amount}
                        </Button>
                      ))}
                    </div>

                    <Button
                      onClick={handleDepositClick}
                      disabled={isLoading || !depositAmount}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          Continue to Payment
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <WalletDepositForm
                      amount={parseFloat(depositAmount)}
                      clientSecret={clientSecret}
                      onSuccess={handleDepositSuccess}
                      onCancel={() => {
                        setShowDepositForm(false);
                        setClientSecret('');
                      }}
                    />
                  </Elements>
                )}
              </Card>

              {/* Transaction History */}
              <Card className="bg-zinc-900 border-zinc-800 p-6">
                <h3 className="text-xl font-bold text-white mb-4">Transaction History</h3>
                
                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No transactions yet</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Your transaction history will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50 hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                            {getTransactionIcon(transaction.type)}
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {transaction.type.replace('_', ' ')}
                            </p>
                            <p className="text-sm text-gray-400">
                              {formatDate(transaction.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            transaction.type === 'DEPOSIT' ? 'text-green-500' : 
                            transaction.type === 'INVESTMENT' || transaction.type === 'WITHDRAWAL' ? 'text-red-500' : 
                            'text-white'
                          }`}>
                            {transaction.type === 'DEPOSIT' ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </p>
                          <div className="mt-1">
                            {getStatusBadge(transaction.status)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
