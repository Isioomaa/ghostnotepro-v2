import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getUsageCount, incrementUsageCount, LIMIT } from '../utils/usageTracker';
import { transmuteAudio, saveDraft } from '../services/gemini';
import PaywallModal from './PaywallModal';

const PLATFORMS = [
    { id: 'twitter', name: 'X' },
    { id: 'linkedin', name: 'LinkedIn' },
];

const MODE_DESCRIPTIONS = {
    'record': 'Capture your strategic thoughts via voice recording.',
    'upload': 'Upload an existing audio file for analysis.'
};

const SYNTHESIS_STEPS = [
    'Uploading audio...',
    'Transcribing voice...',
    'Extracting core insights...',
    'Formatting final strategy...'
];

const AudioRecorder = ({ onUploadSuccess, t, languageName, isPro }) => {
    // Robust Boolean Check (Handles String/Boolean from Props)
    const isProActive = String(isPro) === 'true' || isPro === true;

    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedPlatforms, setSelectedPlatforms] = useState(['twitter', 'linkedin']);
    const [mode, setMode] = useState('record');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [synthesisStep, setSynthesisStep] = useState(0);
    const [showTransmuteButton, setShowTransmuteButton] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);

    const inputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);

    // Cycle through synthesis steps
    useEffect(() => {
        if (loading) {
            setSynthesisStep(0);
            const interval = setInterval(() => {
                setSynthesisStep(prev => {
                    if (prev < SYNTHESIS_STEPS.length - 1) {
                        return prev + 1;
                    }
                    return prev;
                });
            }, 2000);

            return () => clearInterval(interval);
        }
    }, [loading]);

    // Dramatic pause for transmute button (700ms delay)
    useEffect(() => {
        if (audioBlob || file) {
            setShowTransmuteButton(false);
            const timer = setTimeout(() => {
                setShowTransmuteButton(true);
            }, 700);
            return () => clearTimeout(timer);
        } else {
            setShowTransmuteButton(false);
        }
    }, [audioBlob, file]);

    const togglePlatform = (platformId) => {
        setSelectedPlatforms(prev =>
            prev.includes(platformId)
                ? prev.filter(p => p !== platformId)
                : [...prev, platformId]
        );
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setAudioBlob(null);
            setError(null);
        }
    };

    const onButtonClick = () => {
        inputRef.current.click();
    };

    const startRecording = async () => {
        const usageCount = getUsageCount();
        const hasReachedLimit = usageCount >= LIMIT && !isProActive;

        if (hasReachedLimit) {
            // Soft lock handles this now, button is disabled
            return;
        }

        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 16000
            });
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setFile(null);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            setError('Microphone access required.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
        }
    };

    const discardRecording = () => {
        setAudioBlob(null);
        setRecordingTime(0);
        setError(null);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleUpload = async () => {
        const usageCount = getUsageCount();
        const hasReachedLimit = usageCount >= LIMIT && !isProActive;

        if (hasReachedLimit) {
            // Soft lock handles this now
            return;
        }

        const audioData = audioBlob || file;
        if (!audioData || selectedPlatforms.length === 0) return;

        setLoading(true);

        try {

            // response is now { status: "success", data: { transcription, core_thesis, strategic_pillars, executive_state } }
            const response = await transmuteAudio(audioData, languageName);

            // Handle both legacy (string) and new (JSON) formats
            let textValue = "";
            let analysisData = null;

            if (response.data && response.data.core_thesis) {
                // New JSON format
                const { transcription, executive_state, core_thesis, strategic_pillars } = response.data;

                // For Scribe view compatibility, we combine thesis + pillars for the "text" prop if needed,
                // BUT SynthesisResult now handles structured data if passed.
                // Re-using the passed text prop heavily might break things if it expects a string.
                // SynthesisResult expects `text` which is displayed as "Transcription".
                // We should pass the actual transcription as `text`.
                // And pass the rest as `analysis` or a new prop.
                // However, App.jsx uses `text` for `transcription` state.
                textValue = transcription || "";

                // Calculate Emphasis Audit
                // WPM = Word Count / (Duration in Minutes)
                // Duration is recordingTime (seconds). If upload, we might not have it easily, assume avg or 0.
                const durationSeconds = recordingTime || 60; // Fallback if 0 (upload mode)
                const wordCount = textValue.trim().split(/\s+/).length;
                const wpm = Math.round(wordCount / (durationSeconds / 60));

                let intensity = "Medium";
                if (wpm < 100) intensity = "Low";
                if (wpm > 150) intensity = "High";

                const mins = Math.floor(durationSeconds / 60);
                const secs = durationSeconds % 60;
                const formattedDuration = `${mins}m ${secs}s`;

                analysisData = {
                    audit: {
                        duration: formattedDuration,
                        wpm: wpm,
                        intensity: intensity,
                        executive_state: executive_state || "Reflective"
                    },
                    // Pass the Scribe structured data too so we don't need to re-generate it?
                    // SynthesisResult currently calls generation separately.
                    // If we have it here, we could potentially pass it to pre-fill?
                    // For now, let's just pass the audit.
                    content: {
                        core_thesis: response.data.core_thesis,
                        strategic_pillars: response.data.strategic_pillars
                    }
                };
            } else if (typeof response === 'string') {
                // Legacy fallback
                textValue = response;
            } else if (response.text) {
                // Legacy dict fallback
                textValue = response.text;
            }

            // Increment usage count AFTER successful generation
            incrementUsageCount();
            onUploadSuccess(textValue, selectedPlatforms, analysisData);
        } catch (err) {
            console.error(err);
            setError(err.message || 'Transcription failed.');
        } finally {
            setLoading(false);
        }
    };

    const hasAudio = file || audioBlob;

    // Show synthesis state when loading
    if (loading) {
        return (
            <div className="space-y-12 fade-in">
                <div className="flex flex-col items-center space-y-8">
                    <div className="w-32 h-32 rounded-full border-2 border-[#A88E65] flex items-center justify-center relative">
                        <div className="absolute inset-0 rounded-full border-2 border-[#A88E65] animate-ping opacity-20"></div>
                        <div className="w-6 h-6 border-2 border-[#A88E65] border-t-transparent rounded-full animate-spin"></div>
                    </div>

                    <div className="text-center space-y-2">
                        <p className="text-[#F9F7F5] text-lg font-light tracking-wide">
                            {SYNTHESIS_STEPS[synthesisStep]}
                        </p>
                        <div className="flex justify-center space-x-1">
                            {SYNTHESIS_STEPS.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`w-2 h-2 rounded-full transition-all ${idx <= synthesisStep ? 'bg-[#A88E65]' : 'bg-gray-600'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-12">
            <div className="flex justify-center space-x-8">
                {PLATFORMS.map(platform => (
                    <button
                        key={platform.id}
                        onClick={() => togglePlatform(platform.id)}
                        className={`platform-tag ${selectedPlatforms.includes(platform.id) ? 'active' : ''}`}
                    >
                        {platform.name}
                    </button>
                ))}
            </div>

            <div className="flex flex-col items-center space-y-3">
                <div className="flex items-center space-x-4 text-sm">
                    <button
                        onClick={() => { setMode('record'); setError(null); }}
                        className={`mode-link ${mode === 'record' ? 'active' : ''}`}
                    >
                        {t.record}
                    </button>
                    <span className="text-[#cccccc]">|</span>
                    <button
                        onClick={() => { setMode('upload'); setError(null); }}
                        className={`mode-link ${mode === 'upload' ? 'active' : ''}`}
                    >
                        {t.upload}
                    </button>
                </div>

                <p className="text-[#999] text-xs italic max-w-xs text-center">
                    {MODE_DESCRIPTIONS[mode]}
                </p>
            </div>

            <div className="flex flex-col items-center">
                {mode === 'record' ? (
                    <div className="flex flex-col items-center space-y-8">
                        {!isRecording && !audioBlob ? (
                            <div className="flex flex-col items-center space-y-4">
                                <button
                                    onClick={startRecording}
                                    disabled={!isProActive && getUsageCount() >= LIMIT}
                                    className={`w-32 h-32 rounded-full border border-[#A88E65] flex items-center justify-center transition-all ${(!isProActive && getUsageCount() >= LIMIT) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#A88E65]/5'}`}
                                >
                                    <svg className="w-8 h-8 text-[#A88E65]" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V20h4v2H8v-2h4v-4.07z" />
                                    </svg>
                                </button>
                                {(!isProActive && getUsageCount() >= LIMIT) && (
                                    <p
                                        onClick={() => setShowPaywall(true)}
                                        className="text-amber-500 text-xs mt-2 cursor-pointer hover:underline"
                                    >
                                        Free transmutations complete. Upgrade to Pro
                                    </p>
                                )}
                                {!(!isProActive && getUsageCount() >= LIMIT) && (
                                    <p className="text-[#cccccc] text-sm">Tap to Record</p>
                                )}
                            </div>
                        ) : isRecording ? (
                            <>
                                <button
                                    onClick={stopRecording}
                                    className="w-32 h-32 rounded-full bg-[#A88E65] flex items-center justify-center animate-pulse transition-all"
                                >
                                    <div className="w-6 h-6 bg-white rounded-sm"></div>
                                </button>
                                <div className="text-center space-y-2">
                                    <p className="text-[#F9F7F5] text-2xl font-light tracking-wider">{formatTime(recordingTime)}</p>
                                    <p className="text-[#999] text-xs">Tap to Finish</p>
                                </div>
                            </>
                        ) : audioBlob ? (
                            <div className="text-center space-y-4">
                                <div className="w-32 h-32 rounded-full border border-[#A88E65] flex items-center justify-center">
                                    <svg className="w-8 h-8 text-[#A88E65]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-[#F9F7F5] text-lg font-light">
                                    {formatTime(recordingTime)}
                                </p>
                                <div className="flex space-x-6 justify-center text-sm">
                                    <button onClick={discardRecording} className="text-[#999] hover:text-[#F9F7F5]">Discard</button>
                                    <button onClick={startRecording} className="text-[#A88E65] hover:opacity-70">Re-record</button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="flex flex-col items-center space-y-6">
                        <input
                            ref={inputRef}
                            type="file"
                            accept="audio/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {!file ? (
                            <>
                                <button
                                    onClick={onButtonClick}
                                    className="w-32 h-32 rounded-full border border-[#A88E65] flex items-center justify-center transition-all hover:bg-[#A88E65]/5"
                                >
                                    <svg className="w-8 h-8 text-[#A88E65]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </button>
                                <p className="text-[#cccccc] text-sm">{t.select_file}</p>
                            </>
                        ) : (
                            <div className="text-center space-y-4">
                                <div className="w-32 h-32 rounded-full border border-[#A88E65] flex items-center justify-center">
                                    <svg className="w-8 h-8 text-[#A88E65]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-[#F9F7F5] text-sm font-light">{file.name}</p>
                                <button onClick={() => setFile(null)} className="text-[#999] text-sm hover:text-[#F9F7F5]">Remove</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {error && <p className="text-center text-red-600 text-sm">{error}</p>}

            {hasAudio && (
                <div className={`flex flex-col items-center pt-8 space-y-4 transition-all duration-700 ${showTransmuteButton ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}>
                    <motion.button
                        onClick={handleUpload}
                        disabled={loading || selectedPlatforms.length === 0}
                        className="btn-transmute flex items-center space-x-2"
                        whileTap={{ scale: 0.96 }}
                    >
                        <span className="text-lg">✨</span>
                        <span>Transmute my thoughts</span>
                    </motion.button>

                    <motion.button
                        onClick={() => {
                            const audioData = audioBlob || file;
                            if (!audioData) return;

                            const newDraft = {
                                id: Date.now(),
                                title: file ? file.name : `Voice Note ${new Date().toLocaleTimeString()}`,
                                transcript: "Audio recording saved as draft. Transmute to see insights.",
                                tag: "💭 Brain Dump",
                                created_at: new Date().toISOString()
                            };

                            try {
                                const existing = JSON.parse(localStorage.getItem('ghostnote_drafts') || '[]');
                                const updated = [newDraft, ...existing];
                                localStorage.setItem('ghostnote_drafts', JSON.stringify(updated));

                                setAudioBlob(null);
                                setFile(null);
                                setRecordingTime(0);
                                alert('Saved to Drafts! 💭');
                            } catch (err) {
                                console.error(err);
                                setError('Failed to save draft locally.');
                            }
                        }}
                        disabled={loading || savingDraft}
                        className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-tactical-amber transition-colors flex items-center space-x-2"
                        whileTap={{ scale: 0.96 }}
                    >
                        <span>💭</span>
                        <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
                    </motion.button>

                    <p className="text-[#666] text-xs italic">
                        Ready to turn noise into signal.
                    </p>
                </div>
            )}

            {/* Paywall Modal */}
            {showPaywall && (
                <PaywallModal
                    onClose={() => setShowPaywall(false)}
                    scenario="limit_reached"
                />
            )}
        </div>
    );
};

export default AudioRecorder;
