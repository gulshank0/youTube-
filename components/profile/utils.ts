// Profile module shared utility functions

import { 
  ArrowDownRight, ArrowUpRight, TrendingUp, IndianRupee, RefreshCw 
} from 'lucide-react';

/**
 * Format currency in Indian Rupee format
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

/**
 * Format date with time
 */
export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format date without time (Indian locale)
 */
export const formatDateShort = (date: string): string => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Validate IFSC Code (Indian Financial System Code)
 */
export const validateIFSC = (ifsc: string): boolean => {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase());
};

/**
 * Validate Bank Account Number (Indian - 9-18 digits)
 */
export const validateBankAccountNumber = (accountNumber: string): boolean => {
  return /^\d{9,18}$/.test(accountNumber);
};

/**
 * Validate Indian PAN number
 */
export const validatePan = (pan: string): boolean => {
  const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/;
  return panRegex.test(pan.toUpperCase());
};

/**
 * Validate Indian Aadhaar number
 */
export const validateAadhaar = (aadhaar: string): boolean => {
  const aadhaarRegex = /^[2-9]\d{11}$/;
  return aadhaarRegex.test(aadhaar.replaceAll(/\s/g, ''));
};

/**
 * Validate Indian phone number
 */
export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replaceAll(/\s/g, ''));
};

/**
 * Validate Indian Pincode
 */
export const validatePincode = (pincode: string): boolean => {
  const pincodeRegex = /^[1-9]\d{5}$/;
  return pincodeRegex.test(pincode);
};

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dob: string): number => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * Get status badge color classes
 */
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    COMPLETED: 'bg-green-500/10 text-green-500 border-green-500/20',
    PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    PROCESSING: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    FAILED: 'bg-red-500/10 text-red-500 border-red-500/20',
    CANCELLED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    VERIFIED: 'bg-green-500/10 text-green-500 border-green-500/20',
    CONFIRMED: 'bg-green-500/10 text-green-500 border-green-500/20',
    REJECTED: 'bg-red-500/10 text-red-500 border-red-500/20',
    NOT_SUBMITTED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    SUSPENDED: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  };
  return colors[status] || colors.PENDING;
};

/**
 * Get KYC status label
 */
export const getKycStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    VERIFIED: 'Verified',
    PENDING: 'Under Review',
    REJECTED: 'Rejected',
    NOT_SUBMITTED: 'Not Submitted',
  };
  return labels[status] || 'Unknown';
};

/**
 * Get transaction icon component based on transaction type
 */
export const getTransactionIconComponent = (type: string) => {
  switch (type) {
    case 'DEPOSIT':
      return ArrowDownRight;
    case 'WITHDRAWAL':
      return ArrowUpRight;
    case 'INVESTMENT':
      return TrendingUp;
    case 'EARNING':
    case 'PAYOUT':
      return IndianRupee;
    case 'REFUND':
      return RefreshCw;
    default:
      return IndianRupee;
  }
};

/**
 * Get transaction icon color
 */
export const getTransactionIconColor = (type: string): string => {
  switch (type) {
    case 'DEPOSIT':
    case 'EARNING':
    case 'PAYOUT':
      return 'text-green-500';
    case 'WITHDRAWAL':
      return 'text-red-500';
    case 'INVESTMENT':
      return 'text-blue-500';
    case 'REFUND':
      return 'text-yellow-500';
    default:
      return 'text-gray-500';
  }
};

/**
 * Check if transaction type is credit (adds to balance)
 */
export const isCredit = (type: string): boolean => {
  return ['DEPOSIT', 'EARNING', 'PAYOUT', 'REFUND'].includes(type);
};
