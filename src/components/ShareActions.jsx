import React, { useState } from 'react';
import { FaLinkedin, FaXTwitter, FaWhatsapp, FaRegCopy, FaGlobe } from 'react-icons/fa6';
import axios from 'axios';

const ShareActions = ({ sessionId, textToShare, analysisResult, isPro, onPaywallTrigger, onShowToast, url = "https://www.ghostnotepro.com", t }) => {
    const [sharing, setSharing] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    // Default to EN if t is missing
    const localT = t || { buttons: { copy: "COPY", share: "SHARE" }, labels: { archive_share: "Publish to Web" } };

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

    const handlePublish = async () => {
        if (!sessionId) return;
        setIsPublishing(true);
        try {
            const response = await axios.post(`/api/publish/${sessionId}`);
            const { publicUrl } = response.data;
            const fullUrl = `${window.location.origin}${publicUrl}`;

            await navigator.clipboard.writeText(fullUrl);
            if (onShowToast) {
                onShowToast(localT.messages?.copy_success || "Link copied!");
            }
        } catch (err) {
            console.error("Publish failed", err);
            if (onShowToast) {
                onShowToast("Failed to publish.");
            }
        } finally {
            setIsPublishing(false);
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
            alert((localT.messages?.copy_success || "Copied!") + "\n\nGhostNote Pro is opening LinkedIn.");
            window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank');
        }
    };

    return (
        <div className="flex flex-col items-center space-y-6 mt-6">
            <div className="flex justify-center items-center gap-6">
                <button
                    onClick={handleLinkedIn}
                    className="opacity-60 hover:opacity-100 text-[#999] hover:text-[#0077b5] transition-all"
                    title="Share to LinkedIn"
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
                    title="Share to X"
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
                    title="Share to WhatsApp"
                >
                    <FaWhatsapp size={20} />
                </button>
                <button
                    onClick={() => handleCopy(textToShare)}
                    className={`flex items-center space-x-2 font-medium text-xs uppercase tracking-widest transition-colors ${copied ? 'text-green-500' : 'text-[#999] hover:text-[#A88E65]'
                        }`}
                    title="Copy Text"
                >
                    <FaRegCopy size={18} />
                    <span>{copied ? '✓' : localT.buttons.copy}</span>
                </button>
            </div>

            {/* Publish TO Web - Button Hidden if no session ID or redundant with Museum Mode logic, 
                BUT keeping it as per existing code structure, just localized. 
                Using "t.labels.archive_share" which describes intent well.
            */}
            <button
                onClick={handlePublish}
                disabled={isPublishing || !sessionId}
                className="flex items-center space-x-3 bg-white/5 border border-white/10 hover:bg-white/10 px-8 py-3 rounded-full transition-all group active:scale-95 disabled:opacity-50"
            >
                <FaGlobe className={`text-[#A88E65] ${isPublishing ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'}`} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#cccccc]">
                    {isPublishing ? '...' : (localT.labels?.archive_share || "Publish to Web")}
                </span>
            </button>
        </div>
    );
};

export default ShareActions;
