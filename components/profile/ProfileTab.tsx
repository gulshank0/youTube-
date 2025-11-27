'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { User, Mail, Upload, Save, Loader2 } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { useFileUpload } from './hooks';

/**
 * Profile settings tab component for basic profile management
 */
export function ProfileTab() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const { uploadFile } = useFileUpload();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    email: session?.user?.email || '',
    image: session?.user?.image || '',
  });
  const [imagePreview, setImagePreview] = useState(session?.user?.image || '');
  const [imageFile, setImageFile] = useState<File | null>(null);

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
        imageUrl = await uploadFile(imageFile);
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

  return (
    <Card className="bg-zinc-900 border-zinc-800 p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <span className="block text-sm font-medium text-gray-300">
            Profile Picture
          </span>
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="block text-sm font-medium text-gray-300">
              Account Type
            </span>
            <div className="inline-flex items-center px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg">
              <span className="text-sm font-medium text-white">
                {session?.user?.role || 'INVESTOR'}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <span className="block text-sm font-medium text-gray-300">
              KYC Status
            </span>
            <div className="inline-flex items-center px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg">
              <StatusBadge status={session?.user?.kycStatus || 'PENDING'} />
            </div>
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
  );
}
