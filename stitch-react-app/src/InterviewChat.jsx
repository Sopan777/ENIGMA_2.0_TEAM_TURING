import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVoiceInput } from './useVoiceInput';
import { useStuckDetection } from './useStuckDetection';
import useBrowserSecurity from './useBrowserSecurity';
import './interviewChat.css';

/**
 * InterviewChat — Interactive Multi-Agent Interview Chat Panel.
 * 
 * Features:
 * - Toggle open/close via FAB button or Ctrl+Shift+C
 * - Multi-Agent Backend via /api/start-session, /api/chat, /api/submit-code, /api/end-session
 * - Voice input via Web Speech API
 * - Ctrl+H for hints
 * - Audio Visualizer Widget (OpenAI TTS)
 * - Session tracking and Final Evaluation Report
 */
export default function InterviewChat({ userCode, problemData, isActive, resumeData }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Session State
    const [sessionId, setSessionId] = useState(null);
    const [joinCode, setJoinCode] = useState(null);
    const [finalReport, setFinalReport] = useState(null);
    const [isEnding, setIsEnding] = useState(false); // New state for ending interview

    // Security Hook Integrations
    const [activeToast, setActiveToast] = useState(null);
    const [sessionTerminated, setSessionTerminated] = useState(false);

    // Draggable audio widget state
    const [widgetPos, setWidgetPos] = useState({ x: 20, y: 80 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [showWidget, setShowWidget] = useState(true);

    // User webcam state
    const [isCameraOn, setIsCameraOn] = useState(true);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const hasStartedSessionRef = useRef(false);
    const widgetRef = useRef(null);
    const audioPlayerRef = useRef(null);

    const {
        isListening, transcript, interimTranscript, isSupported: voiceSupported,
        startListening, stopListening, resetTranscript,
    } = useVoiceInput();

    // ─── Play Base64 Audio (OpenAI TTS) ────────────────────────────────
    const playBase64Audio = (base64String) => {
        try {
            if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
            }
            const binaryString = window.atob(base64String);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes.buffer], { type: 'audio/mp3' });
            const url = URL.createObjectURL(blob);

            const audio = new Audio(url);
            audioPlayerRef.current = audio;

            audio.onplay = () => {
                setIsSpeaking(true);
                setShowWidget(true);
            };
            audio.onended = () => {
                setIsSpeaking(false);
                // Auto-start mic when AI finishes speaking!
                if (isActive && !isEnding && !finalReport && !sessionTerminated) {
                    startListening();
                }
            };
            audio.onerror = () => setIsSpeaking(false);

            audio.play();
        } catch (err) {
            console.error("Failed to play base64 audio", err);
        }
    };

    // ─── Browser Native TTS (System Voice) ──────────────
    const speakBrowserTTS = useCallback((text) => {
        if (!('speechSynthesis' in window)) {
            if (isActive && !isEnding && !finalReport && !sessionTerminated) {
                startListening();
            }
            return;
        }

        window.speechSynthesis.cancel(); // Stop any current speech
        const utterance = new SpeechSynthesisUtterance(text);

        // Try to pick a decent English voice
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
            || voices.find(v => v.lang.startsWith('en'));
        if (preferred) utterance.voice = preferred;

        utterance.onstart = () => {
            setIsSpeaking(true);
            setShowWidget(true);
        };
        utterance.onend = () => {
            setIsSpeaking(false);
            if (isActive && !isEnding && !finalReport && !sessionTerminated) {
                startListening();
            }
        };
        utterance.onerror = () => {
            setIsSpeaking(false);
            if (isActive && !isEnding && !finalReport && !sessionTerminated) {
                startListening();
            }
        };

        window.speechSynthesis.speak(utterance);
    }, [isActive, isEnding, finalReport, sessionTerminated, startListening]);

    // ─── Start Session API ─────────────────────────────────────────────
    useEffect(() => {
        if (isActive && problemData && !hasStartedSessionRef.current) {
            hasStartedSessionRef.current = true;
            setIsLoading(true);

            // Create a mock candidate profile based on current info
            const startReq = {
                candidate_name: "Candidate",
                role: "Software Engineer",
                experience_years: 2,
                languages: [problemData.language || "python"],
                problem_title: problemData.title,
                difficulty_level: problemData.difficulty || "medium",
                resume_text: resumeData ? resumeData.extracted_text : ""
            };

            fetch('http://localhost:8000/api/start-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(startReq),
            })
                .then(res => res.json())
                .then(data => {
                    setSessionId(data.session_id);
                    setJoinCode(data.join_code || null);
                    setMessages([{ role: 'assistant', content: data.message, type: 'chat' }]);
                    // Force System TTS
                    speakBrowserTTS(data.message);
                })
                .catch(err => {
                    console.error("Start session failed", err);
                    const fallback = `Hi! I'm Codex, your AI interviewer. I couldn't connect to my brain, but take your time to read the problem "${problemData.title}".`;
                    setMessages([{ role: 'assistant', content: fallback, type: 'chat' }]);
                })
                .finally(() => setIsLoading(false));
        }

        if (!isActive) {
            hasStartedSessionRef.current = false;
            setMessages([]);
            setSessionId(null);
            setJoinCode(null);
            setFinalReport(null);
            setUnreadCount(0);
            setSessionTerminated(false); // Reset security state
            setActiveToast(null); // Reset security state
            if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
            }
        }
    }, [isActive, problemData]);


    // ─── Scroll to Bottom on New Messages ───────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading, finalReport]);

    // ─── Periodic Code Sync to Backend (for Supervisor view) ────────────
    useEffect(() => {
        if (!sessionId || !isActive) return;

        const interval = setInterval(() => {
            fetch('http://localhost:8000/api/sync-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, code: userCode }),
            }).catch(() => { }); // silent failure is fine
        }, 3000); // Sync every 3 seconds

        return () => clearInterval(interval);
    }, [sessionId, isActive, userCode]);

    // ─── Handle Voice Transcript → Input ────────────────────────────────
    useEffect(() => {
        if (transcript) {
            setInputValue(transcript);
            resetTranscript();
            handleSendMessage(transcript);
        }
    }, [transcript]);

    // ─── Keyboard Shortcuts ─────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isActive || finalReport || sessionTerminated) return; // Block shortcuts if terminated

            // Ctrl+Shift+C → Toggle chat
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }

            // Ctrl+H → Request hint
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                handleRequestHint();
            }

            // Ctrl+Enter → Submit Code
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                handleSubmitCode();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, userCode, problemData, finalReport, sessionId, sessionTerminated]);

    // ─── Track Unread Count ─────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) setUnreadCount(0);
    }, [isOpen]);

    // ─── Stuck Detection ───────────────────────────────────────────────
    const handleStuckDetected = useCallback((suggestion) => {
        if (!sessionId || finalReport || sessionTerminated) return; // Block if terminated

        const stuckMsg = {
            role: 'assistant',
            content: `💡 Hint available if you need it: ${suggestion} `,
            type: 'stuck',
        };
        setMessages(prev => [...prev, stuckMsg]);
        if (!isOpen) setUnreadCount(prev => prev + 1);
    }, [isOpen, sessionId, finalReport, sessionTerminated]);

    useStuckDetection({
        code: userCode,
        problemData,
        isActive,
        onStuckDetected: handleStuckDetected,
        idleThresholdSeconds: 90, // Increased wait time
    });

    // Browser Security Integrations
    const handleCheatDetected = async (warning, isTermination, warningCount) => {
        // Display UI Toast
        setActiveToast({
            message: warning.message,
            strike: warningCount, // Use warningCount from hook
            isTerminal: isTermination
        });

        // Hide toast after 5s if not terminal
        if (!isTermination) {
            setTimeout(() => setActiveToast(null), 5000);
        }

        // Inform the backend immediately
        if (sessionId) {
            try {
                await fetch('http://localhost:8000/api/report-cheat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        warning_type: warning.type,
                        message: warning.message,
                        is_terminal: isTermination
                    })
                });
            } catch (err) {
                console.error("Failed to report cheat to backend", err);
            }
        }

        // Terminate UI if 3 strikes
        if (isTermination) {
            setSessionTerminated(true);
            // Optionally auto-trigger handleEndInterview here
            // handleEndInterview(); // This would end the session and generate a report
        }
    };

    const { blockLargePaste, warningCount, maxWarnings } = useBrowserSecurity(
        isActive && !!sessionId && !finalReport && !sessionTerminated,
        handleCheatDetected
    );

    // ─── Submit Code to Judge Agent ────────────────────────────────────
    const handleSubmitCode = async () => {
        if (!sessionId || !userCode.trim() || finalReport || sessionTerminated) return; // Block if terminated

        setIsLoading(true);
        const submitMsg = { role: 'user', content: "I've submitted my code for testing.", type: 'chat' };
        setMessages(prev => [...prev, submitMsg]);

        try {
            await fetch('http://localhost:8000/api/submit-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    code: userCode,
                    language: problemData.language || "python"
                }),
            });

            // Re-trigger a chat message to let the Brain comment on the submission
            setTimeout(() => {
                handleSendMessage("I just submitted my code. Can you review it or ask follow ups?");
            }, 1000);

        } catch (err) {
            console.error("Code submit failed", err);
            setIsLoading(false);
        }
    };

    // ─── End Interview & Generate Report ───────────────────────────────
    const handleEndInterview = async () => {
        if (!sessionId || isEnding) return; // Prevent multiple calls
        setIsEnding(true); // Set ending state
        setIsLoading(true);
        if (!isOpen) setIsOpen(true);

        const endMsg = { role: 'user', content: "I'd like to end the interview now.", type: 'chat' };
        setMessages(prev => [...prev, endMsg]);

        try {
            const response = await fetch('http://localhost:8000/api/end-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId }),
            });

            if (!response.ok) throw new Error('End session failed');

            const data = await response.json();
            setFinalReport(data.report);

            speakBrowserTTS("The interview has concluded. I have generated your final evaluation report.");
            setShowWidget(false);
        } catch (err) {
            const errMsg = { role: 'assistant', content: "Failed to generate the final report.", type: 'chat' };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsLoading(false);
            setIsEnding(false); // Reset ending state
        }
    };


    // ─── Send Chat Message ─────────────────────────────────────────────
    const handleSendMessage = async (overrideMessage) => {
        const msg = overrideMessage || inputValue.trim();
        if (!msg || isLoading || !problemData || !sessionId || finalReport || sessionTerminated) return; // Block if terminated

        const userMsg = { role: 'user', content: msg, type: 'chat' };
        // Don't duplicate the internal "submitted Code" trigger
        if (!overrideMessage?.includes("just submitted my code")) {
            setMessages(prev => [...prev, userMsg]);
            setInputValue('');
        }
        setIsLoading(true);

        try {
            const history = messages
                .filter(m => m.type === 'chat')
                .map(m => ({ role: m.role, content: m.content }));

            const response = await fetch('http://localhost:8000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    message: msg,
                    code: userCode,
                    history,
                }),
            });

            if (!response.ok) throw new Error('Chat request failed');

            const data = await response.json();
            const aiMsg = { role: 'assistant', content: data.reply, type: 'chat' };
            setMessages(prev => [...prev, aiMsg]);

            if (!isOpen) setUnreadCount(prev => prev + 1);

            // Force System TTS
            speakBrowserTTS(data.reply);
        } catch (err) {
            const errMsg = { role: 'assistant', content: "Sorry, I couldn't process that. Please try again.", type: 'chat' };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Request Hint (Ctrl+H) ────────────────────────────────────────
    const handleRequestHint = async () => {
        if (isLoading || !problemData || finalReport || !sessionId || sessionTerminated) return; // Block if terminated
        setIsLoading(true);

        if (!isOpen) setIsOpen(true);

        try {
            const response = await fetch('http://localhost:8000/api/hint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: userCode,
                    problem_title: problemData.title,
                    problem_description: problemData.description,
                    language: problemData.language,
                }),
            });

            if (!response.ok) throw new Error('Hint request failed');

            const data = await response.json();
            const hintMsg = { role: 'assistant', content: `🔑 ${data.hint} `, type: 'hint' };
            setMessages(prev => [...prev, hintMsg]);

            // Force System TTS
            speakBrowserTTS(data.hint);
        } catch (err) {
            const errMsg = { role: 'assistant', content: "Couldn't generate a hint right now.", type: 'chat' };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Handle Input Submit ───────────────────────────────────────────
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // ─── Draggable Audio Widget Logic ─────────────────────────────────
    const handleMouseDown = (e) => {
        if (e.target.closest('.video-widget-controls')) return;
        setIsDragging(true);
        const rect = widgetRef.current.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            setWidgetPos({
                x: Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffset.x)),
                y: Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y)),
            });
        };

        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragOffset]);

    if (!isActive) return null;

    return (
        <>
            {/* ── Audio Visualizer Widget ── */}
            {showWidget && !finalReport && (
                <div
                    ref={widgetRef}
                    className={`audio-widget ${isSpeaking ? 'speaking' : ''} ${isDragging ? 'dragging' : ''}`}
                    style={{ left: widgetPos.x, top: widgetPos.y }}
                    onMouseDown={handleMouseDown}
                >
                    <div className="audio-visualizer-container">
                        <div className={`visualizer - ring ${isSpeaking ? 'active' : ''} `}></div>
                        <div className={`visualizer - ring delay - 1 ${isSpeaking ? 'active' : ''} `}></div>
                        <div className={`visualizer - ring delay - 2 ${isSpeaking ? 'active' : ''} `}></div>
                        <div className="audio-avatar">
                            <span className="material-symbols-outlined icon">graphic_eq</span>
                        </div>

                        {/* User Webcam PiP — streams from Python backend proctor */}
                        <div className={`user-video-pip ${!isCameraOn ? 'off' : ''}`}>
                            {isCameraOn && sessionId ? (
                                <img
                                    src={`http://localhost:8000/api/video-feed/${sessionId}`}
                                    alt="Your camera"
                                    className="user-video-feed"
                                />
                            ) : (
                                <div className="camera-off-placeholder">
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                        videocam_off
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="video-widget-controls audio-controls">
                        <div className="video-meet-label">
                            <div className={`video - meet - live - dot ${isSpeaking || isLoading ? 'active' : ''} `}></div>
                            Codex Voice
                        </div>
                        <div className="widget-controls-right">
                            <button
                                className={`camera-toggle-btn ${isCameraOn ? 'active' : ''}`}
                                onClick={() => setIsCameraOn(prev => !prev)}
                                title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                    {isCameraOn ? 'videocam' : 'videocam_off'}
                                </span>
                            </button>
                            <button
                                className="video-widget-minimize"
                                onClick={() => setShowWidget(false)}
                                title="Minimize"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>remove</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Floating Action Button ── */}
            <button
                className={`chat-fab ${isOpen ? 'active' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title="Toggle AI Chat (Ctrl+Shift+C)"
                id="chat-toggle-btn"
            >
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                    {isOpen ? 'close' : 'smart_toy'}
                </span>
                {!isOpen && unreadCount > 0 && (
                    <span className="badge">{unreadCount}</span>
                )}
            </button>

            {/* Show visualizer widget button (when minimized) */}
            {!showWidget && !finalReport && (
                <button
                    className="chat-fab video-restore-fab"
                    onClick={() => setShowWidget(true)}
                    title="Show Voice Visualizer"
                    style={{ bottom: '90px' }}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>graphic_eq</span>
                </button>
            )}

            {/* ── Chat Panel ── */}
            <div className={`chat-panel ${isOpen ? 'open' : ''}`}>
                <div className="chat-panel-inner">
                    {/* Anti-Cheat Toast Overlay */}
                    {activeToast && (
                        <div className={`anti-cheat-toast ${activeToast.isTerminal ? 'terminal' : 'warning'}`}>
                            <div className="toast-icon">⚠️</div>
                            <div className="toast-content">
                                <strong>Security Violation (Strike {activeToast.strike}/{maxWarnings})</strong>
                                <p>{activeToast.message}</p>
                            </div>
                        </div>
                    )}

                    {/* Header */}
                    <div className="chat-header">
                        <div className="chat-header-left">
                            <div className="chat-avatar-small">C</div>
                            <div className="chat-header-info">
                                <h3>Codex — AI Interviewer</h3>
                                <p>
                                    <span className="live-dot" style={{ background: finalReport ? '#94a3b8' : '#22c55e' }}></span>
                                    {finalReport ? 'Session Ended' : (sessionTerminated ? 'Session Terminated' : 'Live Session')}
                                </p>
                            </div>
                        </div>
                        <div className="chat-header-right">
                            {joinCode && !finalReport && !sessionTerminated && (
                                <div className="join-code-badge" title="Share this code with your recruiter" style={{ marginRight: '16px', background: '#e2e8f0', color: '#475569', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '1px' }}>
                                    Live Co-op: {joinCode}
                                </div>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="chat-btn"
                                title="Close (Ctrl+Shift+C)"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                    chevron_right
                                </span>
                            </button>
                        </div>
                    </div>
                    <div className="chat-messages">
                        {messages.map((msg, i) => (
                            <div key={i} className={`chat-msg ${msg.role === 'user' ? 'user' : ''} ${msg.type === 'hint' ? 'hint' : ''} ${msg.type === 'stuck' ? 'stuck' : ''}`}>
                                <div className="chat-msg-content">
                                    {msg.type === 'hint' && (
                                        <div className="msg-label">💡 Hint</div>
                                    )}
                                    {msg.type === 'stuck' && (
                                        <div className="msg-label">🤔 Codex noticed you might need help</div>
                                    )}
                                    {msg.content}
                                </div>
                            </div>
                        ))}

                        {/* Final Report UI */}
                        {finalReport && (
                            <div className="final-report-card">
                                <h3 className="report-title">Final Evaluation Report</h3>
                                <div className="report-performance">
                                    Decision: <span className="outcome badge-strict">{finalReport.performance_level}</span>
                                </div>
                                <div className="report-proctor">
                                    Proctor Integrity:
                                    {finalReport.proctor_warnings && finalReport.proctor_warnings.length > 0 ? (
                                        <span className="outcome badge-strict" style={{ background: '#fef2f2', color: '#dc2626' }}>
                                            ⚠️ Flagged ({finalReport.proctor_warnings.length} issues)
                                        </span>
                                    ) : (
                                        <span className="outcome badge-strict" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                                            ✅ Safe
                                        </span>
                                    )}
                                </div>
                                <p className="report-summary">{finalReport.summary}</p>

                                <div className="report-scores">
                                    <div className="score-row"><span>Technical</span> <strong>{finalReport.scores.technical_correctness}/10</strong></div>
                                    <div className="score-row"><span>Problem Solving</span> <strong>{finalReport.scores.problem_solving}/10</strong></div>
                                    <div className="score-row"><span>Reasoning</span> <strong>{finalReport.scores.reasoning}/10</strong></div>
                                    <div className="score-row"><span>Code Quality</span> <strong>{finalReport.scores.code_quality}/10</strong></div>
                                    <div className="score-row"><span>Communication</span> <strong>{finalReport.scores.communication}/10</strong></div>
                                </div>

                                <div className="report-scores" style={{ marginTop: '10px' }}>
                                    <div className="score-row" style={{ background: finalReport.scores.integrity_score < 70 ? '#fef2f2' : '#f0fdf4' }}>
                                        <span style={{ fontWeight: '600' }}>Anti-Cheat Integrity Score</span>
                                        <strong style={{ color: finalReport.scores.integrity_score < 70 ? '#dc2626' : '#16a34a' }}>
                                            {finalReport.scores.integrity_score}%
                                        </strong>
                                    </div>
                                </div>

                                <div className="report-section">
                                    <strong>Actionable Improvements:</strong>
                                    <ul>
                                        {finalReport.actionable_recommendations?.map((item, idx) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}

                        {isLoading && !finalReport && (
                            <div className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    {!finalReport && (
                        <div className="chat-input-area">
                            <div className="chat-input-hint" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                <span><kbd>Ctrl+Enter</kbd> submit code  ·  <kbd>Ctrl+H</kbd> hint</span>
                                <button className="end-interview-btn" onClick={handleEndInterview} disabled={isEnding}>
                                    {isEnding ? 'Ending...' : 'End Interview'}
                                </button>
                            </div>
                            {sessionTerminated ? (
                                <div className="terminated-overlay">
                                    <div className="terminated-card">
                                        <h2>🚨 Session Terminated</h2>
                                        <p>This interview was closed automatically due to repeated browser security violations.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="chat-input-row">
                                    {voiceSupported && (
                                        <button
                                            className={`chat-btn ${isListening ? 'recording' : ''}`}
                                            onClick={isListening ? stopListening : startListening}
                                            title={isListening ? 'Stop recording' : 'Start voice input'}
                                            disabled={sessionTerminated}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                                {isListening ? 'stop' : 'mic'}
                                            </span>
                                        </button>
                                    )}

                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={isListening ? (interimTranscript || 'Listening...') : inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        onPaste={blockLargePaste} // Apply paste blocking here
                                        placeholder="Ask Codex or discuss your approach..."
                                        disabled={isListening || sessionTerminated}
                                        id="chat-input"
                                    />

                                    <button
                                        className="chat-btn send"
                                        onClick={() => handleSendMessage()}
                                        disabled={!inputValue.trim() || isLoading || sessionTerminated}
                                        title="Send message"
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                            send
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >
        </>
    );
}
