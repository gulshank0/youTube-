// Profile module shared types and interfaces

export interface BankAccount {
  id: string;
  accountHolderName: string;
  accountType: 'SAVING' | 'CURRENT';
  bankName: string;
  accountNumberLast4: string;
  isDefault: boolean;
  isVerified: boolean;
  status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'SUSPENDED';
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  requestedAt: string;
  completedAt?: string;
  failureReason?: string;
  bankAccount: {
    bankName: string;
    accountNumberLast4: string;
    accountType: string;
  };
}

export interface WalletData {
  id: string;
  balance: number;
  pendingBalance: number;
  lockedBalance: number;
  totalDeposited: number;
  totalInvested: number;
  totalWithdrawn: number;
  totalEarnings: number;
}

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  description: string;
  createdAt: string;
  completedAt?: string;
}

export interface KYCData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  phoneNumber?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  panNumber?: string;
  aadhaarNumber?: string;
  documentType?: 'aadhaar' | 'passport' | 'voter_id' | 'driving_license';
  documentNumber?: string;
  rejectionReason?: string;
  submittedAt?: string;
}

export interface KYCFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  phoneNumber: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  panNumber: string;
  aadhaarNumber: string;
  documentType: 'aadhaar' | 'passport' | 'voter_id' | 'driving_license';
  documentNumber: string;
  documentFrontImage: File | null;
  documentBackImage: File | null;
  selfieImage: File | null;
}

export interface NewBankData {
  accountHolderName: string;
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  confirmAccountNumber: string;
  accountType: 'SAVING' | 'CURRENT';
  setAsDefault: boolean;
}

export type ProfileTab = 'profile' | 'kyc' | 'wallet' | 'bank' | 'history';
export type KYCStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NOT_SUBMITTED';
