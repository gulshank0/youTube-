'use client';

import { useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/payment/CheckoutForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const clientSecret = searchParams.get('clientSecret');

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        Invalid payment session
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'night' as const,
      variables: {
        colorPrimary: '#dc2626',
      },
    },
  };

  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-center">Complete Investment</CardTitle>
          </CardHeader>
          <CardContent>
            <Elements options={options} stripe={stripePromise}>
              <CheckoutForm />
            </Elements>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
