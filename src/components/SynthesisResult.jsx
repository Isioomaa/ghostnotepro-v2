import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShareActions from './ShareActions';
import PaywallModal from './PaywallModal';
import EmphasisAudit from './EmphasisAudit';
import { generateExecutiveSuite } from '../services/gemini';

// Skeleton Loader Component
const SkeletonCard = () => (
    <div className="dossier-card p-6 space-y-4">
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
    <div className="space-y-6 p-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
    </div>
);

const SynthesisResult = ({ text, analysis, languageName, onReset, isPro, onShowToast }) => {
    const [data, setData] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('scribe');
    const [showPaywall, setShowPaywall] = useState(false);
    const [showEmail, setShowEmail] = useState(false);
    const [showActionPlan, setShowActionPlan] = useState(false);
    const [showWagerModal, setShowWagerModal] = useState(false);
    const [wagerPrediction, setWagerPrediction] = useState('');
    const [wagerDays, setWagerDays] = useState(30);
    const [sealingWager, setSealingWager] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await generateExecutiveSuite(text, analysis, languageName, false, 'scribe', isPro);
            // Result is now the content object (core_thesis etc.)
            // We might need to wrap it to match existing `data` structure which seemed to expect keys directly?
            // The previous code expected `setData(result.data)` but result IS the data now.
            // Wait, previous code: `setData(result.data); setSessionId(result.session_id);`
            // My gemini.js returns `data.content`. It does NOT return session_id currently.
            // API doesn't return session_id.

            // Merge into existing structure. 
            // If data is null, we set it. If data exists, we might merge? 
            // For now, let's just set it. Struct: { core_thesis: ..., strategic_pillars: ... } matches `free_tier` expectation?
            // SynthesisResult `getTabContent` checks `data.free_tier` OR `data.core_thesis`.
            // So returning direct object is fine.
            setData(result);
            // setSessionId(result.session_id); // API doesn't support this yet, ignore.
        } catch (err) {
            console.error(err);
            setError("The transmuter encountered an error. Please try again.");
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
            onShowToast("Time Capsule Sealed. Judgment locked.");
        } catch (err) {
            onShowToast("Failed to seal time capsule.");
        } finally {
            setSealingWager(false);
        }
    };

    const copyToClipboard = (content, label) => {
        navigator.clipboard.writeText(content);
        onShowToast(`${label} copied to clipboard`);
    };

    if (!data) {
        return (
            <div className="space-y-12 transition-opacity duration-500 fade-in">
                {/* Transcription */}
                <div className="text-center px-4">
                    <p className="text-[#999] text-xs uppercase tracking-widest mb-4">Transcription</p>
                    <p className="text-[#F9F7F5] leading-relaxed max-w-lg mx-auto whitespace-pre-wrap">{text}</p>
                </div>

                {/* Analysis */}
                {analysis && (
                    <div className="flex justify-center space-x-16">
                        <div className="text-center">
                            <p className="text-[#999] text-xs uppercase tracking-widest mb-2">Tone</p>
                            <p className="font-serif text-xl text-[#F9F7F5]">{analysis.tone}</p>
                        </div>
                    </div>
                )}

                {/* Generate Button or Skeleton Loading */}
                <div className="flex flex-col items-center">
                    {loading ? (
                        <div className="w-full max-w-2xl">
                            <div className="text-center mb-6">
                                <p className="text-tactical-amber text-sm uppercase tracking-widest animate-pulse">
                                    Transmuting your thoughts...
                                </p>
                            </div>
                            <SkeletonDashboard />
                        </div>
                    ) : (
                        <>
                            <motion.button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="btn-transmute min-w-[280px]"
                                whileTap={{ scale: 0.96 }}
                            >
                                GENERATE EXECUTIVE SUITE
                            </motion.button>
                            {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Results View
    const tabs = [
        {
            id: 'scribe',
            label: 'The Scribe',
            subtext: 'Refines and clarifies your thoughts into structured, articulate content.'
        },
        {
            id: 'strategist',
            label: 'The Strategist',
            subtext: 'Applies executive reasoning to challenge, deepen, and operationalize your thinking.'
        }
    ];

    const getTabContent = (id) => {
        if (!data) return "Initializing...";

        const freeData = data.free_tier || (data.core_thesis ? data : null);
        const proData = data.pro_tier || (data.executive_judgement ? data : null);

        if (id === 'scribe') {
            if (!freeData) return (
                <div className="flex flex-col items-center justify-center p-12 text-gray-400 italic">
                    <p>The Scribe is refining your thoughts. Please wait or try generating again.</p>
                </div>
            );

            return (
                <div className="space-y-12 animate-in fade-in duration-700 bg-white text-gray-900 p-6 md:p-12">
                    {freeData.core_thesis && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0 }}
                        >
                            <h4 className="font-sans font-bold uppercase tracking-widest text-xs text-gold-600 mb-6">Core Thesis</h4>
                            <div className="font-playfair font-bold text-3xl md:text-5xl leading-tight md:leading-none text-gray-900">
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
                            <h4 className="font-sans font-bold uppercase tracking-widest text-xs text-gold-600 mb-6">Strategic Pillars</h4>
                            <div className="space-y-12">
                                {freeData.strategic_pillars.map((pillar, idx) => (
                                    <div key={idx} className="border-l-2 border-gold-600/20 pl-8 py-2">
                                        <h5 className="font-sans font-bold text-gray-900 text-lg uppercase tracking-wider mb-4 leading-tight">{pillar.title}</h5>
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
                            <h4 className="font-sans font-bold uppercase tracking-widest text-xs text-gold-600 mb-6">Tactical Steps</h4>
                            <ul className="space-y-4">
                                {freeData.tactical_steps.map((step, idx) => (
                                    <li key={idx} className="flex items-start text-gray-900 text-sm font-sans group">
                                        <span className="mr-4 w-6 h-6 rounded-full bg-gold-600/5 flex items-center justify-center text-gold-600 text-[10px] font-bold border border-gold-600/10 group-hover:bg-gold-600 group-hover:text-white transition-all">
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
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-md rounded-xl p-8 text-center border border-yellow-500/20">
                            <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center mb-6 shadow-xl">
                                <span className="text-2xl">🔒</span>
                            </div>
                            <h3 className="font-playfair font-bold text-2xl text-white mb-4">Unlock The Strategist</h3>
                            <p className="text-gray-300 text-sm max-w-xs mb-8 leading-relaxed font-sans">
                                Get executive-grade judgment, recursive risk audits, and ready-to-send execution assets.
                            </p>
                            <motion.button
                                onClick={() => setShowPaywall(true)}
                                className="bg-yellow-500 text-gray-900 px-8 py-3 rounded-full text-xs font-bold tracking-widest uppercase hover:bg-yellow-400 transition-all transform hover:scale-105"
                                whileTap={{ scale: 0.96 }}
                            >
                                Upgrade to Pro
                            </motion.button>
                        </div>
                    )}

                    {!proData ? (
                        <div className="flex flex-col items-center justify-center p-12 text-gray-500 italic">
                            <p>The Strategist is analyzing risks. This requires executive status.</p>
                        </div>
                    ) : (
                        <div className={`transition-all duration-700 p-6 md:p-12 ${!isPro ? 'blur-md select-none opacity-40 grayscale-[0.5]' : 'animate-in fade-in'}`}>
                            <div className="space-y-12">
                                {/* Emphasis Audit - Staggered Entry 0ms */}
                                {proData.emphasis_audit && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0 }}
                                    >
                                        <EmphasisAudit audit={proData.emphasis_audit} />
                                    </motion.div>
                                )}

                                {/* Executive Judgement - Staggered Entry 150ms */}
                                {proData.executive_judgement && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.15 }}
                                        className="dossier-card p-6"
                                    >
                                        <div className="flex items-center space-x-2 mb-6">
                                            <span className="pulse-dot"></span>
                                            <h4 className="font-sans font-bold uppercase tracking-widest text-xs text-tactical-amber">Executive Judgement</h4>
                                        </div>
                                        <div className="font-sans text-lg md:text-xl font-medium leading-snug text-white">
                                            {proData.executive_judgement}
                                        </div>
                                    </motion.div>
                                )}

                                {/* Risk Audit */}
                                {proData.risk_audit && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                        className="dossier-card p-6"
                                    >
                                        <div className="flex items-center space-x-2 mb-6">
                                            <span className="pulse-dot"></span>
                                            <h4 className="font-sans font-bold uppercase tracking-widest text-xs text-red-400">Risk Audit (Blind Spot)</h4>
                                        </div>
                                        <div className="font-mono text-sm text-red-400 bg-red-900/20 border border-red-900/30 p-8 rounded-sm leading-relaxed">
                                            {proData.risk_audit}
                                        </div>
                                    </motion.div>
                                )}

                                {/* THE GUILLOTINE - Staggered Entry 300ms */}
                                {proData.the_guillotine && proData.the_guillotine.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.3 }}
                                        className="guillotine-card p-6"
                                    >
                                        <div className="flex items-center space-x-2 mb-4">
                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                            <h4 className="font-sans font-bold uppercase tracking-widest text-xs text-red-500">The Guillotine</h4>
                                        </div>
                                        <p className="text-gray-400 text-xs italic mb-6">
                                            Efficiency isn't about doing more. It's about stopping. These are your energy drains.
                                        </p>
                                        <div className="space-y-4">
                                            {proData.the_guillotine.map((item, idx) => (
                                                <div key={idx} className="border-l-2 border-red-500/50 pl-4 py-2">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-bold text-white">{item.target}</span>
                                                        <span className={`text-xs font-bold px-2 py-1 rounded ${item.verdict === 'TERMINATE' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                            {item.verdict}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-400 text-sm">{item.reason}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* PRE-MORTEM RISKS */}
                                {proData.pre_mortem_risks && proData.pre_mortem_risks.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.35 }}
                                        className="dossier-card p-6"
                                    >
                                        <div className="flex items-center space-x-2 mb-4">
                                            <span className="pulse-dot"></span>
                                            <h4 className="font-sans font-bold uppercase tracking-widest text-xs text-tactical-amber">Pre-Mortem Analysis</h4>
                                        </div>
                                        <p className="text-gray-400 text-xs italic mb-6">
                                            Assuming this plan fails, here's why it would happen.
                                        </p>
                                        <div className="space-y-4">
                                            {proData.pre_mortem_risks.map((risk, idx) => (
                                                <div key={idx} className="bg-zinc-800/50 p-4 rounded">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-bold text-white text-sm">{risk.risk}</span>
                                                        <span className={`text-xs font-bold px-2 py-1 rounded ${risk.likelihood === 'High' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                                            {risk.likelihood}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-400 text-xs"><span className="text-tactical-amber">Mitigation:</span> {risk.mitigation}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}

                                {/* IMMEDIATE PROTOCOLS */}
                                {proData.immediate_protocols && proData.immediate_protocols.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.4 }}
                                        className="dossier-card p-6"
                                    >
                                        <div className="flex items-center space-x-2 mb-4">
                                            <span className="pulse-dot"></span>
                                            <h4 className="font-sans font-bold uppercase tracking-widest text-xs text-tactical-amber">Immediate Protocols</h4>
                                        </div>
                                        <p className="text-gray-400 text-xs italic mb-6">
                                            Ready-to-send action assets. Just copy and send.
                                        </p>
                                        <div className="space-y-4">
                                            {proData.immediate_protocols.map((protocol, idx) => (
                                                <div key={idx} className="bg-zinc-800/50 p-4 rounded">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-sm">{protocol.platform === 'Email' ? '📧' : '💬'}</span>
                                                            <span className="font-bold text-white text-sm">{protocol.title}</span>
                                                        </div>
                                                        <motion.button
                                                            onClick={() => copyToClipboard(protocol.content, protocol.title)}
                                                            className="text-xs text-tactical-amber hover:text-white transition-colors"
                                                            whileTap={{ scale: 0.96 }}
                                                        >
                                                            Copy
                                                        </motion.button>
                                                    </div>
                                                    <p className="text-gray-300 text-sm font-mono bg-zinc-900/50 p-3 rounded whitespace-pre-wrap">
                                                        {protocol.content}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Operationalize Section */}
                            <div className="mt-16 pt-12 border-t border-white/10">
                                <h4 className="font-sans font-bold uppercase tracking-widest text-xs text-white/40 mb-8 text-center">Operationalize This Strategy</h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <motion.button
                                        onClick={() => setShowEmail(!showEmail)}
                                        className={`p-6 border transition-all text-left group ${showEmail ? 'border-yellow-500 bg-yellow-500/5' : 'border-white/10 hover:border-yellow-500/30'}`}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-sans font-bold text-white text-[10px] uppercase tracking-widest">Executive Email</span>
                                            <span className="text-xs opacity-40 group-hover:opacity-100 transition-opacity">{showEmail ? '−' : '+'}</span>
                                        </div>
                                        <p className="text-xs text-white/50 font-serif italic">Review the persuasively drafted communication for your stakeholders.</p>
                                    </motion.button>

                                    <motion.button
                                        onClick={() => setShowActionPlan(!showActionPlan)}
                                        className={`p-6 border transition-all text-left group ${showActionPlan ? 'border-yellow-500 bg-yellow-500/5' : 'border-white/10 hover:border-yellow-500/30'}`}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-sans font-bold text-white text-[10px] uppercase tracking-widest">30-Day Action Plan</span>
                                            <span className="text-xs opacity-40 group-hover:opacity-100 transition-opacity">{showActionPlan ? '−' : '+'}</span>
                                        </div>
                                        <p className="text-xs text-white/50 font-serif italic">Operationalize the roadmap with specific owners and milestones.</p>
                                    </motion.button>
                                </div>

                                {/* Collapsible Content */}
                                <div className="mt-8 space-y-6">
                                    {showEmail && (proData.execution_assets?.email_draft || proData.email_draft) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="border border-yellow-500/20 p-8 bg-gray-800 rounded-lg"
                                        >
                                            {(() => {
                                                const email = proData.execution_assets?.email_draft || proData.email_draft;
                                                return (
                                                    <>
                                                        <div className="flex justify-between items-baseline mb-6 border-b border-white/5 pb-4">
                                                            <h5 className="font-sans font-bold text-white text-[10px] uppercase tracking-widest">Drafted Communication</h5>
                                                            <button onClick={() => setShowEmail(false)} className="text-[10px] text-white/40 hover:text-white">Close</button>
                                                        </div>
                                                        <div className="space-y-4">
                                                            <p className="text-[10px] uppercase tracking-widest text-white/40">Subject</p>
                                                            <p className="font-sans font-bold text-white text-lg">{email.subject}</p>
                                                            <p className="text-[10px] uppercase tracking-widest text-white/40 mt-6">Message Body</p>
                                                            <p className="text-white/80 text-base whitespace-pre-wrap leading-relaxed font-serif italic">{email.body}</p>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </motion.div>
                                    )}

                                    {showActionPlan && (proData.execution_assets?.action_plan || proData.action_plan) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="border border-yellow-500/20 p-8 bg-gray-800 rounded-lg"
                                        >
                                            {(() => {
                                                const roadmap = proData.execution_assets?.action_plan || proData.action_plan;
                                                return (
                                                    <>
                                                        <div className="flex justify-between items-baseline mb-8 border-b border-white/5 pb-4">
                                                            <h5 className="font-sans font-bold text-white text-[10px] uppercase tracking-widest">Strategic Roadmap</h5>
                                                            <button onClick={() => setShowActionPlan(false)} className="text-[10px] text-white/40 hover:text-white">Close</button>
                                                        </div>
                                                        <div className="space-y-6">
                                                            {roadmap.map((item, idx) => (
                                                                <div key={idx} className="flex items-start space-x-4 border-b border-white/5 pb-4 last:border-0">
                                                                    <span className="font-sans font-bold text-yellow-500 text-[10px] w-8">0{idx + 1}</span>
                                                                    <span className="text-sm text-white/90 font-sans leading-relaxed pt-0.5">{item}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </motion.div>
                                    )}
                                </div>

                                {/* THE LOOP: Lock in Decision */}
                                <div className="mt-12 bg-tactical-amber/5 border border-tactical-amber/20 p-8 rounded-xl">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <span className="text-2xl">⏳</span>
                                        <h4 className="font-bold text-white text-sm uppercase tracking-widest">Judgment Lock</h4>
                                    </div>
                                    <p className="text-gray-400 text-xs mb-8 italic">
                                        Don&apos;t just hope. Predict. Lock this decision into &quot;History&quot; to test your judgment accuracy later.
                                    </p>

                                    {!showWagerModal ? (
                                        <motion.button
                                            onClick={() => setShowWagerModal(true)}
                                            className="w-full py-4 border border-tactical-amber text-tactical-amber text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-tactical-amber hover:text-black transition-all"
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            Seal Time Capsule
                                        </motion.button>
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-6"
                                        >
                                            <div>
                                                <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 block">The Prediction</label>
                                                <textarea
                                                    value={wagerPrediction}
                                                    onChange={(e) => setWagerPrediction(e.target.value)}
                                                    placeholder="What is the expected outcome in reality?"
                                                    className="w-full bg-black/40 border border-white/10 rounded p-4 text-white text-sm focus:border-tactical-amber outline-none transition-colors h-24"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 block">Audit Timeline</label>
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
                                            <div className="flex space-x-4 pt-4">
                                                <button
                                                    onClick={handleSealWager}
                                                    disabled={sealingWager || !wagerPrediction}
                                                    className="flex-1 bg-tactical-amber text-black font-bold py-4 rounded text-[10px] uppercase tracking-widest disabled:opacity-50"
                                                >
                                                    {sealingWager ? 'Sealing...' : 'Confirm judgment Lock'}
                                                </button>
                                                <button
                                                    onClick={() => setShowWagerModal(false)}
                                                    className="px-6 border border-white/10 text-gray-500 text-[10px] uppercase tracking-widest"
                                                >
                                                    Cancel
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
            return `TRANSCRIPT SYNTHESIS: ${freeData.core_thesis}\n\nSTRATEGIC PILLARS:\n${pillarsText}\n\nNEXT STEPS:\n${(freeData.tactical_steps || []).map(s => `- ${s}`).join('\n')}`;
        }
        if (activeTab === 'strategist' && isPro && proData) {
            return `EXECUTIVE JUDGEMENT: ${proData.executive_judgement}\n\nRISK AUDIT: ${proData.risk_audit}`;
        }
        return "";
    };

    return (
        <div className="card-container fade-in">
            {/* New Session Button */}
            <div className="mb-8 flex justify-between items-center px-4">
                <motion.button
                    onClick={onReset}
                    className="flex items-center space-x-2 text-[#999] hover:text-[#A88E65] transition-all text-[11px] uppercase tracking-[0.2em]"
                    whileTap={{ scale: 0.96 }}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>New Session</span>
                </motion.button>

                <div className="text-[11px] uppercase tracking-[0.2em] text-[#A88E65] font-bold">
                    {isPro ? "Executive Status: Pro" : "Executive Status: Standard"}
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
                            className={`flex-1 py-8 px-4 text-center transition-all relative ${activeTab === tab.id
                                ? 'text-[#1A1A1A] bg-white'
                                : 'text-gray-400 hover:text-gray-600 bg-transparent'
                                }`}
                        >
                            <div className="text-[11px] font-bold uppercase tracking-[0.3em] mb-2 font-sans">
                                {tab.label}
                            </div>
                            <div className="text-[10px] text-gray-400 italic font-normal tracking-tight max-w-[220px] mx-auto leading-relaxed">
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

            {/* Share Actions */}
            <ShareActions
                sessionId={sessionId}
                textToShare={getTextToShare()}
                analysisResult={data}
                url={window.location.href}
                isPro={isPro}
                onPaywallTrigger={() => setShowPaywall(true)}
                onShowToast={onShowToast}
            />

            {/* Paywall Modal */}
            {showPaywall && (
                <PaywallModal
                    onClose={() => setShowPaywall(false)}
                    scenario="upsell"
                />
            )}
        </div>
    );
};

export default SynthesisResult;
