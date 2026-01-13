import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getUsageCount, incrementUsageCount, LIMIT } from '../utils/usageTracker';
import { transmuteAudio, saveDraft } from '../services/gemini';
import PaywallModal from './PaywallModal';

const PLATFORMS = [
    { id: 'twitter', name: 'X' },
    { id: 'linkedin', name: 'LinkedIn' },
];

const AudioRecorder = ({ onUploadSuccess, t, languageName, isPro, initialAudio }) => {
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

    const SYNTHESIS_STEPS = [
        t.messages.uploading,
        t.messages.transcribing,
        t.messages.extracting,
        t.messages.formatting
    ];

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
    }, [loading]); // SYNTHESIS_STEPS dependency omitted to avoid reset loop, it effectively updates if t changes but loading is typically short.

    // Initialize from initialAudio prop (Bug 1 Fix)
    useEffect(() => {
        if (initialAudio) {
            if (typeof initialAudio === 'string' && initialAudio.startsWith('data:audio/')) {
                // It's base64
                fetch(initialAudio)
                    .then(res => res.blob())
                    .then(blob => {
                        const restoredFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
                        setFile(restoredFile);
                        setAudioBlob(null);
                        setError(null);
                    })
                    .catch(err => {
                        console.error("Failed to restore audio from draft:", err);
                        setError("Failed to restore audio from draft.");
                    });
            } else if (initialAudio instanceof File || initialAudio instanceof Blob) {
                if (initialAudio instanceof File) {
                    setFile(initialAudio);
                    setAudioBlob(null);
                } else {
                    setAudioBlob(initialAudio);
                    setFile(null);
                }
            }
        }
    }, [initialAudio]);

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
            setError(t.messages.mic_error);
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
            // Pass languageName to backend for localized processing
            const response = await transmuteAudio(audioData, languageName);

            // Handle both legacy (string) and new (JSON) formats
            let textValue = "";
            let analysisData = null;

            if (response.data && response.data.core_thesis) {
                // New JSON format
                const { transcription, executive_state, core_thesis, strategic_pillars } = response.data;

                textValue = transcription || "";

                // Calculate Emphasis Audit
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
            setError(err.message || t.messages.transmutation_fail || 'Transcription failed.');
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
                        {t.buttons.record}
                    </button>
                    <span className="text-[#cccccc]">|</span>
                    <button
                        onClick={() => { setMode('upload'); setError(null); }}
                        className={`mode-link ${mode === 'upload' ? 'active' : ''}`}
                    >
                        {t.buttons.upload}
                    </button>
                </div>

                <p className="text-[#999] text-xs italic max-w-xs text-center">
                    {mode === 'record' ? t.modes.record_desc : t.modes.upload_desc}
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
                                        {t.messages.free_limit}
                                    </p>
                                )}
                                {!(!isProActive && getUsageCount() >= LIMIT) && (
                                    <p className="text-[#cccccc] text-sm">{t.messages.tap_record}</p>
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
                                    <p className="text-[#999] text-xs">{t.messages.tap_finish}</p>
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
                                    <button onClick={discardRecording} className="text-[#999] hover:text-[#F9F7F5]">{t.buttons.discard}</button>
                                    <button onClick={startRecording} className="text-[#A88E65] hover:opacity-70">{t.buttons.rerecord}</button>
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
                                <p className="text-[#cccccc] text-sm">{t.buttons.select_file}</p>
                            </>
                        ) : (
                            <div className="text-center space-y-4">
                                <div className="w-32 h-32 rounded-full border border-[#A88E65] flex items-center justify-center">
                                    <svg className="w-8 h-8 text-[#A88E65]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <p className="text-[#F9F7F5] text-sm font-light">{file.name}</p>
                                <button onClick={() => setFile(null)} className="text-[#999] text-sm hover:text-[#F9F7F5]">{t.buttons.remove}</button>
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
                        <span>{t.buttons.transmute}</span>
                    </motion.button>

                    <motion.button
                        onClick={() => {
                            const audioData = audioBlob || file;
                            if (!audioData) return;

                            setSavingDraft(true);

                            const save = async () => {
                                try {
                                    // Convert audio to base64 for storage
                                    const audioBase64 = await new Promise((resolve) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => resolve(reader.result);
                                        reader.readAsDataURL(audioData);
                                    });

                                    const newDraft = {
                                        id: Date.now(),
                                        title: file ? file.name : `Voice Note ${new Date().toLocaleTimeString()}`,
                                        transcript: "Audio recording saved as draft. Transmute to see insights.",
                                        tag: "💭 Brain Dump",
                                        created_at: new Date().toISOString(),
                                        audioData: audioBase64 // Persist audio!
                                    };

                                    const existing = JSON.parse(localStorage.getItem('ghostnote_drafts') || '[]');
                                    const updated = [newDraft, ...existing];
                                    localStorage.setItem('ghostnote_drafts', JSON.stringify(updated));

                                    setAudioBlob(null);
                                    setFile(null);
                                    setRecordingTime(0);
                                    alert(t.messages.draft_saved);
                                } catch (err) {
                                    console.error(err);
                                    setError('Failed to save draft locally.');
                                } finally {
                                    setSavingDraft(false);
                                }
                            };
                            save();
                        }}
                        disabled={loading || savingDraft}
                        className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-tactical-amber transition-colors flex items-center space-x-2"
                        whileTap={{ scale: 0.96 }}
                    >
                        <span>💭</span>
                        <span>{savingDraft ? 'Saving...' : t.buttons.save_draft}</span>
                    </motion.button>

                    <p className="text-[#666] text-xs italic">
                        {t.messages.ready}
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
