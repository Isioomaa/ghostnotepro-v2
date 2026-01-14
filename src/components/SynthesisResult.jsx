import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaCopy, FaShareAlt, FaChevronDown, FaLock, FaListUl } from 'react-icons/fa';
import { generateExecutiveSuite, updateDraft } from '../services/gemini';
import { TRANSLATIONS } from '../constants/languages';
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

const SynthesisResult = ({ text, analysis, languageName, currentLang, t, onReset, isPro, onShowToast, initialData, draftId, onEdit, industry }) => {
    const [data, setData] = useState(null);
    const [sessionId, setSessionId] = useState(null); // Kept for future use
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

    // Default translation fallback
    const localT = t || TRANSLATIONS.EN;

    // Initialize with initialData if provided (e.g. from a loaded draft)
    useEffect(() => {
        if (initialData) {
            setData(initialData);
        }
    }, [initialData]);

    // Update editableText if text prop changes (e.g. loading a draft)
    useEffect(() => {
        setEditableText(text);
    }, [text]);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('🚀 Starting generation. isPro:', isPro);
            console.log('--- Industry Context:', industry);

            // Always generate Scribe content (base layer) using edited text
            const scribePromise = generateExecutiveSuite(editableText, analysis, languageName, 'scribe', isPro, industry);

            // If Pro, also generate Strategist content
            if (isPro) {
                console.log('💎 Pro user detected. Triggering Strategist...');
            } else {
                console.log('⚪ Free user detected. Skipping Strategist.');
            }

            const strategistPromise = isPro
                ? generateExecutiveSuite(editableText, analysis, languageName, 'strategist', isPro, industry)
                : Promise.resolve({});

            const results = await Promise.allSettled([scribePromise, strategistPromise]);

            const scribeResult = results[0];
            const strategistResult = results[1];

            console.log('Scribe Result Status:', scribeResult.status);
            console.log('Strategist Result Status:', strategistResult.status);

            let combinedResult = {};
            let strategistError = null;

            if (scribeResult.status === 'fulfilled' && scribeResult.value) {
                combinedResult = { ...combinedResult, ...scribeResult.value };
                console.log('✅ Scribe fulfilled with keys:', Object.keys(scribeResult.value));
            } else if (scribeResult.status === 'rejected') {
                console.error('❌ Scribe failed:', scribeResult.reason);
            }

            if (strategistResult.status === 'fulfilled' && strategistResult.value) {
                combinedResult = { ...combinedResult, ...strategistResult.value };
                console.log('✅ Strategist fulfilled with keys:', Object.keys(strategistResult.value));
            } else if (strategistResult.status === 'rejected') {
                console.error('❌ Strategist failed:', strategistResult.reason);
                strategistError = strategistResult.reason?.message || "Strategist generation failed.";
            }

            console.log('🏁 Final Combined Data keys:', Object.keys(combinedResult));

            if (Object.keys(combinedResult).length === 0) {
                throw new Error("Both generation modes failed. Please try again.");
            }

            setData(combinedResult);
            if (strategistError) setError(strategistError);

            // Auto-update draft if we have an active draft ID
            if (draftId) {
                console.log(`💾 Auto-updating draft ${draftId} with generated content.`);
                updateDraft(draftId, {
                    content: combinedResult,
                    // Update status to 'complete'? Or just let the presence of content define it.
                    // We could add a 'last_updated' timestamp
                    last_updated: new Date().toISOString()
                });
            }

        } catch (err) {
            console.error('❌ Generation failed:', err);
            setError(localT.messages?.transmutation_fail || "The transmuter encountered an error.");
        } finally {
            setLoading(false);
        }
    };

    const handleSealWager = async () => {
        if (!wagerPrediction) return;
        setSealingWager(true);
        try {
            const { sealWager } = await import('../services/gemini');
            await sealWager(sessionId, wagerPrediction, wagerDays);
            setShowWagerModal(false);
            onShowToast(localT.wager?.success || "Wager sealed.");
        } catch (err) {
            onShowToast(localT.wager?.fail || "Failed to seal wager.");
        } finally {
            setSealingWager(false);
        }
    };

    const copyToClipboard = (content, label) => {
        navigator.clipboard.writeText(content);
        const msg = (localT.messages?.copy_success || "Link copied").replace('Link ', '');
        onShowToast(`${label} ${msg}`);
    };

    // Derived Tabs using Translations
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
                                    Specializing in {industry}
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
                                        handleGenerate(); // User flow: Save & Generate
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
                                <p className="font-serif italic text-base md:text-lg text-tactical-amber">
                                    {analysis.executive_state || analysis.tone || "Reflective"}
                                </p>
                            </div>
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
                            {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
                        </>
                    )}
                </div>
            </div>
        );
    }

    const getTabContent = (id) => {
        if (!data) return "Initializing...";

        // Robust check for data existence
        // Scribe data usually has core_thesis
        // Strategist data has judgment (or executive_judgement as legacy fallback)
        const freeData = data.free_tier || (data.core_thesis ? data : null);
        const proData = data.pro_tier || (data.judgment || data.executive_judgement ? data : null);

        if (id === 'scribe') {
            if (!freeData) return (
                <div className="flex flex-col items-center justify-center p-12 text-gray-400 italic">
                    <p>{localT.messages?.processing || "Processing..."}</p>
                </div>
            );

            return (
                <div className="space-y-8 md:space-y-12 animate-in fade-in duration-700 bg-white text-gray-900 p-5 md:p-12">
                    {freeData.core_thesis && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0 }}
                        >
                            <h4 className="font-sans font-bold uppercase tracking-widest text-sm md:text-xs text-gold-600 mb-4 md:mb-6">{localT.scribe?.core_thesis || "CORE THESIS"}</h4>
                            <div className="font-playfair font-bold text-2xl md:text-5xl leading-tight text-gray-900">
                                "{freeData.core_thesis}"
                            </div>
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
                                    <div key={idx} className="border-l-2 border-gold-600/20 pl-6 md:pl-8 py-2">
                                        <h5 className="font-sans font-bold text-gray-900 text-base md:text-lg uppercase tracking-wider mb-2 md:mb-4 leading-tight">{pillar.title}</h5>
                                        <p className="font-serif text-base md:text-xl text-gray-700 leading-relaxed max-w-2xl">
                                            {pillar.rich_description || pillar.description}
                                        </p>
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
                                    <li key={idx} className="flex items-start text-gray-900 text-sm font-sans group">
                                        <span className="mr-3 md:mr-4 w-6 h-6 rounded-full bg-gold-600/5 flex items-center justify-center text-gold-600 text-[10px] font-bold border border-gold-600/10 group-hover:bg-gold-600 group-hover:text-white transition-all flex-shrink-0">
                                            {idx + 1}
                                        </span>
                                        <span className="flex-1 pt-0.5 font-serif text-base">{step}</span>
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
                            <h3 className="font-playfair font-bold text-2xl text-white mb-4">{localT.strategist?.unlock_title || "Unlock Executive Level"}</h3>
                            <p className="text-gray-300 text-sm max-w-xs mb-8 leading-relaxed font-sans">
                                {localT.strategist?.unlock_desc || "Upgrade to Pro to see this content."}
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
                                        <div className="flex items-center space-x-2 mb-4 md:mb-6">
                                            <span className="pulse-dot"></span>
                                            <h4 className="font-sans font-bold uppercase tracking-widest text-sm md:text-xs text-tactical-amber">{localT.strategist?.judgment || "EXECUTIVE JUDGMENT"}</h4>
                                        </div>
                                        <div className="font-sans text-lg md:text-xl font-medium leading-snug text-white">
                                            {proData.judgment || proData.executive_judgement}
                                        </div>
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
                                        <div className="flex items-center space-x-2 mb-4 md:mb-6">
                                            <span className="pulse-dot"></span>
                                            <h4 className="font-sans font-bold uppercase tracking-widest text-sm md:text-xs text-red-400">{localT.strategist?.risk_audit || "RISK AUDIT"}</h4>
                                        </div>
                                        <div className="font-mono text-xs md:text-sm text-red-400 bg-red-900/20 border border-red-900/30 p-5 md:p-8 rounded-sm leading-relaxed whitespace-pre-wrap">
                                            {proData.riskAudit || proData.risk_audit}
                                        </div>
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
                                        <p className="text-xs text-white/50 font-serif italic">Review the persuasively drafted communication for your stakeholders.</p>
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
                                                            <div className="flex space-x-4 w-full md:w-auto justify-between md:justify-end">
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
                                                            <p className="text-white/80 text-sm md:text-base whitespace-pre-wrap leading-relaxed font-serif italic">{body}</p>
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
                                        {localT.wager?.lock_desc || "Lock in your prediction now."}
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
                                                    placeholder={localT.wager?.prediction_placeholder || "I predict that..."}
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
            const judgment = proData.judgment || proData.executive_judgement || "No judgment available";
            const riskAudit = proData.riskAudit || proData.risk_audit || "No risk audit available";
            return `${localT.strategist?.judgment || "JUDGMENT"}: ${judgment}\n\n${localT.strategist?.risk_audit || "RISK AUDIT"}: ${riskAudit}`;
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

                <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] text-[#A88E65] font-bold">
                    {localT.labels?.exec_status || "STATUS"}: {isPro ? (localT.labels?.pro || "PRO") : (localT.labels?.standard || "STANDARD")}
                </div>
            </div>

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

            {/* Museum Mode: Archive Action */}
            {data && (
                <div className="flex justify-center mb-12 mt-8 md:mt-0">
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
                                const url = `https://ghostnotepro.com/archive/${id}`;
                                navigator.clipboard.writeText(url);
                                onShowToast(localT.messages?.archive_success || "Archive Saved");
                            } catch (err) {
                                console.error("Archive failed", err);
                                onShowToast(localT.messages?.archive_fail || "Failed to Archive");
                            }
                        }}
                        className="w-full md:w-auto bg-black text-white border border-gray-800 px-8 py-4 font-sans text-xs font-bold uppercase tracking-[0.2em] hover:bg-tactical-amber hover:text-black hover:border-tactical-amber transition-all shadow-lg"
                        whileTap={{ scale: 0.98 }}
                    >
                        {localT.labels?.archive_share || "ARCHIVE TO MUSEUM"}
                    </motion.button>
                </div>
            )}

            {/* Share Actions */}
            <ShareActions
                sessionId={sessionId}
                textToShare={getTextToShare()}
                analysisResult={data}
                url={data ? `https://ghostnotepro.com/archive/${draftId || 'latest'}` : "https://ghostnotepro.com"}
                isPro={isPro}
                onPaywallTrigger={() => setShowPaywall(true)}
                onShowToast={onShowToast}
                t={localT}
            />

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
