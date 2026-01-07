import React from 'react';
import { usePaystackPayment } from 'react-paystack';
import { setPro } from '../utils/usageTracker';
import { TRANSLATIONS } from '../constants/languages';

const PaystackSub = ({ email, amount, currency, onSuccess, onClose, t }) => {
    // 1. Safety Fallbacks
    const safeEmail = email || "customer@example.com";
    const safeAmount = amount || 2000;
    const safeCurrency = currency || 'USD';
    const localT = t || TRANSLATIONS.EN;

    // Dynamic Button Text Logic
    const buttonText = safeCurrency === 'USD'
        ? (localT.paywall?.button_usd || "Continue with Membership — $20/month")
        : (localT.paywall?.button_ngn || "Continue with Membership — ₦30,000/month");

    // Use a realistic-looking placeholder if the user hasn't set their key yet
    const fallbackKey = "pk_test_000000000000000000000000000000000000000";
    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || fallbackKey;

    const config = {
        reference: `T${Date.now()}`,
        email: safeEmail,
        amount: safeAmount,
        currency: safeCurrency,
        publicKey: publicKey,
        metadata: {
            plan: "GhostNote Pro"
        }
    };

    // Hook must be at the top level
    const initializePayment = usePaystackPayment(config);

    const handlePayment = () => {
        if (!initializePayment) {
            console.error("Paystack initialization failed");
            alert(localT.paywall?.payment_error || "Payment system is temporarily unavailable. Please try again.");
            return;
        }

        try {
            initializePayment(
                async (reference) => {
                    console.log("Paystack Success Reference:", reference);
                    try {
                        const response = await fetch('/api/verify-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ reference: reference.reference })
                        });
                        const data = await response.json();

                        if (data.status === 'success' && data.verified) {
                            setPro(true);
                            if (onSuccess) onSuccess(reference);
                        } else {
                            alert((localT.paywall?.verification_failed || "Verification Failed") + ": " + (data.message || "Invalid transaction"));
                        }
                    } catch (error) {
                        console.error("Verification Error:", error);
                        alert(localT.paywall?.network_error || "Verification failed due to network error.");
                    }
                },
                () => {
                    console.log("Paystack Modal Closed");
                    if (onClose) onClose();
                }
            );
        } catch (err) {
            console.error("Paystack Execution Error:", err);
            alert(localT.paywall?.gateway_error || "Could not open payment gateway. Please refresh.");
        }
    };

    return (
        <button
            onClick={handlePayment}
            className="w-full py-4 bg-[#A88E65] text-[#1A1A1A] font-bold tracking-widest shadow-lg shadow-[#A88E65]/20 hover:bg-[#8F7650] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 text-[10px] uppercase px-4"
        >
            {buttonText}
        </button>
    );
};

export default PaystackSub;
