import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getUsageCount, incrementUsageCount, hasReachedLimit, getDailyLimitMessage, LIMIT } from '../utils/usageTracker';
import { transmuteAudio, saveDraft, generateTitle } from '../services/gemini';
import { extractHighEmphasisSignals } from '../utils/textAnalysis';
import PaywallModal from './PaywallModal';
import { trackEvent, GA_EVENTS } from '../utils/analytics';

export const RAW_DRAFT_PLACEHOLDER = "Audio recording saved as draft. Transmute to see insights.";

const PLATFORMS = [
    { id: 'twitter', name: 'X' },
    { id: 'linkedin', name: 'LinkedIn' },
];

const AudioRecorder = ({ onUploadSuccess, t, languageName, isPro, initialAudio }) => {
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
    const [isDragging, setIsDragging] = useState(false);
    const [fileDuration, setFileDuration] = useState(null);
    const [filePreviewUrl, setFilePreviewUrl] = useState(null);
    // Staged loading
    const [loadingStartTime, setLoadingStartTime] = useState(null);
    const [showDelayedMessage, setShowDelayedMessage] = useState(false);
    // Audio quality indicator (Layer 3 - Transparency)
    const [audioQualityIssue, setAudioQualityIssue] = useState(null);
    // Short Recording Intercept (Feature 1)
    const [showShortIntercept, setShowShortIntercept] = useState(false);
    const [shortInterceptAccepted, setShortInterceptAccepted] = useState(false);

    const inputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const qualityCheckRef = useRef(null);

    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    const ACCEPTED_FORMATS = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg'];

    // 3-stage loading messages (Improvement 4)
    const STAGED_STEPS = [
        "Analyzing semantic structure...",
        "Applying domain mental models...",
        "Synthesizing executive output..."
    ];

    // Staged loading: cycle through 3 stages
    useEffect(() => {
        if (loading) {
            setSynthesisStep(0);
            setLoadingStartTime(Date.now());
            setShowDelayedMessage(false);

            const interval = setInterval(() => {
                setSynthesisStep(prev => {
                    if (prev < STAGED_STEPS.length - 1) {
                        return prev + 1;
                    }
                    return prev;
                });
            }, 7000);

            return () => clearInterval(interval);
        } else {
            setShowDelayedMessage(false);
            setLoadingStartTime(null);
        }
    }, [loading]);

    // Show delayed message after 20 seconds
    useEffect(() => {
        if (!loading || !loadingStartTime) return;
        const timer = setTimeout(() => {
            setShowDelayedMessage(true);
        }, 20000);
        return () => clearTimeout(timer);
    }, [loading, loadingStartTime]);

    // Initialize from initialAudio prop
    useEffect(() => {
        if (initialAudio) {
            if (typeof initialAudio === 'string' && initialAudio.startsWith('data:audio/')) {
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
                        setError("Could not restore the audio from this draft.");
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

    // Dramatic pause for transmute button
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

    // Audio quality monitoring during recording (Layer 3 - Limitation Transparency)
    useEffect(() => {
        if (!isRecording) {
            setAudioQualityIssue(null);
            if (qualityCheckRef.current) {
                cancelAnimationFrame(qualityCheckRef.current);
                qualityCheckRef.current = null;
            }
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => { });
                audioContextRef.current = null;
            }
            return;
        }

        // Set up audio quality monitoring
        const monitorQuality = () => {
            if (!analyserRef.current || !isRecording) return;

            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);

            // Calculate average volume
            const avgVolume = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;

            // Calculate noise ratio (high frequency energy vs total)
            const halfLength = Math.floor(dataArray.length / 2);
            const lowFreqEnergy = dataArray.slice(0, halfLength).reduce((s, v) => s + v, 0);
            const highFreqEnergy = dataArray.slice(halfLength).reduce((s, v) => s + v, 0);
            const noiseRatio = highFreqEnergy / (lowFreqEnergy + 1);

            if (avgVolume < 5) {
                setAudioQualityIssue(t.messages?.audio_quality_noise || "High background noise detected — move to a quieter space for best results.");
            } else if (noiseRatio > 1.5 && avgVolume > 15) {
                setAudioQualityIssue(t.messages?.audio_quality_noise || "High background noise detected — move to a quieter space for best results.");
            } else {
                setAudioQualityIssue(null);
            }

            qualityCheckRef.current = requestAnimationFrame(monitorQuality);
        };

        // Small delay to let MediaRecorder settle
        const setupTimer = setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const source = ctx.createMediaStreamSource(mediaRecorderRef.current.stream);
                    const analyser = ctx.createAnalyser();
                    analyser.fftSize = 512;
                    source.connect(analyser);
                    audioContextRef.current = ctx;
                    analyserRef.current = analyser;
                    monitorQuality();
                } catch (e) {
                    console.warn("Audio quality monitoring not available:", e);
                }
            }
        }, 500);

        return () => {
            clearTimeout(setupTimer);
            if (qualityCheckRef.current) {
                cancelAnimationFrame(qualityCheckRef.current);
            }
        };
    }, [isRecording]);

    const togglePlatform = (platformId) => {
        setSelectedPlatforms(prev =>
            prev.includes(platformId)
                ? prev.filter(p => p !== platformId)
                : [...prev, platformId]
        );
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const validateFile = (file) => {
        if (file.size > MAX_FILE_SIZE) {
            setError(`File too large. Maximum size is 25MB. Your file is ${formatFileSize(file.size)}.`);
            return false;
        }
        const fileExtension = file.name.toLowerCase().split('.').pop();
        const validExtensions = ['mp3', 'wav', 'm4a', 'webm', 'ogg'];
        const isValidType = ACCEPTED_FORMATS.some(format => file.type.includes(format.split('/')[1])) ||
            validExtensions.includes(fileExtension);
        if (!isValidType) {
            setError(`Accepted formats: MP3, WAV, M4A, WebM, OGG`);
            return false;
        }
        return true;
    };

    const getAudioDuration = (file) => {
        return new Promise((resolve) => {
            const audio = new Audio();
            const url = URL.createObjectURL(file);
            audio.src = url;
            audio.onloadedmetadata = () => {
                resolve(audio.duration);
            };
            audio.onerror = () => {
                resolve(null);
            };
        });
    };

    const processFile = async (selectedFile) => {
        if (!validateFile(selectedFile)) return;
        setFile(selectedFile);
        setAudioBlob(null);
        setError(null);
        setShowShortIntercept(false);
        setShortInterceptAccepted(false);
        const url = URL.createObjectURL(selectedFile);
        setFilePreviewUrl(url);
        const duration = await getAudioDuration(selectedFile);
        if (duration) setFileDuration(duration);
    };

    useEffect(() => {
        return () => {
            if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
        };
    }, [filePreviewUrl]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
    };

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles && droppedFiles[0]) processFile(droppedFiles[0]);
    };
    const onButtonClick = () => inputRef.current.click();

    const startRecording = async () => {
        if (hasReachedLimit() && !isProActive) {
            setShowPaywall(true);
            return;
        }
        setError(null);
        setShowShortIntercept(false);
        setShortInterceptAccepted(false);
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
            trackEvent(GA_EVENTS.RECORDING_START);

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            setError(t.messages?.mic_error || "Microphone access is needed to capture your thoughts.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(timerRef.current);
            trackEvent(GA_EVENTS.RECORDING_COMPLETE, {
                duration: recordingTime
            });
        }
    };

    const discardRecording = () => {
        setAudioBlob(null);
        setRecordingTime(0);
        setError(null);
        setShowShortIntercept(false);
        setShortInterceptAccepted(false);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleUpload = async () => {
        if (hasReachedLimit() && !isProActive) {
            setShowPaywall(true);
            return;
        }

        const audioData = audioBlob || file;
        if (!audioData || selectedPlatforms.length === 0) return;

        const audioDuration = recordingTime || (fileDuration ? Math.round(fileDuration) : 0);
        
        // Feature 1: Short Recording Intercept (< 20 seconds)
        if (audioDuration > 0 && audioDuration < 20 && !shortInterceptAccepted) {
            setShowShortIntercept(true);
            return;
        }

        setLoading(true);
        trackEvent(GA_EVENTS.TRANSMUTATION_START, {
            source: audioBlob ? 'record' : 'upload',
            duration: audioDuration
        });

        try {
            const response = await transmuteAudio(audioData, languageName);

            let textValue = "";
            let analysisData = null;

            if (response.data && response.data.transcription) {
                const { transcription, executive_state, core_thesis, strategic_pillars, tactical_steps, industry } = response.data;

                textValue = transcription || "";
                console.log('✅ Transcription received. Industry:', industry);

                const durationSeconds = recordingTime || (fileDuration ? Math.round(fileDuration) : 60);
                const wordCount = textValue.trim().split(/\s+/).length;
                const wpm = Math.round(wordCount / (durationSeconds / 60));

                const emphasisSignals = extractHighEmphasisSignals(textValue);

                let intensity = "Medium";
                if (wpm < 100) intensity = "Low";
                if (wpm > 150) intensity = "High";

                const mins = Math.floor(durationSeconds / 60);
                const secs = durationSeconds % 60;
                const formattedDuration = `${mins}m ${secs}s`;

                analysisData = {
                    audit: {
                        duration: formattedDuration,
                        duration_seconds: durationSeconds,
                        wpm: wpm,
                        intensity: intensity,
                        executive_state: executive_state || "Reflective",
                        emphasis_signals: emphasisSignals
                    },
                    industry: industry || "General Business"
                };

                if (core_thesis || strategic_pillars || tactical_steps) {
                    analysisData.content = {
                        core_thesis: core_thesis,
                        strategic_pillars: strategic_pillars,
                        tactical_steps: tactical_steps
                    };
                }
            } else if (typeof response === 'string') {
                textValue = response;
            } else if (response.text) {
                textValue = response.text;
            }

            incrementUsageCount();

            if (textValue) {
                generateTitle(textValue).then(title => {
                    try {
                        const drafts = JSON.parse(localStorage.getItem('ghostnote_drafts') || '[]');
                        if (drafts.length > 0) {
                            drafts[0].title = title;
                            drafts[0].transcript = textValue;
                            localStorage.setItem('ghostnote_drafts', JSON.stringify(drafts));
                            console.log('📝 Draft title updated:', title);
                        }
                    } catch (err) {
                        console.error('Failed to update draft title:', err);
                    }
                });
            }

            if (onUploadSuccess) {
                onUploadSuccess(textValue, selectedPlatforms, analysisData);
                trackEvent(GA_EVENTS.TRANSMUTATION_COMPLETE, {
                    has_analysis: !!analysisData
                });
            }
        } catch (err) {
            console.error(err);
            setError(err.message || t.messages?.transmutation_fail || "The transmutation was interrupted. Let's try that again.");
        } finally {
            setLoading(false);
        }
    };

    const hasAudio = file || audioBlob;

    // Staged loading experience (Improvement 4)
    if (loading) {
        const progressPercent = ((synthesisStep + 1) / STAGED_STEPS.length) * 100;
        return (
            <div className="space-y-12 fade-in">
                <div className="flex flex-col items-center space-y-8">
                    <div className="w-32 h-32 rounded-full border-2 border-[#A88E65] flex items-center justify-center relative">
                        <div className="absolute inset-0 rounded-full border-2 border-[#A88E65] animate-ping opacity-20"></div>
                        <div className="w-6 h-6 border-2 border-[#A88E65] border-t-transparent rounded-full animate-spin"></div>
                    </div>

                    {/* Thin gold progress bar */}
                    <div className="w-full max-w-xs mx-auto">
                        <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#A88E65] rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    <div className="text-center space-y-3">
                        <p className="text-[#F9F7F5] text-lg font-light tracking-wide">
                            {STAGED_STEPS[synthesisStep]}
                        </p>
                        <div className="flex justify-center space-x-1">
                            {STAGED_STEPS.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`w-2 h-2 rounded-full transition-all ${idx <= synthesisStep ? 'bg-[#A88E65]' : 'bg-gray-600'
                                        }`}
                                />
                            ))}
                        </div>
                        {/* Delayed message after 20s */}
                        {showDelayedMessage && (
                            <p className="text-gray-500 text-xs italic mt-2 animate-pulse">
                                {t.messages?.stage_delayed || "This is taking a little longer than usual — still working."}
                            </p>
                        )}
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
                {mode === 'record' && (
                    <p className="text-[10px] text-gray-500 max-w-xs text-center mb-4 mt-2">
                        {t.messages.privacy_note}
                    </p>
                )}
            </div>

            <div className="flex flex-col items-center">
                {showShortIntercept ? (
                    <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in duration-500 max-w-md mx-auto py-12">
                        <p className="text-white text-lg font-light tracking-wide">
                            Short recordings may produce limited output — continue or re-record.
                        </p>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => {
                                    setShortInterceptAccepted(true);
                                    setTimeout(() => handleUpload(), 0);
                                }}
                                className="px-8 py-3 border border-[#A88E65] text-[#A88E65] rounded text-[10px] font-bold uppercase tracking-widest hover:bg-[#A88E65] hover:text-black transition-all"
                            >
                                Continue
                            </button>
                            <button
                                onClick={() => {
                                    discardRecording();
                                }}
                                className="px-8 py-3 border border-gray-600 text-gray-400 rounded text-[10px] font-bold uppercase tracking-widest hover:text-white hover:border-gray-400 transition-all"
                            >
                                Re-record
                            </button>
                        </div>
                    </div>
                ) : mode === 'record' ? (
                    <div className="flex flex-col items-center space-y-8">
                        {!isRecording && !audioBlob ? (
                            <div className="flex flex-col items-center space-y-4">
                                <button
                                    onClick={startRecording}
                                    className={`w-32 h-32 rounded-full border border-[#A88E65] flex items-center justify-center transition-all hover:bg-[#A88E65]/5`}
                                >
                                    <svg className="w-8 h-8 text-[#A88E65]" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V20h4v2H8v-2h4v-4.07z" />
                                    </svg>
                                </button>
                                {(!isProActive && hasReachedLimit()) ? null : (
                                    <div className="text-center space-y-2">
                                        <p className="text-[#cccccc] text-sm">{t.messages.tap_record}</p>
                                        <p className="text-gray-500 text-[10px] italic max-w-[200px] leading-relaxed">
                                            {t.messages.record_guidance}
                                        </p>
                                    </div>
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
                                {/* Audio Quality Indicator (Layer 3 - Limitation Transparency) */}
                                {audioQualityIssue && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-[#A88E65]/10 border border-[#A88E65]/20 max-w-sm"
                                    >
                                        <span className="w-2 h-2 bg-[#A88E65] rounded-full flex-shrink-0"></span>
                                        <p className="text-[#A88E65]/80 text-xs font-light">{audioQualityIssue}</p>
                                    </motion.div>
                                )}
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
                    <div className="flex flex-col items-center space-y-6 w-full max-w-sm">
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".mp3,.wav,.m4a,.webm,.ogg,audio/mpeg,audio/wav,audio/mp4,audio/webm,audio/ogg"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        {!file ? (
                            <div
                                onClick={onButtonClick}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`w-full border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center space-y-4
                                    ${isDragging
                                        ? 'border-[#A88E65] bg-[#A88E65]/10'
                                        : 'border-[#444] hover:border-[#A88E65]/50 hover:bg-[#A88E65]/5'
                                    }`}
                            >
                                <div className="w-16 h-16 rounded-full border border-[#A88E65] flex items-center justify-center">
                                    <svg className="w-7 h-7 text-[#A88E65]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-[#F9F7F5] text-sm font-medium">
                                        {isDragging ? t.modes.drop_file : t.modes.drag_drop_upload}
                                    </p>
                                    <p className="text-[#666] text-xs">
                                        {t.modes.file_formats_limit}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full bg-[#1a1a1a] rounded-2xl p-6 border border-[#333] space-y-4">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-full bg-[#A88E65]/20 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6 text-[#A88E65]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[#F9F7F5] text-sm font-medium truncate">{file.name}</p>
                                        <div className="flex items-center space-x-3 text-[#666] text-xs mt-1">
                                            <span>{formatFileSize(file.size)}</span>
                                            {fileDuration && (
                                                <>
                                                    <span>•</span>
                                                    <span>{formatTime(Math.round(fileDuration))}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setFile(null); setFileDuration(null); }}
                                        className="p-2 text-[#666] hover:text-[#F9F7F5] transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <audio
                                    controls
                                    src={filePreviewUrl}
                                    className="w-full h-10 opacity-70 hover:opacity-100 transition-opacity"
                                    style={{ filter: 'sepia(20%) saturate(70%) hue-rotate(10deg)' }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {error && (
                <p className="text-center text-[#A88E65] text-sm italic">{error}</p>
            )}

            {hasAudio && !showShortIntercept && (
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
                                    const audioBase64 = await new Promise((resolve) => {
                                        const reader = new FileReader();
                                        reader.onloadend = () => resolve(reader.result);
                                        reader.readAsDataURL(audioData);
                                    });

                                    const newDraft = {
                                        id: Date.now(),
                                        title: file ? file.name : t.labels.untitled_note,
                                        transcript: RAW_DRAFT_PLACEHOLDER,
                                        tag: t.labels.brain_dump,
                                        created_at: new Date().toISOString(),
                                        audioData: audioBase64
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
                                    setError('Draft could not be saved at this time.');
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
