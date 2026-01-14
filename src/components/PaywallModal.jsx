import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import PaystackSub from './PaystackSub';
import { TRANSLATIONS } from '../constants/languages';

const PaywallModal = ({ onClose, scenario = 'upsell', t }) => {
    // 1. Initialize with Safe Defaults (Prevents Crash)
    const [currency, setCurrency] = useState('USD');
    const [amount, setAmount] = useState(2000); // $20.00 (2000 cents)

    // Fallback if t is missing
    const localT = t || TRANSLATIONS.EN;

    // 2. The "Lagos Check" (Inside useEffect)
    useEffect(() => {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz && (tz.includes('Lagos') || tz.includes('Africa/Lagos'))) {
                setCurrency('NGN');
                setAmount(3000000); // 30,000 Naira (3 million kobo)
            }
        } catch (e) {
            console.log("Timezone check failed, defaulting to USD");
        }
    }, []);

    const modalContent = (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md cursor-pointer"
                onClick={onClose}
                aria-hidden="true"
            ></div>

            {/* Modal Card - Premium Bronze/Gold Design */}
            <div className="relative w-full max-w-lg bg-[#141414] border border-[#a88e65]/40 p-12 text-center shadow-[0_0_100px_rgba(0,0,0,0.9)] scale-in">

                {/* Lock Icon in Bronze Circle */}
                <div className="flex justify-center mb-10">
                    <div className="w-16 h-16 rounded-full border border-[#a88e65]/30 flex items-center justify-center bg-[#a88e65]/5">
                        <svg className="w-6 h-6 text-[#a88e65]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                </div>

                {/* Premium Headlines */}
                {/* Content based on Scenario */}
                {scenario === 'limit_reached' ? (
                    <div className="mb-12">
                        <h2 className="font-serif text-3xl md:text-5xl text-[#a88e65]/90 mb-8 leading-tight tracking-tight px-4">
                            You've reached your free tier limit
                        </h2>
                        <p className="text-gray-400 font-light leading-relaxed px-2 text-sm mb-8">
                            You've used all 3 free transmutations. Your strategic thinking deserves unlimited processing.
                        </p>

                        <div className="text-left max-w-sm mx-auto space-y-4 mb-8 text-sm text-gray-400">
                            <p className="font-bold text-[#a88e65]">With GhostNote Pro, you get:</p>
                            <ul className="space-y-2 list-none">
                                <li className="flex items-start">
                                    <span className="text-[#a88e65] mr-2">✓</span> Unlimited Scribe transmutations
                                </li>
                                <li className="flex items-start">
                                    <span className="text-[#a88e65] mr-2">✓</span> Strategist Intelligence (Judyment, Risk Audits)
                                </li>
                                <li className="flex items-start">
                                    <span className="text-[#a88e65] mr-2">✓</span> Priority processing
                                </li>
                                <li className="flex items-start">
                                    <span className="text-[#a88e65] mr-2">✓</span> Extended archive storage
                                </li>
                            </ul>
                        </div>
                    </div>
                ) : (
                    <div className="mb-12">
                        <h2 className="font-serif text-3xl md:text-5xl text-[#a88e65]/90 mb-8 leading-tight tracking-tight px-4">
                            {localT.paywall?.headline || "Continue turning thought into strategy"}
                        </h2>

                        <div className="space-y-6 max-w-sm mx-auto text-gray-400 font-light leading-relaxed px-2">
                            <p className="text-sm">
                                {localT.paywall?.subtext || "Pro removes daily limits and unlocks executive-grade transmutation, confidence analysis, and shareable outputs."}
                            </p>
                        </div>
                    </div>
                )}

                {/* The Membership Button */}
                <div className="space-y-10">
                    <PaystackSub
                        amount={amount}
                        currency={currency}
                        onSuccess={onSuccess => {
                            console.log("Payment success:", onSuccess);
                            onClose();
                        }}
                        onClose={() => console.log("Paystack modal closed")}
                        t={localT}
                    />

                    {scenario === 'limit_reached' && (
                        <div className="-mt-6">
                            <button className="text-xs text-gray-600 hover:text-gray-400 underline transition-colors">
                                View plans
                            </button>
                        </div>
                    )}

                    {/* Footer Links */}
                    <div className="space-y-6">
                        <p className="text-[11px] text-gray-600 uppercase tracking-[0.2em] opacity-80">
                            {localT.paywall?.cancel || "Cancel anytime. No hidden fees."}
                        </p>

                        <button
                            onClick={onClose}
                            className="text-xs text-gray-500 hover:text-[#a88e65] transition-colors uppercase tracking-[0.3em] font-light block mx-auto"
                        >
                            {localT.paywall?.restore || "Restore Purchase"}
                        </button>

                        {scenario === 'limit_reached' && (
                            <p className="text-[10px] text-gray-700 mt-4">
                                Questions? <a href="mailto:support@ghostnotepro.com" className="underline hover:text-gray-500">Contact support</a>
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default PaywallModal;
