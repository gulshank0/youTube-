'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white">Payment Successful!</h1>
            <p className="text-gray-400">
              Your investment has been processed successfully. You can now track it in your dashboard.
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/dashboard/investor">
              <Button className="w-full bg-red-600 hover:bg-red-700">
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="outline" className="w-full border-zinc-700 text-gray-300 hover:bg-zinc-800">
                Browse More Offerings
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
