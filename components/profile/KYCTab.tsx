'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  User, Loader2, Shield, CheckCircle, AlertCircle, Clock, X, 
  AlertTriangle, Eye, EyeOff, Calendar, MapPin, Phone, BadgeCheck,
  FileText, Upload, Camera
} from 'lucide-react';
import { useKYC, useFileUpload } from './hooks';
import { INDIAN_STATES, MAX_FILE_SIZE } from './constants';
import { 
  validatePan, validateAadhaar, validatePhoneNumber, 
  validatePincode, calculateAge, getStatusColor, getKycStatusLabel 
} from './utils';
import type { KYCFormData, KYCStatus } from './types';

interface KYCTabProps {
  readonly onStatusChange?: (status: KYCStatus) => void;
}

/**
 * KYC verification tab component
 */
export function KYCTab({ onStatusChange }: KYCTabProps) {
  const { data: session } = useSession();
  const { kycStatus, setKycStatus, kycData, isLoading: isLoadingKyc, fetchKycStatus, submitKyc } = useKYC();
  const { uploadFile } = useFileUpload();
  
  const [isLoading, setIsLoading] = useState(false);
  const [kycError, setKycError] = useState('');
  const [kycSuccess, setKycSuccess] = useState('');
  const [showPanNumber, setShowPanNumber] = useState(false);
  const [showAadhaarNumber, setShowAadhaarNumber] = useState(false);
  
  const [kycFormData, setKycFormData] = useState<KYCFormData>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'male',
    phoneNumber: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    },
    panNumber: '',
    aadhaarNumber: '',
    documentType: 'aadhaar',
    documentNumber: '',
    documentFrontImage: null,
    documentBackImage: null,
    selfieImage: null,
  });
  
  const [documentFrontPreview, setDocumentFrontPreview] = useState('');
  const [documentBackPreview, setDocumentBackPreview] = useState('');
  const [selfiePreview, setSelfiePreview] = useState('');

  // Fetch KYC status on mount
  useEffect(() => {
    const loadKycStatus = async () => {
      const data = await fetchKycStatus();
      if (data?.data) {
        // Pre-fill form if data exists
        setKycFormData(prev => ({
          ...prev,
          firstName: data.data.firstName || '',
          lastName: data.data.lastName || '',
          dateOfBirth: data.data.dateOfBirth || '',
          gender: data.data.gender || 'male',
          phoneNumber: data.data.phoneNumber || '',
          address: data.data.address || prev.address,
          panNumber: data.data.panNumber || '',
          aadhaarNumber: data.data.aadhaarNumber || '',
          documentType: data.data.documentType || 'aadhaar',
          documentNumber: data.data.documentNumber || '',
        }));
      }
    };
    loadKycStatus();
  }, [fetchKycStatus]);

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.(kycStatus);
  }, [kycStatus, onStatusChange]);

  const handleDocumentFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setKycError('Document image must be less than 5MB');
        return;
      }
      setKycFormData(prev => ({ ...prev, documentFrontImage: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocumentFrontPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDocumentBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setKycError('Document image must be less than 5MB');
        return;
      }
      setKycFormData(prev => ({ ...prev, documentBackImage: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setDocumentBackPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setKycError('Selfie image must be less than 5MB');
        return;
      }
      setKycFormData(prev => ({ ...prev, selfieImage: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfiePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKycError('');
    setKycSuccess('');
    setIsLoading(true);

    // Validation
    if (!kycFormData.firstName.trim() || !kycFormData.lastName.trim()) {
      setKycError('First name and last name are required');
      setIsLoading(false);
      return;
    }

    if (!kycFormData.dateOfBirth) {
      setKycError('Date of birth is required');
      setIsLoading(false);
      return;
    }

    // Age validation (must be 18+)
    if (calculateAge(kycFormData.dateOfBirth) < 18) {
      setKycError('You must be at least 18 years old');
      setIsLoading(false);
      return;
    }

    if (!validatePhoneNumber(kycFormData.phoneNumber)) {
      setKycError('Please enter a valid 10-digit Indian mobile number');
      setIsLoading(false);
      return;
    }

    if (!kycFormData.address.street || !kycFormData.address.city || 
        !kycFormData.address.state || !kycFormData.address.pincode) {
      setKycError('Complete address is required');
      setIsLoading(false);
      return;
    }

    if (!validatePincode(kycFormData.address.pincode)) {
      setKycError('Please enter a valid 6-digit pincode');
      setIsLoading(false);
      return;
    }

    if (!validatePan(kycFormData.panNumber)) {
      setKycError('Please enter a valid PAN number (e.g., ABCDE1234F)');
      setIsLoading(false);
      return;
    }

    if (kycFormData.documentType === 'aadhaar' && !validateAadhaar(kycFormData.aadhaarNumber)) {
      setKycError('Please enter a valid 12-digit Aadhaar number');
      setIsLoading(false);
      return;
    }

    if (!kycFormData.documentFrontImage) {
      setKycError('Please upload the front side of your identity document');
      setIsLoading(false);
      return;
    }

    if (kycFormData.documentType !== 'passport' && !kycFormData.documentBackImage) {
      setKycError('Please upload the back side of your identity document');
      setIsLoading(false);
      return;
    }

    if (!kycFormData.selfieImage) {
      setKycError('Please upload a selfie for verification');
      setIsLoading(false);
      return;
    }

    try {
      // Upload documents
      const documentFrontUrl = await uploadFile(kycFormData.documentFrontImage, 'kyc_document_front');
      const documentBackUrl = kycFormData.documentBackImage 
        ? await uploadFile(kycFormData.documentBackImage, 'kyc_document_back')
        : null;
      const selfieUrl = await uploadFile(kycFormData.selfieImage, 'kyc_selfie');

      // Submit KYC data
      const response = await submitKyc({
        firstName: kycFormData.firstName.trim(),
        lastName: kycFormData.lastName.trim(),
        dateOfBirth: kycFormData.dateOfBirth,
        gender: kycFormData.gender,
        phoneNumber: kycFormData.phoneNumber.replaceAll(/\s/g, ''),
        address: {
          street: kycFormData.address.street.trim(),
          city: kycFormData.address.city.trim(),
          state: kycFormData.address.state.trim(),
          pincode: kycFormData.address.pincode.trim(),
          country: 'India',
        },
        panNumber: kycFormData.panNumber.toUpperCase(),
        aadhaarNumber: kycFormData.aadhaarNumber.replaceAll(/\s/g, ''),
        documentType: kycFormData.documentType,
        documentNumber: kycFormData.documentNumber || kycFormData.aadhaarNumber,
        documents: {
          front: documentFrontUrl,
          back: documentBackUrl,
          selfie: selfieUrl,
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setKycSuccess('KYC verification submitted successfully! We will review your documents within 24-48 hours.');
        setKycStatus('PENDING');
        fetchKycStatus();
      } else {
        setKycError(data.error || 'Failed to submit KYC verification');
      }
    } catch (error: unknown) {
      console.error('KYC submission error:', error);
      setKycError(error instanceof Error ? error.message : 'Failed to submit KYC verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getKycStatusBadge = (status: string) => {
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(status)}`}>
        {getKycStatusLabel(status)}
      </span>
    );
  };

  if (isLoadingKyc) {
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
      {/* KYC Status Card */}
      <Card className="bg-zinc-900 border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              kycStatus === 'VERIFIED' 
                ? 'bg-green-500/10' 
                : kycStatus === 'PENDING' 
                ? 'bg-yellow-500/10' 
                : kycStatus === 'REJECTED'
                ? 'bg-red-500/10'
                : 'bg-zinc-800'
            }`}>
              {kycStatus === 'VERIFIED' ? (
                <BadgeCheck className="w-7 h-7 text-green-500" />
              ) : kycStatus === 'PENDING' ? (
                <Clock className="w-7 h-7 text-yellow-500" />
              ) : kycStatus === 'REJECTED' ? (
                <AlertTriangle className="w-7 h-7 text-red-500" />
              ) : (
                <Shield className="w-7 h-7 text-gray-500" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">KYC Verification</h3>
              <p className="text-gray-400 text-sm mt-1">
                {kycStatus === 'VERIFIED' 
                  ? 'Your identity has been verified' 
                  : kycStatus === 'PENDING'
                  ? 'Your verification is under review'
                  : kycStatus === 'REJECTED'
                  ? 'Your verification was rejected'
                  : 'Complete KYC to enable withdrawals'}
              </p>
            </div>
          </div>
          {getKycStatusBadge(kycStatus)}
        </div>

        {kycStatus === 'VERIFIED' && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-green-400 font-medium">Verification Complete</p>
                <p className="text-sm text-gray-400 mt-1">
                  Your KYC verification is complete. You can now withdraw funds to your bank account.
                </p>
              </div>
            </div>
          </div>
        )}

        {kycStatus === 'PENDING' && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-yellow-400 font-medium">Verification In Progress</p>
                <p className="text-sm text-gray-400 mt-1">
                  We are reviewing your documents. This usually takes 24-48 hours. You will receive an email once the verification is complete.
                </p>
              </div>
            </div>
          </div>
        )}

        {kycStatus === 'REJECTED' && kycData?.rejectionReason && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium">Verification Rejected</p>
                <p className="text-sm text-gray-400 mt-1">
                  Reason: {kycData.rejectionReason}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Please resubmit your documents with correct information.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* KYC Form - Show only if not verified or rejected */}
      {(kycStatus === 'NOT_SUBMITTED' || kycStatus === 'REJECTED') && (
        <Card className="bg-zinc-900 border-zinc-800 p-6">
          <form onSubmit={handleKycSubmit} className="space-y-6">
            {/* Error/Success Messages */}
            {kycError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-red-400 text-sm">{kycError}</p>
              </div>
            )}
            {kycSuccess && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                <p className="text-green-400 text-sm">{kycSuccess}</p>
              </div>
            )}

            {/* Personal Information */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-red-600" />
                Personal Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-300">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="firstName"
                    value={kycFormData.firstName}
                    onChange={(e) => setKycFormData({ ...kycFormData, firstName: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-300">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="lastName"
                    value={kycFormData.lastName}
                    onChange={(e) => setKycFormData({ ...kycFormData, lastName: e.target.value })}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="Enter last name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="dob" className="block text-sm font-medium text-gray-300">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="dob"
                      type="date"
                      value={kycFormData.dateOfBirth}
                      onChange={(e) => setKycFormData({ ...kycFormData, dateOfBirth: e.target.value })}
                      className="pl-10 bg-zinc-800 border-zinc-700 text-white"
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500">Must be 18 years or older</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-300">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="gender"
                    value={kycFormData.gender}
                    onChange={(e) => setKycFormData({ ...kycFormData, gender: e.target.value as 'male' | 'female' | 'other' })}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-300">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <div className="flex">
                      <span className="inline-flex items-center px-3 bg-zinc-700 border border-r-0 border-zinc-600 rounded-l-lg text-gray-300 text-sm">
                        +91
                      </span>
                      <Input
                        id="phone"
                        type="tel"
                        value={kycFormData.phoneNumber}
                        onChange={(e) => setKycFormData({ ...kycFormData, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        className="bg-zinc-800 border-zinc-700 text-white rounded-l-none"
                        placeholder="10-digit mobile number"
                        maxLength={10}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-600" />
                Address
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="street" className="block text-sm font-medium text-gray-300">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="street"
                    value={kycFormData.address.street}
                    onChange={(e) => setKycFormData({ 
                      ...kycFormData, 
                      address: { ...kycFormData.address, street: e.target.value } 
                    })}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="House/Flat No., Building, Street"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="city" className="block text-sm font-medium text-gray-300">
                    City <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="city"
                    value={kycFormData.address.city}
                    onChange={(e) => setKycFormData({ 
                      ...kycFormData, 
                      address: { ...kycFormData.address, city: e.target.value } 
                    })}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="City"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="state" className="block text-sm font-medium text-gray-300">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="state"
                    value={kycFormData.address.state}
                    onChange={(e) => setKycFormData({ 
                      ...kycFormData, 
                      address: { ...kycFormData.address, state: e.target.value } 
                    })}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                    required
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="pincode" className="block text-sm font-medium text-gray-300">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="pincode"
                    value={kycFormData.address.pincode}
                    onChange={(e) => setKycFormData({ 
                      ...kycFormData, 
                      address: { ...kycFormData.address, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) } 
                    })}
                    className="bg-zinc-800 border-zinc-700 text-white"
                    placeholder="6-digit pincode"
                    maxLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="country" className="block text-sm font-medium text-gray-300">
                    Country
                  </label>
                  <Input
                    id="country"
                    value="India"
                    disabled
                    className="bg-zinc-700 border-zinc-600 text-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* Identity Documents */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-600" />
                Identity Documents
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PAN Number */}
                <div className="space-y-2">
                  <label htmlFor="pan" className="block text-sm font-medium text-gray-300">
                    PAN Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      id="pan"
                      type={showPanNumber ? 'text' : 'password'}
                      value={kycFormData.panNumber}
                      onChange={(e) => setKycFormData({ ...kycFormData, panNumber: e.target.value.toUpperCase().slice(0, 10) })}
                      className="bg-zinc-800 border-zinc-700 text-white pr-10"
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPanNumber(!showPanNumber)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPanNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Permanent Account Number (mandatory for tax purposes)</p>
                </div>

                {/* Document Type */}
                <div className="space-y-2">
                  <label htmlFor="docType" className="block text-sm font-medium text-gray-300">
                    ID Proof Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="docType"
                    value={kycFormData.documentType}
                    onChange={(e) => setKycFormData({ ...kycFormData, documentType: e.target.value as 'aadhaar' | 'passport' | 'voter_id' | 'driving_license' })}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  >
                    <option value="aadhaar">Aadhaar Card</option>
                    <option value="passport">Passport</option>
                    <option value="voter_id">Voter ID Card</option>
                    <option value="driving_license">Driving License</option>
                  </select>
                </div>

                {/* Aadhaar Number - Show only if Aadhaar is selected */}
                {kycFormData.documentType === 'aadhaar' && (
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="aadhaar" className="block text-sm font-medium text-gray-300">
                      Aadhaar Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        id="aadhaar"
                        type={showAadhaarNumber ? 'text' : 'password'}
                        value={kycFormData.aadhaarNumber}
                        onChange={(e) => setKycFormData({ ...kycFormData, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                        className="bg-zinc-800 border-zinc-700 text-white pr-10"
                        placeholder="12-digit Aadhaar number"
                        maxLength={12}
                        required={kycFormData.documentType === 'aadhaar'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAadhaarNumber(!showAadhaarNumber)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showAadhaarNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Document Number for non-Aadhaar */}
                {kycFormData.documentType !== 'aadhaar' && (
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="docNumber" className="block text-sm font-medium text-gray-300">
                      {kycFormData.documentType === 'passport' ? 'Passport Number' :
                       kycFormData.documentType === 'voter_id' ? 'Voter ID Number' :
                       'Driving License Number'} <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="docNumber"
                      value={kycFormData.documentNumber}
                      onChange={(e) => setKycFormData({ ...kycFormData, documentNumber: e.target.value.toUpperCase() })}
                      className="bg-zinc-800 border-zinc-700 text-white"
                      placeholder="Enter document number"
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Document Upload */}
            <div>
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-red-600" />
                Document Upload
              </h4>
              <p className="text-sm text-gray-400 mb-4">
                Please upload clear images of your documents. Accepted formats: JPG, PNG (max 5MB each)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Document Front */}
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-gray-300">
                    Document Front <span className="text-red-500">*</span>
                  </span>
                  <div className={`relative border-2 border-dashed rounded-lg p-4 text-center ${
                    documentFrontPreview ? 'border-green-500/50' : 'border-zinc-700 hover:border-red-600/50'
                  }`}>
                    {documentFrontPreview ? (
                      <div className="relative">
                        <img 
                          src={documentFrontPreview} 
                          alt="Document Front" 
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setDocumentFrontPreview('');
                            setKycFormData(prev => ({ ...prev, documentFrontImage: null }));
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                        <span className="text-sm text-gray-400">Click to upload</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={handleDocumentFrontChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Document Back - Not needed for passport */}
                {kycFormData.documentType !== 'passport' && (
                  <div className="space-y-2">
                    <span className="block text-sm font-medium text-gray-300">
                      Document Back <span className="text-red-500">*</span>
                    </span>
                    <div className={`relative border-2 border-dashed rounded-lg p-4 text-center ${
                      documentBackPreview ? 'border-green-500/50' : 'border-zinc-700 hover:border-red-600/50'
                    }`}>
                      {documentBackPreview ? (
                        <div className="relative">
                          <img 
                            src={documentBackPreview} 
                            alt="Document Back" 
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setDocumentBackPreview('');
                              setKycFormData(prev => ({ ...prev, documentBackImage: null }));
                            }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block">
                          <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                          <span className="text-sm text-gray-400">Click to upload</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/jpg"
                            onChange={handleDocumentBackChange}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Selfie */}
                <div className="space-y-2">
                  <span className="block text-sm font-medium text-gray-300">
                    Selfie Photo <span className="text-red-500">*</span>
                  </span>
                  <div className={`relative border-2 border-dashed rounded-lg p-4 text-center ${
                    selfiePreview ? 'border-green-500/50' : 'border-zinc-700 hover:border-red-600/50'
                  }`}>
                    {selfiePreview ? (
                      <div className="relative">
                        <img 
                          src={selfiePreview} 
                          alt="Selfie" 
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelfiePreview('');
                            setKycFormData(prev => ({ ...prev, selfieImage: null }));
                          }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <Camera className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                        <span className="text-sm text-gray-400">Take or upload selfie</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/jpg"
                          onChange={handleSelfieChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Clear front-facing photo of yourself</p>
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="kyc-terms"
                  required
                  className="w-4 h-4 mt-1 rounded border-zinc-600 bg-zinc-800 text-red-600 focus:ring-red-600"
                />
                <label htmlFor="kyc-terms" className="text-sm text-gray-400">
                  I hereby declare that the information provided above is true and correct to the best of my knowledge. 
                  I authorize the verification of my identity documents as per the applicable KYC regulations. 
                  I understand that providing false information may result in legal action.
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700 text-white px-8"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Submit KYC Verification
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Submitted KYC Details - Show when pending or verified */}
      {(kycStatus === 'PENDING' || kycStatus === 'VERIFIED') && kycData && (
        <Card className="bg-zinc-900 border-zinc-800 p-6">
          <h4 className="text-lg font-semibold text-white mb-4">Submitted Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Full Name</p>
              <p className="text-white">{kycData.firstName} {kycData.lastName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Date of Birth</p>
              <p className="text-white">{kycData.dateOfBirth ? new Date(kycData.dateOfBirth).toLocaleDateString('en-IN') : '-'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Phone Number</p>
              <p className="text-white">+91 {kycData.phoneNumber}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">PAN Number</p>
              <p className="text-white">{kycData.panNumber ? `****${kycData.panNumber.slice(-4)}` : '-'}</p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <p className="text-sm text-gray-500">Address</p>
              <p className="text-white">
                {kycData.address?.street}, {kycData.address?.city}, {kycData.address?.state} - {kycData.address?.pincode}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Document Type</p>
              <p className="text-white capitalize">{kycData.documentType?.replace('_', ' ')}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-500">Submitted On</p>
              <p className="text-white">{kycData.submittedAt ? new Date(kycData.submittedAt).toLocaleDateString('en-IN') : '-'}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
