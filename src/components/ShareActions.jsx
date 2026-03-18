import React, { useState } from 'react';
import { FaLinkedin, FaXTwitter, FaWhatsapp, FaRegCopy, FaGlobe } from 'react-icons/fa6';
import axios from 'axios';

const ShareActions = ({ textToShare, analysisResult, isPro, onPaywallTrigger, onShowToast, url = "https://www.ghostnotepro.com", t }) => {
    const [sharing, setSharing] = useState(false);
    const [copied, setCopied] = useState(false);

    // Default to EN if t is missing
    const localT = t || { buttons: { copy: "COPY", share: "SHARE" }, labels: { archive_share: "Archive" } };

    const handleCopy = async (text, showToast = true) => {
        try {
            await navigator.clipboard.writeText(text);
            if (showToast) {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
            return true;
        } catch (err) {
            console.error('Failed to copy:', err);
            return false;
        }
    };

    const handleLinkedIn = async () => {
        const content = analysisResult?.social_content?.linkedin_post || textToShare;

        // 1. Try Native Share first (Mobile)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'GhostNote Pro Strategy',
                    text: content,
                    url: url
                });
                return;
            } catch (err) {
                console.log('Native share cancelled or failed:', err);
            }
        }

        // 2. Fallback to Copy + Open (Desktop/Legacy)
        const success = await handleCopy(content, false);
        if (success) {
            const openingMsg = (localT.messages?.social_opening || "GhostNote Pro is opening {platform}.").replace('{platform}', 'LinkedIn');
            alert((localT.messages?.copy_success || "Copied!") + "\n\n" + openingMsg);
            window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank');
        }
    };

    return (
        <div className="flex flex-col items-center space-y-6 mt-6">
            <div className="flex justify-center items-center gap-6">
                <button
                    onClick={handleLinkedIn}
                    className="opacity-60 hover:opacity-100 text-[#999] hover:text-[#0077b5] transition-all"
                    title={localT.labels?.share_linkedin || "Share to LinkedIn"}
                >
                    <FaLinkedin size={20} />
                </button>
                <button
                    onClick={() => {
                        const content = analysisResult?.social_content?.twitter_thread?.[0] || textToShare;
                        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}&url=${encodeURIComponent(url)}`;
                        window.open(shareUrl, '_blank');
                    }}
                    className="opacity-60 hover:opacity-100 text-[#999] hover:text-[#1DA1F2] transition-all"
                    title={localT.labels?.share_x || "Share to X"}
                >
                    <FaXTwitter size={20} />
                </button>
                <button
                    onClick={() => {
                        const content = analysisResult?.social_content?.whatsapp_version || textToShare;
                        const text = encodeURIComponent(`${content} ${url}`);
                        window.open(`https://wa.me/?text=${text}`, '_blank');
                    }}
                    className="opacity-60 hover:opacity-100 text-[#999] hover:text-[#25D366] transition-all"
                    title={localT.labels?.share_whatsapp || "Share to WhatsApp"}
                >
                    <FaWhatsapp size={20} />
                </button>
                <button
                    onClick={() => handleCopy(textToShare)}
                    className={`flex items-center space-x-2 font-medium text-xs uppercase tracking-widest transition-colors ${copied ? 'text-green-500' : 'text-[#999] hover:text-[#A88E65]'
                        }`}
                    title={localT.labels?.copy_text || "Copy Text"}
                >
                    <FaRegCopy size={18} />
                    <span>{copied ? '✓' : localT.buttons.copy}</span>
                </button>
            </div>
        </div>
    );
};
    );
};

export default ShareActions;
