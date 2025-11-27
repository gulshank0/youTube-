// Profile module exports
// This file provides a clean API for importing profile components

// Main components
export { default as ProfileSettings } from './ProfileSettings';
export { ProfileTab } from './ProfileTab';
export { KYCTab } from './KYCTab';
export { WalletTab } from './WalletTab';
export { BankAccountsTab } from './BankAccountsTab';
export { HistoryTab } from './HistoryTab';

// UI Components
export { StatusBadge } from './StatusBadge';

// Hooks
export { 
  useWallet, 
  useBankAccounts, 
  useWithdrawals, 
  useKYC, 
  useFileUpload, 
  useDeposit 
} from './hooks';

// Types
export type { 
  BankAccount, 
  Withdrawal, 
  WalletData, 
  Transaction, 
  KYCData, 
  KYCFormData, 
  NewBankData, 
  ProfileTab as ProfileTabType,
  KYCStatus 
} from './types';

// Utils
export { 
  formatCurrency, 
  formatDate, 
  formatDateShort,
  validateIFSC, 
  validateBankAccountNumber, 
  validatePan, 
  validateAadhaar, 
  validatePhoneNumber, 
  validatePincode,
  calculateAge,
  getStatusColor,
  getKycStatusLabel,
  getTransactionIconComponent,
  getTransactionIconColor,
  isCredit
} from './utils';

// Constants
export { 
  POPULAR_BANKS, 
  INDIAN_STATES, 
  QUICK_DEPOSIT_AMOUNTS,
  DEPOSIT_MIN,
  DEPOSIT_MAX,
  WITHDRAW_MIN,
  WITHDRAWAL_FEE_PERCENT,
  MAX_BANK_ACCOUNTS,
  MAX_FILE_SIZE
} from './constants';
