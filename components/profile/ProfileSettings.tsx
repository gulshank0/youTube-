'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { User, Shield, Wallet, Building, Clock } from 'lucide-react';
import { ProfileTab } from './ProfileTab';
import { KYCTab } from './KYCTab';
import { WalletTab } from './WalletTab';
import { BankAccountsTab } from './BankAccountsTab';
import { HistoryTab } from './HistoryTab';
import type { ProfileTab as TabType, KYCStatus } from './types';

/**
 * Main ProfileSettings component that orchestrates all profile-related tabs
 * This component handles tab navigation and cross-tab communication
 */
export default function ProfileSettings() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [kycStatus, setKycStatus] = useState<KYCStatus>('NOT_SUBMITTED');
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);

  // Check for tab query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'kyc', 'wallet', 'bank', 'history'].includes(tab)) {
      setActiveTab(tab as TabType);
    }
  }, [searchParams]);

  // Check for payment success from URL query params
  useEffect(() => {
    const urlParams = new URLSearchParams(globalThis.location.search);
    const paymentStatus = urlParams.get('payment');
    
    if (paymentStatus === 'success') {
      // Clear the URL parameter
      const newUrl = globalThis.location.pathname;
      globalThis.history.replaceState({}, '', newUrl);
      
      // Show success message and switch to wallet tab
      setActiveTab('wallet');
      setPaymentSuccessMessage('Payment successful! Your wallet balance has been updated.');
      
      // Clear message after 5 seconds
      setTimeout(() => {
        setPaymentSuccessMessage(null);
      }, 5000);
    }
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleKycStatusChange = useCallback((status: KYCStatus) => {
    setKycStatus(status);
  }, []);

  const handleDismissPaymentMessage = useCallback(() => {
    setPaymentSuccessMessage(null);
  }, []);

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'kyc' as const, label: 'KYC', icon: Shield, badge: kycStatus !== 'VERIFIED' },
    { id: 'wallet' as const, label: 'Wallet', icon: Wallet },
    { id: 'bank' as const, label: 'Bank Accounts', icon: Building },
    { id: 'history' as const, label: 'History', icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-zinc-800/50 rounded-lg p-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all relative ${
              activeTab === tab.id
                ? 'bg-red-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge && kycStatus !== 'VERIFIED' && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && <ProfileTab />}
      
      {activeTab === 'kyc' && (
        <KYCTab onStatusChange={handleKycStatusChange} />
      )}
      
      {activeTab === 'wallet' && (
        <WalletTab 
          onTabChange={handleTabChange}
          paymentSuccessMessage={paymentSuccessMessage}
          onDismissMessage={handleDismissPaymentMessage}
        />
      )}
      
      {activeTab === 'bank' && (
        <BankAccountsTab onTabChange={handleTabChange} />
      )}
      
      {activeTab === 'history' && <HistoryTab />}
    </div>
  );
}
