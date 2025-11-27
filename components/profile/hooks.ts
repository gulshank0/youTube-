'use client';

import { useState, useCallback } from 'react';
import type { WalletData, Transaction, BankAccount, Withdrawal, KYCData, KYCStatus } from './types';

/**
 * Hook to manage wallet data fetching
 */
export function useWallet() {
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWalletData = useCallback(async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  return {
    walletData,
    setWalletData,
    transactions,
    isLoading,
    fetchWalletData,
  };
}

/**
 * Hook to manage bank accounts
 */
export function useBankAccounts() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBankAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/wallet/bank-accounts');
      if (response.ok) {
        const data = await response.json();
        setBankAccounts(data.bankAccounts || []);
        return data.bankAccounts || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addBankAccount = useCallback(async (bankData: {
    accountHolderName: string;
    bankName: string;
    routingNumber: string;
    accountNumber: string;
    accountType: 'SAVING' | 'CURRENT';
    setAsDefault: boolean;
  }) => {
    const response = await fetch('/api/wallet/bank-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bankData),
    });
    return response;
  }, []);

  const deleteBankAccount = useCallback(async (id: string) => {
    const response = await fetch(`/api/wallet/bank-accounts?id=${id}`, {
      method: 'DELETE',
    });
    return response;
  }, []);

  const setDefaultBank = useCallback(async (id: string) => {
    const response = await fetch('/api/wallet/bank-accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankAccountId: id, setAsDefault: true }),
    });
    return response;
  }, []);

  return {
    bankAccounts,
    setBankAccounts,
    isLoading,
    fetchBankAccounts,
    addBankAccount,
    deleteBankAccount,
    setDefaultBank,
  };
}

/**
 * Hook to manage withdrawals
 */
export function useWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/wallet/withdraw');
      if (response.ok) {
        const data = await response.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestWithdrawal = useCallback(async (amount: number, bankAccountId: string) => {
    const response = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, bankAccountId }),
    });
    return response;
  }, []);

  const cancelWithdrawal = useCallback(async (id: string) => {
    const response = await fetch(`/api/wallet/withdraw?id=${id}`, {
      method: 'DELETE',
    });
    return response;
  }, []);

  return {
    withdrawals,
    isLoading,
    fetchWithdrawals,
    requestWithdrawal,
    cancelWithdrawal,
  };
}

/**
 * Hook to manage KYC data
 */
export function useKYC() {
  const [kycStatus, setKycStatus] = useState<KYCStatus>('NOT_SUBMITTED');
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchKycStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/kyc');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setKycStatus(data.status || 'NOT_SUBMITTED');
          setKycData(data.data);
          return data;
        }
      }
      return null;
    } catch (error) {
      console.error('Error fetching KYC status:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitKyc = useCallback(async (formData: any) => {
    const response = await fetch('/api/kyc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    return response;
  }, []);

  return {
    kycStatus,
    setKycStatus,
    kycData,
    isLoading,
    fetchKycStatus,
    submitKyc,
  };
}

/**
 * Hook to handle file uploads
 */
export function useFileUpload() {
  const uploadFile = useCallback(async (file: File, type?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (type) {
      formData.append('type', type);
    }

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload ${type || 'file'}`);
    }

    const data = await response.json();
    return data.url;
  }, []);

  return { uploadFile };
}

/**
 * Hook to handle deposit creation
 */
export function useDeposit() {
  const [isLoading, setIsLoading] = useState(false);

  const createDeposit = useCallback(async (amount: number) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, createDeposit };
}
