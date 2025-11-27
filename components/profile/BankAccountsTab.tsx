'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  User, Loader2, Building, Plus, Trash2, CheckCircle, AlertCircle, 
  Clock, X, Shield, Eye, EyeOff
} from 'lucide-react';
import { useBankAccounts } from './hooks';
import { StatusBadge } from './StatusBadge';
import { POPULAR_BANKS, MAX_BANK_ACCOUNTS } from './constants';
import { validateIFSC, validateBankAccountNumber, formatDateShort } from './utils';
import type { ProfileTab as TabType, NewBankData, BankAccount } from './types';

interface BankAccountsTabProps {
  readonly onTabChange?: (tab: TabType) => void;
}

/**
 * Bank accounts management tab component
 */
export function BankAccountsTab({ onTabChange }: BankAccountsTabProps) {
  const { data: session } = useSession();
  const { 
    bankAccounts, 
    isLoading: isLoadingBanks, 
    fetchBankAccounts, 
    addBankAccount, 
    deleteBankAccount, 
    setDefaultBank 
  } = useBankAccounts();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankFormError, setBankFormError] = useState('');
  const [bankFormSuccess, setBankFormSuccess] = useState('');
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showConfirmAccountNumber, setShowConfirmAccountNumber] = useState(false);
  
  const [newBankData, setNewBankData] = useState<NewBankData>({
    accountHolderName: '',
    bankName: '',
    routingNumber: '',
    accountNumber: '',
    confirmAccountNumber: '',
    accountType: 'SAVING',
    setAsDefault: true,
  });

  useEffect(() => {
    fetchBankAccounts();
  }, [fetchBankAccounts]);

  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankFormError('');
    setBankFormSuccess('');
    
    // Validation
    if (!newBankData.accountHolderName.trim()) {
      setBankFormError('Account holder name is required');
      return;
    }

    if (!newBankData.bankName) {
      setBankFormError('Please select a bank');
      return;
    }

    if (!validateIFSC(newBankData.routingNumber)) {
      setBankFormError('Invalid IFSC code. Format: First 4 letters (bank code), 5th character is 0, last 6 alphanumeric (branch code). Example: SBIN0001234');
      return;
    }

    if (!validateBankAccountNumber(newBankData.accountNumber)) {
      setBankFormError('Invalid account number. Must be 9-18 digits.');
      return;
    }
    
    if (newBankData.accountNumber !== newBankData.confirmAccountNumber) {
      setBankFormError('Account numbers do not match');
      return;
    }

    setIsLoading(true);
    try {
      const response = await addBankAccount({
        accountHolderName: newBankData.accountHolderName.trim(),
        bankName: newBankData.bankName,
        routingNumber: newBankData.routingNumber.toUpperCase(),
        accountNumber: newBankData.accountNumber,
        accountType: newBankData.accountType,
        setAsDefault: newBankData.setAsDefault,
      });

      const data = await response.json();
      
      if (response.ok) {
        setBankFormSuccess('Bank account added successfully!');
        setNewBankData({
          accountHolderName: '',
          bankName: '',
          routingNumber: '',
          accountNumber: '',
          confirmAccountNumber: '',
          accountType: 'SAVING',
          setAsDefault: true,
        });
        fetchBankAccounts();
        setTimeout(() => {
          setShowAddBank(false);
          setBankFormSuccess('');
        }, 1500);
      } else {
        setBankFormError(data.error || 'Failed to add bank account');
      }
    } catch (error) {
      console.error('Error adding bank account:', error);
      setBankFormError('Failed to add bank account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (!confirm('Are you sure you want to remove this bank account?')) return;

    try {
      const response = await deleteBankAccount(id);

      if (response.ok) {
        fetchBankAccounts();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete bank account');
      }
    } catch (error) {
      console.error('Error deleting bank account:', error);
    }
  };

  const handleSetDefaultBank = async (id: string) => {
    try {
      const response = await setDefaultBank(id);

      if (response.ok) {
        fetchBankAccounts();
      }
    } catch (error) {
      console.error('Error setting default bank:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white">Your Bank Accounts</h3>
        <Button
          onClick={() => setShowAddBank(true)}
          className="bg-red-600 hover:bg-red-700 text-white"
          disabled={bankAccounts.length >= MAX_BANK_ACCOUNTS}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Bank Account
        </Button>
      </div>

      {session?.user?.kycStatus !== 'VERIFIED' && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
          <Shield className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-500 font-medium">KYC Verification Required</p>
            <p className="text-sm text-gray-400 mt-1">
              You need to complete identity verification before adding bank accounts.
            </p>
          </div>
        </div>
      )}

      {/* Add Bank Account Form */}
      {showAddBank && (
        <Card className="bg-zinc-900 border-zinc-800 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-red-500" />
                Add New Bank Account
              </h4>
              <p className="text-sm text-gray-400 mt-1">Link your Indian bank account for withdrawals</p>
            </div>
            <button onClick={() => { setShowAddBank(false); setBankFormError(''); setBankFormSuccess(''); }} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error/Success Messages */}
          {bankFormError && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{bankFormError}</p>
            </div>
          )}
          {bankFormSuccess && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <p className="text-green-400 text-sm">{bankFormSuccess}</p>
            </div>
          )}
          
          <form onSubmit={handleAddBankAccount} className="space-y-5">
            {/* Account Holder Name */}
            <div className="space-y-2">
              <label htmlFor="accountHolderName" className="block text-sm font-medium text-gray-300">
                Account Holder Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="accountHolderName"
                  value={newBankData.accountHolderName}
                  onChange={(e) => setNewBankData({ ...newBankData, accountHolderName: e.target.value })}
                  className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                  placeholder="As per bank records"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">Name should match exactly as on your bank account</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bank Name */}
              <div className="space-y-2">
                <label htmlFor="bankName" className="block text-sm font-medium text-gray-300">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <select
                  id="bankName"
                  value={newBankData.bankName}
                  onChange={(e) => setNewBankData({ ...newBankData, bankName: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-red-600"
                  required
                >
                  <option value="">Select your bank</option>
                  {POPULAR_BANKS.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>

              {/* Account Type */}
              <div className="space-y-2">
                <label htmlFor="accountType" className="block text-sm font-medium text-gray-300">
                  Account Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="accountType"
                  value={newBankData.accountType}
                  onChange={(e) => setNewBankData({ ...newBankData, accountType: e.target.value as 'SAVING' | 'CURRENT' })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-red-600"
                >
                  <option value="SAVING">Savings Account</option>
                  <option value="CURRENT">Current Account</option>
                </select>
              </div>
            </div>

            {/* IFSC Code */}
            <div className="space-y-2">
              <label htmlFor="ifscCode" className="block text-sm font-medium text-gray-300">
                IFSC Code <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  id="ifscCode"
                  value={newBankData.routingNumber}
                  onChange={(e) => setNewBankData({ ...newBankData, routingNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) })}
                  className={`bg-zinc-800 border-zinc-700 text-white font-mono ${
                    newBankData.routingNumber && !validateIFSC(newBankData.routingNumber) 
                      ? 'border-red-500/50' 
                      : newBankData.routingNumber && validateIFSC(newBankData.routingNumber) 
                      ? 'border-green-500/50' 
                      : ''
                  }`}
                  placeholder="SBIN0001234"
                  maxLength={11}
                  required
                />
                {newBankData.routingNumber && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {validateIFSC(newBankData.routingNumber) ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                11 characters: Bank code (4 letters) + 0 + Branch code (6 alphanumeric). 
                <a href="https://bankifsccode.com/" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 ml-1">
                  Find your IFSC →
                </a>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account Number */}
              <div className="space-y-2">
                <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-300">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="accountNumber"
                    type={showAccountNumber ? 'text' : 'password'}
                    value={newBankData.accountNumber}
                    onChange={(e) => setNewBankData({ ...newBankData, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 18) })}
                    className="bg-zinc-800 border-zinc-700 text-white pr-10 font-mono"
                    placeholder="Enter 9-18 digit account number"
                    maxLength={18}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccountNumber(!showAccountNumber)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showAccountNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Account Number */}
              <div className="space-y-2">
                <label htmlFor="confirmAccountNumber" className="block text-sm font-medium text-gray-300">
                  Confirm Account Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="confirmAccountNumber"
                    type={showConfirmAccountNumber ? 'text' : 'password'}
                    value={newBankData.confirmAccountNumber}
                    onChange={(e) => setNewBankData({ ...newBankData, confirmAccountNumber: e.target.value.replace(/\D/g, '').slice(0, 18) })}
                    className={`bg-zinc-800 border-zinc-700 text-white pr-10 font-mono ${
                      newBankData.confirmAccountNumber && newBankData.accountNumber !== newBankData.confirmAccountNumber 
                        ? 'border-red-500/50' 
                        : newBankData.confirmAccountNumber && newBankData.accountNumber === newBankData.confirmAccountNumber 
                        ? 'border-green-500/50' 
                        : ''
                    }`}
                    placeholder="Re-enter account number"
                    maxLength={18}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmAccountNumber(!showConfirmAccountNumber)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showConfirmAccountNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newBankData.confirmAccountNumber && newBankData.accountNumber !== newBankData.confirmAccountNumber && (
                  <p className="text-xs text-red-400">Account numbers don&apos;t match</p>
                )}
              </div>
            </div>

            {/* Set as Default */}
            <div className="flex items-center space-x-2 p-3 bg-zinc-800/50 rounded-lg">
              <input
                type="checkbox"
                id="setDefault"
                checked={newBankData.setAsDefault}
                onChange={(e) => setNewBankData({ ...newBankData, setAsDefault: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-red-600 focus:ring-red-600"
              />
              <label htmlFor="setDefault" className="text-sm text-gray-300">
                Set as default bank account for withdrawals
              </label>
            </div>

            {/* Security Notice */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-400 text-sm font-medium">Secure Bank Linking</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Your bank details are encrypted and stored securely. We only store the last 4 digits of your account number for display purposes.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={isLoading || session?.user?.kycStatus !== 'VERIFIED'}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding Bank Account...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Bank Account
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={() => { setShowAddBank(false); setBankFormError(''); setBankFormSuccess(''); }}
                variant="outline"
                className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Bank Accounts List */}
      {isLoadingBanks ? (
        <Card className="bg-zinc-900 border-zinc-800 p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
          </div>
        </Card>
      ) : bankAccounts.length === 0 ? (
        <Card className="bg-zinc-900 border-zinc-800 p-8">
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building className="w-10 h-10 text-gray-500" />
            </div>
            <h4 className="text-lg font-semibold text-white mb-2">No Bank Accounts Linked</h4>
            <p className="text-gray-400 mb-4 max-w-sm mx-auto">
              Add a bank account to enable withdrawals and receive your earnings directly to your bank.
            </p>
            {session?.user?.kycStatus === 'VERIFIED' ? (
              <Button
                onClick={() => setShowAddBank(true)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Bank Account
              </Button>
            ) : (
              <Button
                onClick={() => onTabChange?.('kyc')}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <Shield className="w-4 h-4 mr-2" />
                Complete KYC First
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {bankAccounts.map((account: BankAccount) => (
            <Card key={account.id} className={`bg-zinc-900 border-zinc-800 p-5 transition-all ${
              account.isDefault ? 'ring-1 ring-blue-500/30' : ''
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                    account.isVerified ? 'bg-green-500/10' : 'bg-zinc-800'
                  }`}>
                    <Building className={`w-7 h-7 ${account.isVerified ? 'text-green-500' : 'text-gray-400'}`} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <p className="font-semibold text-white text-lg">{account.bankName}</p>
                      {account.isDefault && (
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs rounded-full border border-blue-500/20 font-medium">
                          Default
                        </span>
                      )}
                      <StatusBadge status={account.status} />
                    </div>
                    <div className="flex items-center space-x-3 text-sm">
                      <span className="text-gray-300 font-mono">****{account.accountNumberLast4}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">{account.accountType === 'SAVING' ? 'Savings' : 'Current'}</span>
                    </div>
                    <p className="text-sm text-gray-500">{account.accountHolderName}</p>
                    <p className="text-xs text-gray-600">Added on {formatDateShort(account.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!account.isDefault && account.isVerified && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetDefaultBank(account.id)}
                      className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white text-xs"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Set Default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteBankAccount(account.id)}
                    className="bg-zinc-800 border-zinc-700 hover:bg-red-600/20 text-red-400 hover:text-red-300 hover:border-red-600/30"
                    title="Remove bank account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* Status Message */}
              {account.status === 'PENDING' && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <p className="text-xs text-yellow-400">Verification in progress. This usually takes 1-2 business days.</p>
                </div>
              )}
              {account.status === 'FAILED' && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-xs text-red-400">Verification failed. Please remove and re-add with correct details.</p>
                </div>
              )}
            </Card>
          ))}
          
          {/* Add More Button */}
          {bankAccounts.length < MAX_BANK_ACCOUNTS && session?.user?.kycStatus === 'VERIFIED' && (
            <button
              onClick={() => setShowAddBank(true)}
              className="w-full p-4 border-2 border-dashed border-zinc-700 rounded-lg hover:border-red-600/50 hover:bg-zinc-800/30 transition-colors flex items-center justify-center gap-2 text-gray-400 hover:text-white"
            >
              <Plus className="w-5 h-5" />
              <span>Add Another Bank Account</span>
            </button>
          )}
          
          {/* Info Box */}
          <div className="p-4 bg-zinc-800/50 rounded-lg">
            <p className="text-xs text-gray-500 text-center">
              You can add up to {MAX_BANK_ACCOUNTS} bank accounts. Only verified accounts can be used for withdrawals.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
