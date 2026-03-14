import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FaCopy, FaShareAlt, FaChevronDown, FaLock, FaListUl } from 'react-icons/fa';
import { generateExecutiveSuite, updateDraft } from '../services/gemini';
import { TRANSLATIONS } from '../constants/languages';
import { renderMarkdownBlock } from '../utils/renderMarkdown';
import { exportToPDF } from '../utils/exportPDF';
import ShareActions from './ShareActions';
import PaywallModal from './PaywallModal';

// Skeleton Loader Component
const SkeletonCard = () => (
    <div className="dossier-card p-5 md:p-8 space-y-4">
        <div className="flex items-center space-x-2 mb-4">
            <div className="skeleton w-2 h-2 rounded-full"></div>
            <div className="skeleton h-4 w-32"></div>
        </div>
        <div className="skeleton h-6 w-3/4"></div>
        <div className="skeleton h-4 w-full"></div>
        <div className="skeleton h-4 w-5/6"></div>
        <div className="skeleton h-4 w-2/3"></div>
    </div>
);

const SkeletonDashboard = () => (
    <div className="space-y-6 p-5 md:p-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
    </div>
);

// Transparency Label Component (Layer 2 - Decision Transparency)
const TransparencyLabel = ({ type, t }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const label = type === 'context'
        ? (t?.messages?.expanded_from_context || "Expanded from context")
        : (t?.messages?.strategic_implication || "Interpreted as strategic implication");
    const tooltip = t?.messages?.expanded_tooltip || "This section was developed beyond what was explicitly stated in your note.";

    return (
        <span
            className="relative inline-flex items-center cursor-help"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
        >
            <span className="text-[10px] italic text-gray-400 font-light tracking-wide ml-2 border-b border-dashed border-gray-500">
                {label}
            </span>
            {showTooltip && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-gray-800 text-gray-300 text-[10px] leading-relaxed rounded shadow-xl z-50 border border-gray-700 w-max max-w-[240px] text-center whitespace-normal break-words">
                    {tooltip}
                </span>
            )}
        </span>
    );
};
// Section-Level Flag Mechanism Component (Feature 2)
const FlagButton = ({ sectionName, outputType }) => {
    const [isFlagged, setIsFlagged] = useState(false);

    const handleFlag = (e) => {
        e.stopPropagation();
        if (isFlagged) return;
        
        setIsFlagged(true);
        
        const flagData = {
            id: Date.now(),
            sectionName,
            outputType,
            timestamp: new Date().toISOString()
        };
        try {
            const flags = JSON.parse(localStorage.getItem('ghostnote_flags') || '[]');
            flags.push(flagData);
            localStorage.setItem('ghostnote_flags', JSON.stringify(flags));
        } catch (err) {
            console.error('Failed to log flag data silently', err);
        }
    };

    return (
        <button 
            onClick={handleFlag}
            className={`flex items-center space-x-2 transition-all group ${isFlagged ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
        >
            {isFlagged && (
                <span className="text-[9px] text-gray-500 italic animate-in fade-in duration-300 whitespace-nowrap">
                    Noted. This helps us improve.
                </span>
            )}
            <svg 
                className={`w-3 h-3 md:w-[14px] md:h-[14px] transition-colors flex-shrink-0 ${isFlagged ? 'text-gray-400 fill-current' : 'text-gray-500 fill-transparent stroke-current hover:text-gray-400'}`} 
                viewBox="0 0 24 24" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
            >
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
        </button>
    );
};

const SynthesisResult = ({ text, analysis, languageName, currentLang, t, onReset, isPro, onShowToast, initialData, draftId, onEdit, industry }) => {
    const [data, setData] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('scribe');
    const [showPaywall, setShowPaywall] = useState(false);
    const [showEmail, setShowEmail] = useState(false);
    const [showWagerModal, setShowWagerModal] = useState(false);
    const [wagerPrediction, setWagerPrediction] = useState('');
    const [wagerDays, setWagerDays] = useState(30);
    const [sealingWager, setSealingWager] = useState(false);

    // Transcription Editing State
    const [isEditing, setIsEditing] = useState(false);
    const [editableText, setEditableText] = useState(text);

    // Post-Generation Editing State (Improvement 2)
    const [isEditingOutput, setIsEditingOutput] = useState(false);
    const [editedData, setEditedData] = useState(null);
    const [originalData, setOriginalData] = useState(null);
    
    // Structure Selection (Feature 2)
    const [structureMode, setStructureMode] = useState('Detailed'); // 'Brief' or 'Detailed'

    // Executive State Override (Feature 1)
    const [selectedExecutiveState, setSelectedExecutiveState] = useState(null);
    const [isEditingExecutiveState, setIsEditingExecutiveState] = useState(false);
    const [isExecutiveStateOverridden, setIsExecutiveStateOverridden] = useState(false);

    // Default translation fallback
    const localT = t || TRANSLATIONS.EN;

    useEffect(() => {
        if (analysis && analysis.executive_state && !selectedExecutiveState && !isExecutiveStateOverridden) {
            setSelectedExecutiveState(analysis.executive_state || analysis.tone || "Reflective");
        }
    }, [analysis]);

    // Initialize with initialData if provided
    useEffect(() => {
        if (initialData) {
            setData(initialData);
            setOriginalData(JSON.parse(JSON.stringify(initialData)));
        }
    }, [initialData]);

    // Update editableText if text prop changes
    useEffect(() => {
        setEditableText(text);
    }, [text]);

    // When data changes (from generation), store original
    useEffect(() => {
        if (data && !originalData) {
            setOriginalData(JSON.parse(JSON.stringify(data)));
        }
    }, [data]);

    // Helper: count total word count in output
    const getOutputWordCount = (outputData) => {
        if (!outputData) return 0;
        let allText = '';
        const d = outputData.free_tier || outputData;
        if (d.core_thesis) allText += d.core_thesis + ' ';
        if (d.strategic_pillars) {
            d.strategic_pillars.forEach(p => {
                allText += (p.title || '') + ' ' + (p.rich_description || p.description || '') + ' ';
            });
        }
        if (d.tactical_steps) {
            d.tactical_steps.forEach(s => { allText += s + ' '; });
        }
        return allText.trim().split(/\s+/).length;
    };

    // Helper: check if output is short (< 100 words)
    const isShortOutput = (outputData) => getOutputWordCount(outputData) < 100;

    // Helper: get theme count for transparency
    const getThemeCount = (outputData) => {
        if (!outputData) return 0;
        const d = outputData.free_tier || outputData;
        return (d.strategic_pillars?.length || 0);
    };

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setOriginalData(null); // Reset original on new generation
        setEditedData(null);
        setIsEditingOutput(false);
        try {
            console.log('🚀 Starting generation. isPro:', isPro);
            console.log('--- Industry Context:', industry);

            const scribePromise = generateExecutiveSuite(editableText, analysis, languageName, 'scribe', isPro, industry, analysis?.emphasis_signals, selectedExecutiveState, structureMode);

            if (isPro) {
                console.log('💎 Pro user detected. Triggering Strategist...');
            } else {
                console.log('⚪ Free user detected. Skipping Strategist.');
            }

            const strategistPromise = isPro
                ? generateExecutiveSuite(editableText, analysis, languageName, 'strategist', isPro, industry, analysis?.emphasis_signals, selectedExecutiveState, structureMode)
                : Promise.resolve({});

            const results = await Promise.allSettled([scribePromise, strategistPromise]);

            const scribeResult = results[0];
            const strategistResult = results[1];

            let combinedResult = {};
            let strategistError = null;

            if (scribeResult.status === 'fulfilled' && scribeResult.value) {
                combinedResult = { ...combinedResult, ...scribeResult.value };
            } else if (scribeResult.status === 'rejected') {
                console.error('❌ Scribe failed:', scribeResult.reason);
            }

            if (strategistResult.status === 'fulfilled' && strategistResult.value) {
                combinedResult = { ...combinedResult, ...strategistResult.value };
            } else if (strategistResult.status === 'rejected') {
                console.error('❌ Strategist failed:', strategistResult.reason);
                strategistError = strategistResult.reason?.message || "The Strategist could not process this session.";
            }

            if (Object.keys(combinedResult).length === 0) {
                throw new Error("Both generation modes encountered issues. Please try again.");
            }

            setData(combinedResult);
            setOriginalData(JSON.parse(JSON.stringify(combinedResult)));
            if (strategistError) setError(strategistError);

            // Auto-save output
            if (draftId) {
                updateDraft(draftId, {
                    content: combinedResult,
                    transcript: editableText,
                    last_updated: new Date().toISOString()
                });
            } else {
                const { generateTitle } = await import('../services/gemini');
                const aiTitle = await generateTitle(editableText);

                const newEntry = {
                    id: Date.now(),
                    title: aiTitle,
                    transcript: editableText,
                    content: combinedResult,
                    analysis: analysis,
                    industry: industry,
                    tag: "✨ Transmuted",
                    created_at: new Date().toISOString(),
                    last_updated: new Date().toISOString()
                };

                try {
                    const existing = JSON.parse(localStorage.getItem('ghostnote_drafts') || '[]');
                    const updated = [newEntry, ...existing];
                    localStorage.setItem('ghostnote_drafts', JSON.stringify(updated));
                } catch (err) {
                    console.error('Failed to save output:', err);
                }
            }

        } catch (err) {
            console.error('❌ Generation failed:', err);
            setError(localT.messages?.transmutation_fail || "The transmuter encountered a temporary issue. Give it another go.");
        } finally {
            setLoading(false);
        }
    };

    // Post-Generation Editing Handlers (Improvement 2)
    const handleStartEditOutput = () => {
        setEditedData(JSON.parse(JSON.stringify(data)));
        setIsEditingOutput(true);
    };

    const handleSaveEditedOutput = () => {
        setData(editedData);
        setIsEditingOutput(false);
        onShowToast(localT.messages?.output_saved || "Your edits have been saved.");

        // Save to drafts
        if (draftId) {
            updateDraft(draftId, {
                content: editedData,
                last_updated: new Date().toISOString()
            });
        } else {
            try {
                const drafts = JSON.parse(localStorage.getItem('ghostnote_drafts') || '[]');
                if (drafts.length > 0) {
                    drafts[0].content = editedData;
                    drafts[0].last_updated = new Date().toISOString();
                    localStorage.setItem('ghostnote_drafts', JSON.stringify(drafts));
                }
            } catch (err) {
                console.error('Failed to save edited output:', err);
            }
        }
    };

    const handleRevertOutput = () => {
        if (originalData) {
            setData(JSON.parse(JSON.stringify(originalData)));
            setEditedData(null);
            setIsEditingOutput(false);
            onShowToast(localT.messages?.reverted || "Restored to the original output.");
        }
    };

    const updateEditedField = (path, value) => {
        const updated = { ...editedData };
        const d = updated.free_tier || updated;
        const keys = path.split('.');
        let target = d;
        for (let i = 0; i < keys.length - 1; i++) {
            if (keys[i].match(/^\d+$/)) {
                target = target[parseInt(keys[i])];
            } else {
                target = target[keys[i]];
            }
        }
        const lastKey = keys[keys.length - 1];
        if (lastKey.match(/^\d+$/)) {
            target[parseInt(lastKey)] = value;
        } else {
            target[lastKey] = value;
        }
        setEditedData({ ...updated });
    };

    const handleSealWager = async () => {
        if (!wagerPrediction) return;
        setSealingWager(true);
        try {
            const { sealWager } = await import('../services/gemini');
            await sealWager(sessionId, wagerPrediction, wagerDays);
            setShowWagerModal(false);
            onShowToast(localT.wager?.success || "Time Capsule Sealed. Judgment locked.");
        } catch (err) {
            onShowToast(localT.wager?.fail || "Could not seal the time capsule at this time.");
        } finally {
            setSealingWager(false);
        }
    };

    const copyToClipboard = (content, label) => {
        navigator.clipboard.writeText(content);
        const msg = (localT.messages?.copy_success || "Link copied").replace('Link ', '');
        onShowToast(`${label} ${msg}`);
    };

    // Derived Tabs
    const tabs = [
        {
            id: 'scribe',
            label: localT.scribe?.title || "The Scribe",
            subtext: localT.scribe?.description || "Strategic clarity"
        },
        {
            id: 'strategist',
            label: localT.strategist?.title || "The Strategist",
            subtext: localT.strategist?.description || "Executive execution"
        }
    ];

    // Process Transparency line (Layer 1)
    const renderProcessTransparency = (outputData) => {
        const duration = analysis?.duration || "0m 0s";
        const themes = getThemeCount(outputData);
        if (themes === 0) return null;
        const line = (localT.messages?.process_transparency || "Structured from {duration} of audio — {themes} key themes identified.")
            .replace('{duration}', duration)
            .replace('{themes}', themes);
        return (
            <p className="text-[11px] text-gray-400 italic font-light tracking-wide mt-2 mb-4 text-center">
                {line}
            </p>
        );
    };

    if (!data) {
        return (
            <div className="space-y-8 md:space-y-12 transition-opacity duration-500 fade-in">
                {/* Transcription */}
                <div className="text-center px-4 max-w-2xl mx-auto">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex flex-col items-start">
                            <p className="text-[#999] text-[10px] uppercase tracking-[0.3em]">{localT.scribe?.transcription || "TRANSCRIPTION"}</p>
                            {industry && (
                                <span className="text-tactical-amber text-[9px] font-bold uppercase tracking-widest mt-1 px-2 py-0.5 bg-tactical-amber/10 border border-tactical-amber/30 rounded-full">
                                    {localT.strategist.specializing_in} {industry}
                                </span>
                            )}
                        </div>
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="text-tactical-amber text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors flex items-center"
                            >
                                <span className="mr-2">✏️</span> {localT.buttons?.edit || "Edit Transcription"}
                            </button>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="space-y-4">
                            <textarea
                                value={editableText}
                                onChange={(e) => setEditableText(e.target.value)}
                                className="w-full h-48 bg-white/5 border border-tactical-amber/30 rounded-lg p-6 text-white text-sm md:text-base font-serif italic focus:border-tactical-amber outline-none transition-all resize-none shadow-inner"
                                placeholder="Edit your raw thought..."
                            />
                            <div className="flex space-x-4">
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        if (onEdit) onEdit(editableText);
                                        handleGenerate();
                                    }}
                                    className="flex-1 py-3 bg-tactical-amber text-black text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-white transition-all"
                                >
                                    ✓ {localT.buttons?.save_generate || "Save & Generate"}
                                </button>
                                <button
                                    onClick={() => {
                                        setEditableText(text);
                                        setIsEditing(false);
                                    }}
                                    className="px-6 py-3 border border-white/10 text-gray-500 text-[10px] font-bold uppercase tracking-widest rounded-sm hover:text-white transition-all"
                                >
                                    {localT.buttons?.cancel || "Cancel"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[#F9F7F5] leading-relaxed max-w-lg mx-auto whitespace-pre-wrap text-sm md:text-base font-serif italic border-l border-white/5 pl-6">
                            "{editableText}"
                        </p>
                    )}
                </div>

                {/* Analysis / Emphasis Audit */}
                {analysis && !isEditing && (
                    <div className="w-full max-w-2xl mx-auto mb-8 border border-white/10 bg-white/5 rounded-lg p-5 md:p-6">
                        <div className="flex items-center space-x-2 mb-4 border-b border-white/5 pb-2">
                            <span className="w-2 h-2 bg-tactical-amber rounded-full animate-pulse"></span>
                            <h5 className="font-sans font-bold uppercase tracking-[0.2em] text-xs text-tactical-amber">{localT.labels?.emphasis_audit || "EMPHASIS AUDIT"}</h5>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-white/10">
                            <div className="pt-2 md:pt-0">
                                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{localT.labels?.duration || "DURATION"}</p>
                                <p className="font-mono text-base md:text-lg text-white">{analysis.duration || "0m 00s"}</p>
                            </div>
                            <div className="pt-2 md:pt-0">
                                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{localT.labels?.intensity || "INTENSITY"}</p>
                                <p className={`font-mono text-base md:text-lg ${analysis.intensity === 'High' ? 'text-red-400' : 'text-white'}`}>
                                    {analysis.intensity || "Medium"}
                                </p>
                            </div>
                            <div className="pt-2 md:pt-0">
                                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{localT.labels?.executive_state || "STATE"}</p>
                                <div className="flex flex-col items-center justify-center relative">
                                    {isEditingExecutiveState ? (
                                        <div className="flex space-x-2 mt-1 z-10">
                                            {['Reflective', 'Analytical', 'Decisive'].map(state => (
                                                <button
                                                    key={state}
                                                    onClick={() => {
                                                        setSelectedExecutiveState(state);
                                                        setIsExecutiveStateOverridden(true);
                                                        setIsEditingExecutiveState(false);
                                                    }}
                                                    className={`px-3 py-1 bg-white/5 border ${selectedExecutiveState === state ? 'border-tactical-amber text-tactical-amber' : 'border-white/10 text-white hover:border-white/30'} rounded-full text-[10px] font-medium uppercase tracking-wider transition-colors`}
                                                >
                                                    {state}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-2">
                                            <p className="font-serif italic text-base md:text-lg text-tactical-amber">
                                                {selectedExecutiveState || analysis.executive_state || analysis.tone || "Reflective"}
                                            </p>
                                            <button 
                                                onClick={() => setIsEditingExecutiveState(true)}
                                                className="text-gray-500 hover:text-tactical-amber transition-colors outline-none focus:outline-none ml-1"
                                                aria-label="Edit Executive State"
                                            >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                    {isExecutiveStateOverridden && !isEditingExecutiveState && (
                                        <p className="text-[9px] italic text-gray-500 mt-1">Adjusted before generation</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {(!analysis.emphasis_signals || analysis.emphasis_signals.length === 0) && (
                            <div className="mt-6 text-center">
                                <p className="text-[10px] text-gray-500 italic tracking-wide">
                                    {localT.strategist.record_longer_emphasis}
                                </p>
                            </div>
                        )}

                        {analysis.emphasis_signals && analysis.emphasis_signals.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-white/5">
                                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 text-center">{localT.labels?.high_emphasis_signals || "High-Emphasis Signals"}</p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {analysis.emphasis_signals.map((signal, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white font-medium uppercase tracking-wider">
                                            {signal}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Document Structure Selection */}
                {!isEditing && analysis && (
                    <div className="max-w-xs mx-auto mb-8 animate-in fade-in">
                        <div className="flex justify-center space-x-6 border-b border-white/10 pb-2">
                            <button
                                onClick={() => setStructureMode('Brief')}
                                className={`text-[11px] uppercase tracking-widest font-bold pb-2 relative transition-colors ${structureMode === 'Brief' ? 'text-gold-600' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Brief
                                {structureMode === 'Brief' && (
                                    <span className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-gold-600"></span>
                                )}
                            </button>
                            <button
                                onClick={() => setStructureMode('Detailed')}
                                className={`text-[11px] uppercase tracking-widest font-bold pb-2 relative transition-colors ${structureMode === 'Detailed' ? 'text-gold-600' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Detailed
                                {structureMode === 'Detailed' && (
                                    <span className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-gold-600"></span>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Generate Button or Skeleton Loading */}
                <div className="flex flex-col items-center">
                    {loading ? (
                        <div className="w-full max-w-2xl">
                            <div className="text-center mb-6">
                                <p className="text-tactical-amber text-sm uppercase tracking-widest animate-pulse">
                                    {localT.messages?.processing || "TRANSMUTING..."}
                                </p>
                            </div>
                            <SkeletonDashboard />
                        </div>
                    ) : !isEditing && (
                        <>
                            <motion.button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="btn-transmute w-full md:w-auto min-w-[280px]"
                                whileTap={{ scale: 0.96 }}
                            >
                                {localT.labels?.generate_suite || "GENERATE EXECUTIVE SUITE"}
                            </motion.button>
                            {error && <p className="mt-4 text-[#A88E65] text-sm italic">{error}</p>}
                        </>
                    )}
                </div>
            </div>
        );
    }

    const getTabContent = (id) => {
        if (!data) return "Initializing...";

        const freeData = data.free_tier || (data.core_thesis ? data : null);
        const proData = data.pro_tier || (data.judgment || data.executive_judgement ? data : null);
        const currentEditData = isEditingOutput ? (editedData?.free_tier || editedData) : null;
        const currentEditProData = isEditingOutput ? (editedData?.pro_tier || editedData) : null;

        if (id === 'scribe') {
            if (!freeData) return (
                <div className="flex flex-col items-center justify-center p-12 text-gray-400 italic">
                    <p>{localT.messages?.processing || "Processing..."}</p>
                </div>
            );

            const shortOutput = isShortOutput(freeData);

            // Insufficient input check (Improvement 5)
            const wordCount = getOutputWordCount(freeData);
            if (wordCount < 10 && !freeData.core_thesis) {
                return (
                    <div className="flex flex-col items-center justify-center p-16 text-center">
                        <p className="text-[#A88E65] text-base font-serif italic max-w-md leading-relaxed">
                            {localT.messages?.insufficient_input || "Insufficient input. Please record at least 60 seconds of your strategic thinking."}
                        </p>
                    </div>
                );
            }

            return (
                <div className={`space-y-8 md:space-y-12 animate-in fade-in duration-700 bg-white text-gray-900 p-5 md:p-12 ${shortOutput ? 'compact-output' : ''}`}>
                    {/* Process Transparency (Layer 1) */}
                    {renderProcessTransparency(freeData)}

                    {freeData.core_thesis && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0 }}
                        >
                            <div className="flex justify-between items-start mb-4 md:mb-6">
                                <h4 className="font-sans font-bold uppercase tracking-widest text-sm md:text-xs text-gold-600">{localT.scribe?.core_thesis || "CORE THESIS"}</h4>
                                <FlagButton sectionName="Core Thesis" outputType="Scribe" />
                            </div>
                            {isEditingOutput ? (
                                <div
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => updateEditedField('core_thesis', e.target.textContent)}
                                    className="font-playfair font-bold text-2xl md:text-5xl leading-tight text-gray-900 border border-dashed border-gold-600/30 p-4 rounded focus:outline-none focus:border-gold-600"
                                >
                                    {(currentEditData || freeData).core_thesis}
                                </div>
                            ) : (
                                <div className="font-playfair font-bold text-2xl md:text-5xl leading-tight text-gray-900">
                                    "{freeData.core_thesis}"
                                </div>
                            )}
                        </motion.div>
                    )}

                    {freeData.strategic_pillars && freeData.strategic_pillars.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.15 }}
                        >
                            <h4 className="font-sans font-bold uppercase tracking-widest text-sm md:text-xs text-gold-600 mb-4 md:mb-6">{localT.scribe?.strategic_pillars || "STRATEGIC PILLARS"}</h4>
                            <div className="space-y-8 md:space-y-12">
                                {freeData.strategic_pillars.map((pillar, idx) => (
                                    <div key={idx} className="border-l-2 border-gold-600/20 pl-6 md:pl-8 py-2 relative">
                                        <div className="absolute top-2 right-0">
                                            <FlagButton sectionName={`Strategic Pillar: ${pillar.title}`} outputType="Scribe" />
                                        </div>
                                        {isEditingOutput ? (
                                            <>
                                                <div
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    onBlur={(e) => updateEditedField(`strategic_pillars.${idx}.title`, e.target.textContent)}
                                                    className="font-sans font-bold text-gray-900 text-base md:text-lg uppercase tracking-wider mb-2 md:mb-4 leading-tight border border-dashed border-gold-600/30 p-2 rounded focus:outline-none focus:border-gold-600"
                                                >
                                                    {(currentEditData?.strategic_pillars?.[idx] || pillar).title}
                                                </div>
                                                <div
                                                    contentEditable
                                                    suppressContentEditableWarning
                                                    onBlur={(e) => updateEditedField(`strategic_pillars.${idx}.rich_description`, e.target.textContent)}
                                                    className="font-serif text-base md:text-xl text-gray-700 leading-relaxed max-w-2xl border border-dashed border-gray-300/50 p-2 rounded focus:outline-none focus:border-gold-600"
                                                >
                                                    {(currentEditData?.strategic_pillars?.[idx] || pillar).rich_description || (currentEditData?.strategic_pillars?.[idx] || pillar).description}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <h5 className="font-sans font-bold text-gray-900 text-base md:text-lg uppercase tracking-wider mb-2 md:mb-4 leading-tight">
                                                    {pillar.title}
                                                    {/* Layer 2: Decision Transparency — mark expanded pillars */}
                                                    {idx >= 2 && <TransparencyLabel type="context" t={localT} />}
                                                </h5>
                                                <p className="font-serif text-base md:text-xl text-gray-700 leading-relaxed max-w-2xl">
                                                    {pillar.rich_description || pillar.description}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {freeData.tactical_steps && freeData.tactical_steps.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <h4 className="font-sans font-bold uppercase tracking-widest text-sm md:text-xs text-gold-600 mb-4 md:mb-6">{localT.scribe?.tactical_steps || "TACTICAL STEPS"}</h4>
                            <ul className="space-y-3 md:space-y-4">
                                {freeData.tactical_steps.map((step, idx) => (
                                <li key={idx} className="flex items-start text-gray-900 text-sm font-sans group relative">
                                        <span className="mr-3 md:mr-4 w-6 h-6 rounded-full bg-gold-600/5 flex items-center justify-center text-gold-600 text-[10px] font-bold border border-gold-600/10 group-hover:bg-gold-600 group-hover:text-white transition-all flex-shrink-0">
                                            {idx + 1}
                                        </span>
                                        {isEditingOutput ? (
                                            <div
                                                contentEditable
                                                suppressContentEditableWarning
                                                onBlur={(e) => updateEditedField(`tactical_steps.${idx}`, e.target.textContent)}
                                                className="flex-1 pt-0.5 font-serif text-base border border-dashed border-gray-300/50 p-2 rounded focus:outline-none focus:border-gold-600 pr-8"
                                            >
                                                {(currentEditData?.tactical_steps?.[idx] || step)}
                                            </div>
                                        ) : (
                                            <span className="flex-1 pt-0.5 font-serif text-base pr-8">{step}</span>
                                        )}
                                        <div className="absolute top-1 right-0">
                                            <FlagButton sectionName={`Tactical Step ${idx + 1}`} outputType="Scribe" />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    )}
                </div>
            );
        }

        if (id === 'strategist') {
            return (
                <div className="relative bg-gray-900 text-white rounded-xl min-h-[500px]">
                    {!isPro && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-md rounded-xl p-6 md:p-8 text-center border border-yellow-500/20">
                            <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center mb-6 shadow-xl">
                                <span className="text-2xl">🔒</span>
                            </div>
                            <h3 className="font-playfair font-bold text-2xl text-white mb-4">{localT.strategist?.unlock_title || "Unlock The Strategist"}</h3>
                            <p className="text-gray-300 text-sm max-w-xs mb-8 leading-relaxed font-sans">
                                {localT.strategist?.unlock_desc || "The Strategist is your dedicated Chief of Staff suite. Upgrade to Pro to access Executive Judgement, Risk Audits, and ready-to-send Emails."}
                            </p>
                            <motion.button
                                onClick={() => setShowPaywall(true)}
                                className="bg-yellow-500 text-gray-900 px-8 py-3 rounded-full text-xs font-bold tracking-widest uppercase hover:bg-yellow-400 transition-all transform hover:scale-105"
                                whileTap={{ scale: 0.96 }}
                            >
                                {localT.buttons?.upgrade || "GET PRO"}
                            </motion.button>
                        </div>
                    )}

                    {!proData ? (
                        <div className="flex flex-col items-center justify-center p-12 text-gray-500 italic">
                            <p>{localT.messages?.processing || "Processing..."}</p>
                        </div>
                    ) : (
                        <div className={`transition-all duration-700 p-5 md:p-12 ${!isPro ? 'blur-md select-none opacity-40 grayscale-[0.5]' : 'animate-in fade-in'}`}>
                            <div className="space-y-8 md:space-y-12">
                                {/* Executive Judgement */}
                                {(proData.judgment || proData.executive_judgement) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.15 }}
                                        className="dossier-card p-5 md:p-6"
                                    >
                                        <div className="flex justify-between items-start mb-4 md:mb-6">
                                            <div className="flex items-center space-x-2">
                                                <span className="pulse-dot"></span>
                                                <h4 className="font-sans font-bold uppercase tracking-widest text-sm md:text-xs text-tactical-amber">
                                                    {localT.strategist?.judgment || "EXECUTIVE JUDGEMENT"}
                                                    <TransparencyLabel type="implication" t={localT} />
                                                </h4>
                                            </div>
                                            <FlagButton sectionName="Executive Judgement" outputType="Strategist" />
                                        </div>
                                        {isEditingOutput ? (
                                            <div
                                                contentEditable
                                                suppressContentEditableWarning
                                                onBlur={(e) => updateEditedField('judgment', e.target.innerHTML)}
                                                className="font-sans text-lg md:text-xl font-medium leading-snug text-white border border-dashed border-tactical-amber/30 p-4 rounded focus:outline-none focus:border-tactical-amber"
                                                dangerouslySetInnerHTML={{ __html: (currentEditProData?.judgment || currentEditProData?.executive_judgement || proData.judgment || proData.executive_judgement) }}
                                            />
                                        ) : (
                                            <div className="font-sans text-lg md:text-xl font-medium leading-snug text-white">
                                                {renderMarkdownBlock(proData.judgment || proData.executive_judgement)}
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Risk Audit */}
                                {(proData.riskAudit || proData.risk_audit) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                        className="dossier-card p-5 md:p-6"
                                    >
                                        <div className="flex justify-between items-start mb-4 md:mb-6">
                                            <div className="flex items-center space-x-2">
                                                <span className="pulse-dot"></span>
                                                <h4 className="font-sans font-bold uppercase tracking-widest text-sm md:text-xs text-red-400">{localT.strategist?.risk_audit || "RISK AUDIT"}</h4>
                                            </div>
                                            <FlagButton sectionName="Risk Audit" outputType="Strategist" />
                                        </div>
                                        {isEditingOutput ? (
                                            <div
                                                contentEditable
                                                suppressContentEditableWarning
                                                onBlur={(e) => updateEditedField('riskAudit', e.target.innerHTML)}
                                                className="font-mono text-xs md:text-sm text-red-400 bg-red-900/20 border border-dashed border-red-900/30 p-5 md:p-8 rounded-sm leading-relaxed focus:outline-none focus:border-red-500"
                                                dangerouslySetInnerHTML={{ __html: (currentEditProData?.riskAudit || currentEditProData?.risk_audit || proData.riskAudit || proData.risk_audit) }}
                                            />
                                        ) : (
                                            <div className="font-mono text-xs md:text-sm text-red-400 bg-red-900/20 border border-red-900/30 p-5 md:p-8 rounded-sm leading-relaxed">
                                                {renderMarkdownBlock(proData.riskAudit || proData.risk_audit)}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </div>

                            {/* Operationalize Section */}
                            <div className="mt-12 md:mt-16 pt-8 md:pt-12 border-t border-white/10">
                                <h4 className="font-sans font-bold uppercase tracking-widest text-xs text-white/40 mb-6 md:mb-8 text-center">{localT.strategist?.operationalize || "OPERATIONALIZE THIS STRATEGY"}</h4>

                                <div className="grid grid-cols-1 gap-6">
                                    <motion.button
                                        onClick={() => setShowEmail(!showEmail)}
                                        className={`p-5 md:p-6 border transition-all text-left group ${showEmail ? 'border-yellow-500 bg-yellow-500/5' : 'border-white/10 hover:border-yellow-500/30'}`}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-sans font-bold text-white text-[10px] uppercase tracking-widest">{localT.strategist?.email_draft || "EMAIL DRAFT"}</span>
                                            <span className="text-xs opacity-40 group-hover:opacity-100 transition-opacity">{showEmail ? '−' : '+'}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 font-light italic mt-1">
                                            {localT.strategist.email_draft_desc}
                                        </p>
                                    </motion.button>
                                </div>

                                {/* Collapsible Content */}
                                <div className="mt-6 md:mt-8 space-y-6">
                                    {showEmail && (proData.emailDraft || proData.email_draft) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="border border-yellow-500/20 p-5 md:p-8 bg-gray-800 rounded-lg"
                                        >
                                            {(() => {
                                                const rawEmail = proData.emailDraft || proData.email_draft;
                                                let subject = "No Subject";
                                                let body = "";

                                                if (typeof rawEmail === 'string') {
                                                    const parts = rawEmail.split('\n\n');
                                                    if (parts.length > 0) {
                                                        const subjectPart = parts[0];
                                                        const bodyParts = parts.slice(1);
                                                        subject = subjectPart.replace(/^SUBJECT:\s*/i, '');
                                                        body = bodyParts.join('\n\n');
                                                    } else {
                                                        body = rawEmail;
                                                    }
                                                } else if (rawEmail && typeof rawEmail === 'object') {
                                                    subject = rawEmail.subject;
                                                    body = rawEmail.body;
                                                }

                                                return (
                                                    <>
                                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-baseline mb-6 border-b border-white/5 pb-4 gap-4 md:gap-0">
                                                            <h5 className="font-sans font-bold text-white text-[10px] uppercase tracking-widest">{localT.strategist?.email_draft || "EMAIL DRAFT"}</h5>
                                                            <div className="flex space-x-4 w-full md:w-auto justify-between md:justify-end items-center">
                                                                <FlagButton sectionName="Email Draft" outputType="Strategist" />
                                                                <button
                                                                    onClick={() => copyToClipboard(body, localT.strategist?.email_draft || "Email")}
                                                                    className="text-xs md:text-[10px] text-tactical-amber hover:text-white uppercase tracking-widest"
                                                                >
                                                                    {localT.buttons?.copy || "COPY"}
                                                                </button>
                                                                <button onClick={() => setShowEmail(false)} className="text-xs md:text-[10px] text-white/40 hover:text-white uppercase tracking-widest">Close</button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <p className="text-[10px] uppercase tracking-widest text-white/40">Subject</p>
                                                            <p className="font-sans font-bold text-white text-base md:text-lg">{subject}</p>
                                                            <p className="text-[10px] uppercase tracking-widest text-white/40 mt-6">Message Body</p>
                                                            <div className="text-white/80 text-sm md:text-base leading-relaxed font-serif italic">{renderMarkdownBlock(body)}</div>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </motion.div>
                                    )}
                                </div>

                                {/* THE LOOP: Lock in Decision */}
                                <div className="mt-8 md:mt-12 bg-tactical-amber/5 border border-tactical-amber/20 p-5 md:p-8 rounded-xl">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <span className="text-2xl">⏳</span>
                                        <h4 className="font-bold text-white text-sm uppercase tracking-widest">{localT.wager?.lock_title || "THE LOOP"}</h4>
                                    </div>
                                    <p className="text-gray-400 text-xs mb-8 italic">
                                        {localT.wager?.lock_desc || "Don't just hope. Predict. Lock this decision to test your judgment accuracy later."}
                                    </p>

                                    {!showWagerModal ? (
                                        <motion.button
                                            onClick={() => setShowWagerModal(true)}
                                            className="w-full py-4 border border-tactical-amber text-tactical-amber text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-tactical-amber hover:text-black transition-all"
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            {localT.wager?.seal_btn || "SEAL JUDGMENT"}
                                        </motion.button>
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-6"
                                        >
                                            <div>
                                                <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 block">{localT.wager?.prediction_lbl || "YOUR PREDICTION"}</label>
                                                <textarea
                                                    value={wagerPrediction}
                                                    onChange={(e) => setWagerPrediction(e.target.value)}
                                                    placeholder={localT.wager?.prediction_placeholder || "What is the expected outcome in reality?"}
                                                    className="w-full bg-black/40 border border-white/10 rounded p-4 text-white text-sm focus:border-tactical-amber outline-none transition-colors h-24"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 block">{localT.wager?.timeline_lbl || "TIMELINE"}</label>
                                                <div className="flex space-x-4">
                                                    {[30, 90, 365].map(days => (
                                                        <button
                                                            key={days}
                                                            onClick={() => setWagerDays(days)}
                                                            className={`flex-1 py-3 text-[10px] font-bold rounded border ${wagerDays === days ? 'bg-tactical-amber text-black border-tactical-amber' : 'border-white/10 text-gray-400'}`}
                                                        >
                                                            {days === 365 ? '1 Year' : `${days} Days`}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 pt-4">
                                                <button
                                                    onClick={handleSealWager}
                                                    disabled={sealingWager || !wagerPrediction}
                                                    className="flex-1 bg-tactical-amber text-black font-bold py-4 rounded text-[10px] uppercase tracking-widest disabled:opacity-50"
                                                >
                                                    {sealingWager ? (localT.wager?.sealing || "SEALING...") : (localT.wager?.confirm_btn || "CONFIRM")}
                                                </button>
                                                <button
                                                    onClick={() => setShowWagerModal(false)}
                                                    className="px-6 py-4 md:py-0 border border-white/10 text-gray-500 text-[10px] uppercase tracking-widest"
                                                >
                                                    {localT.wager?.cancel_btn || "CANCEL"}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        return "No content available.";
    };

    const getTextToShare = () => {
        if (!data) return "";
        const freeData = data.free_tier || (data.core_thesis ? data : null);
        const proData = data.pro_tier || (data.executive_judgement ? data : null);

        if (activeTab === 'scribe' && freeData) {
            const pillarsText = (freeData.strategic_pillars || []).map(p => `${p.title}\n${p.rich_description || p.description}`).join('\n\n');
            const tacticalText = (freeData.tactical_steps || []).map(s => `- ${s}`).join('\n');
            return `${localT.scribe?.title || "CORE THESIS"}: ${freeData.core_thesis}\n\n${localT.scribe?.strategic_pillars || "STRATEGIC PILLARS"}:\n${pillarsText}\n\n${localT.scribe?.tactical_steps || "TACTICAL STEPS"}:\n${tacticalText}`;
        }
        if (activeTab === 'strategist' && isPro && proData) {
            const judgmentContent = analysis?.content?.executive_state || localT.strategist.no_judgment;
            const riskContent = analysis?.content?.strategic_pillars || localT.strategist.no_risk_audit;
            return `${localT.strategist?.judgment || "JUDGMENT"}: ${judgmentContent}\n\n${localT.strategist?.risk_audit || "RISK AUDIT"}: ${riskContent}`;
        }
        return "";
    };

    return (
        <div className="card-container fade-in">
            {/* New Session Button & Status */}
            <div className="mb-4 md:mb-8 flex flex-col md:flex-row justify-between items-start md:items-center px-0 md:px-4 gap-y-4 md:gap-y-0">
                <motion.button
                    onClick={onReset}
                    className="flex items-center space-x-2 text-[#999] hover:text-[#A88E65] transition-all text-xs md:text-[11px] uppercase tracking-[0.2em] py-2 md:py-0"
                    whileTap={{ scale: 0.96 }}
                >
                    <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>{localT.labels?.new_session || "NEW SESSION"}</span>
                </motion.button>

                <div className="flex items-center space-x-4">
                    {/* Edit Output Button (Improvement 2) */}
                    {data && !isEditingOutput && (
                        <button
                            onClick={handleStartEditOutput}
                            className="text-[10px] uppercase tracking-[0.2em] text-[#A88E65] hover:text-white transition-colors font-bold flex items-center space-x-1"
                        >
                            <span>✏️</span>
                            <span>{localT.buttons?.edit_output || "Edit"}</span>
                        </button>
                    )}
                    <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] text-[#A88E65] font-bold">
                        {localT.labels?.exec_status || "STATUS"}: {isPro ? (localT.labels?.pro || "PRO") : (localT.labels?.standard || "STANDARD")}
                    </div>
                </div>
            </div>

            {/* Edit Output Action Bar (Improvement 2) */}
            {isEditingOutput && (
                <div className="mb-6 flex flex-wrap justify-center gap-3 px-4">
                    <button
                        onClick={handleSaveEditedOutput}
                        className="px-6 py-2.5 bg-[#A88E65] text-black text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-white transition-all"
                    >
                        {localT.buttons?.save_edited || "Save"}
                    </button>
                    <button
                        onClick={() => {
                            handleSaveEditedOutput();
                            // Trigger share view by scrolling to share actions
                            setTimeout(() => {
                                document.querySelector('.share-actions-section')?.scrollIntoView({ behavior: 'smooth' });
                            }, 300);
                        }}
                        className="px-6 py-2.5 border border-[#A88E65] text-[#A88E65] text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-[#A88E65] hover:text-black transition-all"
                    >
                        {localT.buttons?.share_edited || "Share"}
                    </button>
                    <button
                        onClick={handleRevertOutput}
                        className="px-6 py-2.5 border border-white/10 text-gray-500 text-[10px] font-bold uppercase tracking-widest rounded-sm hover:text-white transition-all"
                    >
                        {localT.buttons?.revert_original || "Revert to Original"}
                    </button>
                    <button
                        onClick={() => { setIsEditingOutput(false); setEditedData(null); }}
                        className="px-6 py-2.5 text-gray-600 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-all"
                    >
                        {localT.buttons?.cancel || "Cancel"}
                    </button>
                </div>
            )}

            {/* The Main Card */}
            <div className="bg-white w-full max-w-4xl mx-auto rounded-xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] overflow-hidden border border-gray-100">

                {/* Tab Bar */}
                <div className="flex border-b border-gray-50 bg-gray-50/30">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-5 md:py-8 px-2 md:px-4 text-center transition-all relative ${activeTab === tab.id
                                ? 'text-[#1A1A1A] bg-white'
                                : 'text-gray-400 hover:text-gray-600 bg-transparent'
                                }`}
                        >
                            <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.3em] mb-2 font-sans">
                                {tab.label}
                            </div>
                            <div className="hidden md:block text-[10px] text-gray-400 italic font-normal tracking-tight max-w-[220px] mx-auto leading-relaxed">
                                {tab.subtext}
                            </div>
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#A88E65]"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className={`p-0 min-h-[500px] ${activeTab === 'scribe' ? 'bg-white' : 'bg-gray-900'}`}>
                    {getTabContent(activeTab)}
                </div>
            </div>

            {/* Action Buttons: Archive + PDF Export */}
            {data && (
                <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-12 mt-8 md:mt-0">
                    <motion.button
                        onClick={() => {
                            const id = `cos_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
                            const archiveData = {
                                id,
                                timestamp: Date.now(),
                                content: data.free_tier || data.pro_tier || data,
                                analysis: { audit: analysis },
                                mode: activeTab,
                                language: languageName
                            };

                            try {
                                localStorage.setItem(`ghostnote_archive_${id}`, JSON.stringify(archiveData));
                                const url = `https://www.ghostnotepro.com/archive/${id}`;
                                navigator.clipboard.writeText(url);
                                onShowToast(localT.messages?.archive_success || "Strategic brief archived. Link copied.");
                            } catch (err) {
                                console.error("Archive failed", err);
                                onShowToast(localT.messages?.archive_fail || "Archiving was interrupted. Please try once more.");
                            }
                        }}
                        className="w-full md:w-auto bg-black text-white border border-gray-800 px-8 py-4 font-sans text-xs font-bold uppercase tracking-[0.2em] hover:bg-tactical-amber hover:text-black hover:border-tactical-amber transition-all shadow-lg"
                        whileTap={{ scale: 0.98 }}
                    >
                        {localT.labels?.archive_share || "ARCHIVE TO MUSEUM"}
                    </motion.button>

                    <motion.button
                        onClick={() => {
                            exportToPDF(data, activeTab, {
                                transcript: text,
                                analysis: analysis,
                                industry: industry
                            });
                            onShowToast("PDF export ready");
                        }}
                        className="w-full md:w-auto bg-transparent text-tactical-amber border border-tactical-amber/40 px-8 py-4 font-sans text-xs font-bold uppercase tracking-[0.2em] hover:bg-tactical-amber hover:text-black transition-all shadow-lg flex items-center justify-center space-x-2"
                        whileTap={{ scale: 0.98 }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>EXPORT PDF</span>
                    </motion.button>
                </div>
            )}

            {/* Share Actions */}
            <div className="share-actions-section">
                <ShareActions
                    sessionId={sessionId}
                    textToShare={getTextToShare()}
                    analysisResult={data}
                    url={data ? `https://www.ghostnotepro.com/archive/${draftId || 'latest'}` : "https://www.ghostnotepro.com"}
                    isPro={isPro}
                    onPaywallTrigger={() => setShowPaywall(true)}
                    onShowToast={onShowToast}
                    t={localT}
                />
            </div>

            {/* Paywall Modal */}
            {showPaywall && (
                <PaywallModal
                    onClose={() => setShowPaywall(false)}
                    scenario="upsell"
                    t={localT}
                />
            )}
        </div>
    );
};

export default SynthesisResult;
