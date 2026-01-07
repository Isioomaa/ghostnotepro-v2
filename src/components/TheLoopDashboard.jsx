import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchDecisionHistory, auditDecision } from '../services/gemini';
import { TRANSLATIONS } from '../constants/languages';

const TheLoopDashboard = ({ onClose, languageName, t }) => {
    const [decisions, setDecisions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [auditing, setAuditing] = useState(null); // ID of decision being audited
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [auditResult, setAuditResult] = useState(null);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);

    const localT = t || TRANSLATIONS.EN;

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const data = await fetchDecisionHistory();
            setDecisions(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
        } catch (err) {
            alert(localT.messages?.mic_error || "Microphone access required.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const handleAuditSubmit = async () => {
        if (!audioBlob || !auditing) return;
        setLoading(true);
        try {
            const result = await auditDecision(auditing, audioBlob, languageName);
            setAuditResult(result);
            await loadHistory();
        } catch (err) {
            alert("Audit failed. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'DUE': return 'text-red-500';
            case 'AUDITED': return 'text-green-500';
            default: return 'text-tactical-amber';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="flex justify-between items-start mb-16">
                    <div>
                        <h2 className="font-playfair font-bold text-4xl text-white mb-3">{localT.history_view?.title || "History"}</h2>
                        <p className="text-gray-400 text-sm tracking-widest uppercase">{localT.history_view?.subtitle || "Judgment Variance Engine"}</p>
                    </div>
                    <motion.button onClick={onClose} className="text-gray-500 hover:text-white" whileTap={{ scale: 0.9 }}>
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </motion.button>
                </div>

                {loading && !auditing && (
                    <div className="flex justify-center py-20">
                        <div className="w-12 h-12 border-2 border-tactical-amber border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                {!loading && decisions.length === 0 && (
                    <div className="text-center py-32 border border-white/5 bg-white/2 rounded-xl">
                        <p className="text-gray-500 font-serif italic mb-4">{localT.history_view?.quote || "\"The unexamined decision is not worth making.\""}</p>
                        <p className="text-white text-sm font-sans tracking-widest font-bold">{localT.history_view?.no_wagers || "NO WAGERS FOUND"}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* List Phase */}
                    <div className="lg:col-span-2 space-y-6">
                        {decisions.map((d, idx) => (
                            <motion.div
                                key={d.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className={`dossier-card p-6 border-l-4 ${d.status === 'DUE' ? 'border-l-red-500' : d.status === 'AUDITED' ? 'border-l-green-500' : 'border-l-tactical-amber'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${getStatusColor(d.status)}`}>
                                        {d.status} • Review {formatDate(d.review_date)}
                                    </span>
                                    {d.status === 'AUDITED' && (
                                        <div className="text-2xl font-bold text-white">
                                            {d.accuracy_score}%
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-white font-bold text-lg mb-4">{d.prediction}</h3>

                                {d.status === 'DUE' && (
                                    <motion.button
                                        onClick={() => setAuditing(d.id)}
                                        className="bg-red-500 text-black text-[10px] font-bold px-4 py-2 rounded-sm uppercase tracking-widest hover:bg-red-400"
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        {localT.history_view?.record_update || "Record Update"}
                                    </motion.button>
                                )}

                                {d.status === 'AUDITED' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/5">
                                        <div>
                                            <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest mb-2">{localT.history_view?.blind_spot || "Blind Spot"}</p>
                                            <p className="text-gray-400 text-sm italic">{d.blind_spot}</p>
                                        </div>
                                        <div>
                                            <p className="text-tactical-amber text-[10px] font-bold uppercase tracking-widest mb-2">{localT.history_view?.insight || "Insight"}</p>
                                            <p className="text-gray-400 text-sm italic">{d.growth_insight}</p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>

                    {/* Stats/History Side */}
                    <div className="space-y-6">
                        <div className="bg-white/5 p-8 rounded-xl border border-white/10">
                            <h4 className="text-white text-xs font-bold tracking-[0.3em] uppercase mb-8 pb-4 border-b border-white/10">{localT.history_view?.accuracy_score || "Judgment Stats"}</h4>
                            <div className="space-y-8">
                                <div>
                                    <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">{localT.history_view?.avg_accuracy || "Avg Accuracy"}</p>
                                    <p className="text-3xl font-serif text-white">
                                        {Math.round(decisions.filter(d => d.status === 'AUDITED').reduce((a, b) => a + b.accuracy_score, 0) / (decisions.filter(d => d.status === 'AUDITED').length || 1))}%
                                    </p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-[10px] uppercase tracking-widest mb-1">{localT.history_view?.total_wagers || "Total Wagers"}</p>
                                    <p className="text-3xl font-serif text-white">{decisions.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border border-white/5 rounded-xl">
                            <p className="text-gray-500 text-xs italic leading-relaxed">
                                {localT.history_view?.quote || "\"History is not a burden on the memory but an illumination of the soul.\""}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Audit Modal */}
                <AnimatePresence>
                    {auditing && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
                        >
                            <div className="bg-[#09090b] border-2 border-red-500/30 p-12 rounded-2xl max-w-lg w-full text-center relative">
                                <button
                                    onClick={() => { setAuditing(null); setAudioBlob(null); setAuditResult(null); }}
                                    className="absolute top-6 right-6 text-gray-500 hover:text-white"
                                >
                                    ✕
                                </button>

                                {!auditResult ? (
                                    <>
                                        <h3 className="font-playfair font-bold text-3xl text-white mb-4">{localT.history_view?.reckoning_title || "The Reckoning"}</h3>
                                        <p className="text-gray-400 text-sm mb-12">{localT.history_view?.reckoning_desc || "Record what actually happened..."}</p>

                                        {!audioBlob ? (
                                            <div className="flex flex-col items-center space-y-6">
                                                <button
                                                    onClick={isRecording ? stopRecording : startRecording}
                                                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 animate-pulse' : 'border border-red-500 hover:bg-red-500/10'}`}
                                                >
                                                    {isRecording ? <div className="w-6 h-6 bg-white rounded-sm"></div> : <span className="text-2xl">🎙️</span>}
                                                </button>
                                                <p className="text-xs tracking-widest uppercase text-gray-500">
                                                    {isRecording ? `Recording... ${recordingTime}s` : (localT.history_view?.record_update || 'Tap to start update')}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-8">
                                                <div className="w-20 h-20 mx-auto bg-green-500/20 text-green-500 rounded-full flex items-center justify-center text-3xl">✓</div>
                                                <p className="text-white text-sm">{localT.history_view?.update_captured || "Update Captured."}</p>
                                                <button
                                                    onClick={handleAuditSubmit}
                                                    disabled={loading}
                                                    className="w-full bg-red-500 text-black font-bold py-4 rounded-sm tracking-[0.2em] uppercase hover:bg-red-400 disabled:opacity-50"
                                                >
                                                    {loading ? (localT.history_view?.running || 'Running Variance Engine...') : (localT.history_view?.seal_judgment || 'Seal Judgment')}
                                                </button>
                                                <button onClick={() => setAudioBlob(null)} className="text-gray-500 text-[10px] uppercase tracking-widest">{localT.history_view?.discard || "Discard and Re-record"}</button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="space-y-8 animate-in zoom-in duration-300">
                                        <div className="text-6xl font-serif text-white mb-4">{auditResult.accuracy_score}%</div>
                                        <p className="text-tactical-amber text-xs font-bold uppercase tracking-widest">{localT.history_view?.accuracy_score || "Judgment Accuracy Score"}</p>
                                        <div className="bg-white/5 p-6 rounded text-left space-y-4">
                                            <div>
                                                <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest mb-1">{localT.history_view?.blind_spot || "The Blind Spot"}</p>
                                                <p className="text-gray-300 text-sm leading-relaxed">{auditResult.blind_spot}</p>
                                            </div>
                                            <div>
                                                <p className="text-tactical-amber text-[10px] font-bold uppercase tracking-widest mb-1">{localT.history_view?.insight || "Growth Insight"}</p>
                                                <p className="text-gray-300 text-sm leading-relaxed">{auditResult.growth_insight}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setAuditing(null); setAuditResult(null); setAudioBlob(null); }}
                                            className="w-full border border-white/20 text-white font-bold py-4 rounded-sm tracking-[0.2em] uppercase hover:bg-white/10"
                                        >
                                            {localT.history_view?.return || "Return to History"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default TheLoopDashboard;
