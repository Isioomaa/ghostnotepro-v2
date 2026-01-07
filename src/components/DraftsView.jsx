import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TRANSLATIONS } from '../constants/languages';

const DraftsView = ({ onClose, t }) => {
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Default fallback to English if t prop is missing (safe guard)
    const localT = t || TRANSLATIONS.EN;

    useEffect(() => {
        fetchDrafts();
    }, []);

    const fetchDrafts = () => {
        try {
            const localDrafts = JSON.parse(localStorage.getItem('ghostnote_drafts') || '[]');
            setDrafts(localDrafts);
        } catch (err) {
            console.error('Failed to fetch local drafts:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-8 md:px-6 md:py-12">
                {/* Header */}
                <div className="flex justify-between items-start mb-12">
                    <div>
                        <h2 className="font-playfair font-bold text-3xl text-white mb-2">{localT.navigation?.drafts || "DRAFTS"}</h2>
                        <p className="text-gray-400 text-sm italic">
                            {localT.drafts_view?.subtitle || "Raw ideas. Unhatched plans. Dump your brain here."}
                        </p>
                    </div>
                    <motion.button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                        whileTap={{ scale: 0.96 }}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </motion.button>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-2 border-tactical-amber border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && drafts.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
                            <span className="text-3xl">💭</span>
                        </div>
                        <h3 className="text-white font-bold mb-2">{localT.drafts_view?.empty_title || "No drafts yet"}</h3>
                        <p className="text-gray-400 text-sm">
                            {localT.drafts_view?.empty_desc || "Record a thought and hit 'Save Draft' to save it here."}
                        </p>
                    </div>
                )}

                {/* Masonry Grid */}
                {!loading && drafts.length > 0 && (
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                        {drafts.map((draft, idx) => (
                            <motion.div
                                key={draft.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: idx * 0.1 }}
                                className="dossier-card p-5 break-inside-avoid mb-4"
                            >
                                {/* Tag */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-lg">{draft.tag.split(' ')[0]}</span>
                                    <span className="text-[10px] uppercase tracking-widest text-gray-500">
                                        {formatDate(draft.created_at)}
                                    </span>
                                </div>

                                {/* Title */}
                                <h3 className="font-bold text-white text-sm mb-3 leading-tight">
                                    {draft.title}
                                </h3>

                                {/* Transcript Preview */}
                                <p className="text-gray-400 text-xs leading-relaxed">
                                    {draft.transcript}
                                </p>

                                {/* Tag Label */}
                                <div className="mt-4 pt-3 border-t border-white/5">
                                    <span className="text-[10px] uppercase tracking-widest text-tactical-amber">
                                        {draft.tag}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DraftsView;
