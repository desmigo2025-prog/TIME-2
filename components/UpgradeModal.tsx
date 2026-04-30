import React, { useState } from 'react';
import { X, Check, CreditCard, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUsage } from '../contexts/UsageContext';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();
  const { isPro } = useUsage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      const paystackKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_c5ca851356307863f6808122967c6f09b29dd44a';
      
      if (!paystackKey) {
        setError('Payment system is not configured. Please add VITE_PAYSTACK_PUBLIC_KEY to your environment variables (Settings -> Secrets) and restart the dev server.');
        setIsLoading(false);
        return;
      }

      if (!(window as any).PaystackPop) {
        setError('Payment system unavailable. Try again later.');
        setIsLoading(false);
        return;
      }

      const handler = (window as any).PaystackPop.setup({
        key: paystackKey,
        email: user.email,
        amount: 500, // 5 GHS in pesewas
        currency: 'GHS',
        reference: '' + Math.floor((Math.random() * 1000000000) + 1),
        callback: (response: any) => {
          // Verify on backend
          (async () => {
            try {
              const res = await fetch('/api/verify-payment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  reference: response.reference,
                  userId: user.id,
                }),
              });

              const data = await res.json();

              if (data.success) {
                // Update local state immediately for better UX
                await updateProfile({
                  pro_status: true,
                  subscription_active: true,
                  subscription_date: new Date().toISOString(),
                });
                onClose();
              } else {
                setError(data.error || 'Payment failed. Please try again.');
              }
            } catch (err) {
              console.error(err);
              setError('Payment failed. Please try again.');
            } finally {
              setIsLoading(false);
            }
          })();
        },
        onClose: () => {
          setIsLoading(false);
        },
      });

      handler.openIframe();
    } catch (err) {
      console.error(err);
      setError('Could not initialize payment. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden animate-fade-in relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-gray-800 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-6 text-center border-b border-gray-800">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-yellow-500/20">
            <CreditCard size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Upgrade to Pro</h2>
          <p className="text-gray-400">Unlock unlimited access to all features</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <FeatureItem text="Unlimited AI Conversations" />
            <FeatureItem text="Unlimited File Uploads" />
            <FeatureItem text="Unlimited Announcement Links" />
            <FeatureItem text="Ad-Free Experience" />
            <FeatureItem text="Priority Support" />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleUpgrade}
            disabled={isLoading || isPro}
            className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white rounded-xl font-bold shadow-lg shadow-yellow-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader className="animate-spin" size={20} />
            ) : isPro ? (
              'Already Pro'
            ) : (
              'Upgrade Now - GHS 5/month'
            )}
          </button>
          
          <p className="text-xs text-center text-gray-500 mt-4">
            Secured by Paystack. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
};

const FeatureItem = ({ text }: { text: string }) => (
  <div className="flex items-center gap-3">
    <div className="p-1 bg-tt-green/20 rounded-full text-tt-green">
      <Check size={14} />
    </div>
    <span className="text-gray-300 font-medium">{text}</span>
  </div>
);

export default UpgradeModal;
