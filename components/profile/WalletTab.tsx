'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Loader2, Wallet, IndianRupee, TrendingUp, ArrowUpRight, ArrowDownRight, 
  Building, Plus, CheckCircle, AlertCircle, CreditCard, X, Shield, Clock
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import WalletDepositForm from '@/components/payment/WalletDepositForm';
import { useWallet, useBankAccounts, useDeposit } from './hooks';
import { formatCurrency } from './utils';
import { QUICK_DEPOSIT_AMOUNTS, DEPOSIT_MIN, DEPOSIT_MAX, WITHDRAW_MIN, WITHDRAWAL_FEE_PERCENT } from './constants';
import type { ProfileTab as TabType, BankAccount, WalletData } from './types';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface WalletTabProps {
  readonly onTabChange?: (tab: TabType) => void;
  readonly paymentSuccessMessage?: string | null;
  readonly onDismissMessage?: () => void;
}

/**
 * Wallet management tab component
 */
export function WalletTab({ onTabChange, paymentSuccessMessage, onDismissMessage }: WalletTabProps) {
  const { data: session } = useSession();
  const { walletData, setWalletData, transactions, isLoading: isLoadingWallet, fetchWalletData } = useWallet();
  const { bankAccounts, fetchBankAccounts } = useBankAccounts();
  const { isLoading: isDepositLoading, createDeposit } = useDeposit();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  
  // Withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [withdrawError, setWithdrawError] = useState('');

  useEffect(() => {
    fetchWalletData();
    fetchBankAccounts();
  }, [fetchWalletData, fetchBankAccounts]);

  // Set default bank account when accounts are loaded
  useEffect(() => {
    const defaultBank = bankAccounts.find((b: BankAccount) => b.isDefault && b.isVerified);
    if (defaultBank) {
      setSelectedBankAccount(defaultBank.id);
    }
  }, [bankAccounts]);

  const handleDepositClick = async () => {
    const amount = Number.parseFloat(depositAmount);
    
    if (!amount || amount < DEPOSIT_MIN) {
      alert(`Minimum deposit is ₹${DEPOSIT_MIN}`);
      return;
    }
    
    if (amount > DEPOSIT_MAX) {
      alert(`Maximum deposit is ₹${DEPOSIT_MAX.toLocaleString('en-IN')}`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await createDeposit(amount);

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

  const handleDepositSuccess = (newBalance?: number) => {
    setShowDepositForm(false);
    setClientSecret('');
    setDepositAmount('');
    
    // If new balance was provided, update it immediately
    if (newBalance !== undefined && walletData) {
      setWalletData({
        ...walletData,
        balance: newBalance,
        totalDeposited: walletData.totalDeposited + Number.parseFloat(depositAmount || '0'),
      } as WalletData);
    }
    
    // Still fetch to ensure we have the latest data
    fetchWalletData();
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');
    
    const amount = Number.parseFloat(withdrawAmount);
    
    if (!amount || amount < WITHDRAW_MIN) {
      setWithdrawError(`Minimum withdrawal is ₹${WITHDRAW_MIN}`);
      return;
    }

    if (!selectedBankAccount) {
      setWithdrawError('Please select a bank account');
      return;
    }

    const availableBalance = (walletData?.balance || 0) - (walletData?.lockedBalance || 0);
    if (amount > availableBalance) {
      setWithdrawError(`Insufficient balance. Available: ${formatCurrency(availableBalance)}`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          bankAccountId: selectedBankAccount,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setWithdrawAmount('');
        setSelectedBankAccount('');
        fetchWalletData();
        // Switch to history tab to show the pending withdrawal
        onTabChange?.('history');
      } else {
        setWithdrawError(data.error || 'Failed to process withdrawal');
      }
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      setWithdrawError('Failed to process withdrawal. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifiedBankAccounts = bankAccounts.filter((b: BankAccount) => b.isVerified && b.status === 'VERIFIED');
  const availableBalance = (walletData?.balance || 0) - (walletData?.lockedBalance || 0);
  const withdrawalFee = Number.parseFloat(withdrawAmount || '0') * WITHDRAWAL_FEE_PERCENT;

  if (isLoadingWallet) {
    return (
      <Card className="bg-zinc-900 border-zinc-800 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Success Message */}
      {paymentSuccessMessage && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-green-400 font-medium">{paymentSuccessMessage}</p>
          <button 
            onClick={onDismissMessage}
            className="ml-auto text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Wallet Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-600 to-red-700 border-red-500 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white/80 text-sm font-medium">Available Balance</h3>
            <Wallet className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-3xl font-bold text-white">
            {formatCurrency(availableBalance)}
          </p>
          {(walletData?.lockedBalance || 0) > 0 && (
            <p className="text-sm text-white/60 mt-1">
              +{formatCurrency(walletData?.lockedBalance || 0)} locked
            </p>
          )}
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Total Deposited</h3>
            <ArrowDownRight className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(walletData?.totalDeposited || 0)}
          </p>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Total Invested</h3>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(walletData?.totalInvested || 0)}
          </p>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-400 text-sm font-medium">Total Earnings</h3>
            <IndianRupee className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(walletData?.totalEarnings || 0)}
          </p>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deposit Section */}
        <Card className="bg-zinc-900 border-zinc-800 p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center">
            <ArrowDownRight className="w-5 h-5 mr-2 text-green-500" />
            Add Funds
          </h3>
          
          {!showDepositForm ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="depositAmount" className="block text-sm font-medium text-gray-300">
                  Deposit Amount (INR)
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="depositAmount"
                    type="number"
                    min={DEPOSIT_MIN}
                    max={DEPOSIT_MAX}
                    step="1"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                    placeholder={`Enter amount (min ₹${DEPOSIT_MIN})`}
                  />
                </div>
                <p className="text-xs text-gray-500">Minimum deposit: ₹{DEPOSIT_MIN} • Maximum: ₹{DEPOSIT_MAX.toLocaleString('en-IN')}</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                {QUICK_DEPOSIT_AMOUNTS.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDepositAmount(amount.toString())}
                    className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
                  >
                    ₹{amount.toLocaleString('en-IN')}
                  </Button>
                ))}
              </div>

              <Button
                onClick={handleDepositClick}
                disabled={isLoading || isDepositLoading || !depositAmount}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading || isDepositLoading ? (
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
                amount={Number.parseFloat(depositAmount)}
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

        {/* Withdraw Section */}
        <Card className="bg-zinc-900 border-zinc-800 p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center">
            <ArrowUpRight className="w-5 h-5 mr-2 text-red-500" />
            Withdraw Funds
          </h3>

          {session?.user?.kycStatus !== 'VERIFIED' ? (
            <div className="text-center py-8 px-4">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-xl animate-pulse"></div>
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/30 flex items-center justify-center mx-auto">
                  <Shield className="w-10 h-10 text-yellow-500" />
                </div>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">
                KYC Verification Required
              </h4>
              <p className="text-gray-400 mb-2 max-w-sm mx-auto">
                Complete your identity verification to unlock withdrawal features and secure your account.
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-gray-500 mb-6">
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Secure Process
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-blue-500" />
                  24-48 hrs Review
                </span>
              </div>
              <Button
                onClick={() => onTabChange?.('kyc')}
                className="relative group bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-semibold px-8 py-3 rounded-lg shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all duration-300 transform hover:scale-105"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity"></span>
                <Shield className="w-5 h-5 mr-2 inline-block" />
                Complete Verification
                <ArrowUpRight className="w-4 h-4 ml-2 inline-block group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Button>
              <p className="text-xs text-gray-600 mt-4">
                Required documents: PAN Card, Aadhaar/Passport/Voter ID
              </p>
            </div>
          ) : verifiedBankAccounts.length === 0 ? (
            <div className="text-center py-8">
              <Building className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">
                Add a bank account to enable withdrawals
              </p>
              <Button
                onClick={() => onTabChange?.('bank')}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Bank Account
              </Button>
            </div>
          ) : (
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="withdrawAmount" className="block text-sm font-medium text-gray-300">
                  Withdraw Amount (INR)
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="withdrawAmount"
                    type="number"
                    min={WITHDRAW_MIN}
                    max={availableBalance}
                    step="1"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                    placeholder={`Enter amount (min ₹${WITHDRAW_MIN})`}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Available: {formatCurrency(availableBalance)} • Fee: {WITHDRAWAL_FEE_PERCENT * 100}% • Min: ₹{WITHDRAW_MIN}
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="bankAccount" className="block text-sm font-medium text-gray-300">
                  Bank Account
                </label>
                <select
                  id="bankAccount"
                  value={selectedBankAccount}
                  onChange={(e) => setSelectedBankAccount(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-red-600"
                >
                  <option value="">Select bank account</option>
                  {verifiedBankAccounts.map((account: BankAccount) => (
                    <option key={account.id} value={account.id}>
                      {account.bankName} ****{account.accountNumberLast4}
                      {account.isDefault && ' (Default)'}
                    </option>
                  ))}
                </select>
              </div>

              {Number.parseFloat(withdrawAmount || '0') >= WITHDRAW_MIN && (
                <div className="p-4 bg-zinc-800 rounded-lg space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Withdrawal Amount</span>
                    <span className="text-white font-medium">{formatCurrency(Number.parseFloat(withdrawAmount || '0'))}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Processing Fee ({WITHDRAWAL_FEE_PERCENT * 100}%)</span>
                    <span className="text-red-400">-{formatCurrency(withdrawalFee)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-zinc-700 pt-3">
                    <span className="text-white">You&apos;ll Receive</span>
                    <span className="text-green-400 text-lg">
                      {formatCurrency(Number.parseFloat(withdrawAmount || '0') - withdrawalFee)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 pt-2 border-t border-zinc-700">
                    Funds typically arrive within 1-3 business days
                  </p>
                </div>
              )}

              {withdrawError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-500 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {withdrawError}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !withdrawAmount || !selectedBankAccount}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Request Withdrawal'
                )}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
