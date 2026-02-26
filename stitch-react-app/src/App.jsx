import React, { useState, useRef, useEffect } from 'react';
import Dashboard from './Dashboard';
function App() {
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Navigation State
  const [currentTab, setCurrentTab] = useState('dashboard'); // dashboard | practice | history

  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef(null);

  // Interview State
  const [interviewState, setInterviewState] = useState('setup'); // setup | loading_problem | active
  const [problemData, setProblemData] = useState(null);
  const [userCode, setUserCode] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const codeTextareaRef = useRef(null);

  // Anti-Cheat State
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && interviewState === 'active') {
        setTabSwitchCount((prevCount) => {
          const newCount = prevCount + 1;
          if (newCount >= 4) {
            // Terminate immediately on the 4th try
            setInterviewState('setup');
            setProblemData(null);
            setUserCode("");
            setEvaluationResult(null);
            setShowWarningModal(false);
            setError("Interview forcefully terminated due to repeated background switching (Anti-Cheat violation).");
            return 0; // Reset count
          } else {
            // Show warning modal
            setShowWarningModal(true);
            return newCount;
          }
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [interviewState]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
      handleUpload(selectedFile);
    } else {
      setError("Please upload a valid PDF file.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
      handleUpload(droppedFile);
    } else {
      setError("Please drop a valid PDF file.");
    }
  };

  const handleUpload = async (fileToUpload) => {
    setParsing(true);
    setError(null);
    setParsedData(null);

    const formData = new FormData();
    formData.append("file", fileToUpload);

    try {
      const response = await fetch("http://localhost:8000/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Upload failed");
      }

      const data = await response.json();
      setParsedData(data);
    } catch (err) {
      setError(err.message || "An error occurred while parsing the resume.");
    } finally {
      setParsing(false);
    }
  };

  const getDynamicOptions = () => {
    if (!parsedData || !parsedData.extracted_text) return [];
    const text = parsedData.extracted_text.toLowerCase();
    const options = [];
    if (text.includes("react") || text.includes("frontend") || text.includes("ui/ux")) options.push("Frontend Architecture Interview");
    if (text.includes("python") || text.includes("django") || text.includes("fastapi")) options.push("Python Backend Interview");
    if (text.includes("node") || text.includes("express")) options.push("Node.js Backend Interview");
    if (text.includes("aws") || text.includes("cloud") || text.includes("docker")) options.push("DevOps & Cloud Infrastructure Interview");
    if (text.includes("sql") || text.includes("database") || text.includes("mongodb")) options.push("Database Design Interview");
    if (text.includes("data science") || text.includes("machine learning") || text.includes("ml")) options.push("Machine Learning Interview");
    return [...new Set(options)].slice(0, 3);
  };

  const dynamicOptions = getDynamicOptions();

  const handleStartInterview = async (topic) => {
    setInterviewState('loading_problem');
    setShowOptions(false);
    setError(null);
    setTabSwitchCount(0);
    setShowWarningModal(false);

    try {
      const response = await fetch("http://localhost:8000/api/generate-problem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic,
          context: parsedData ? parsedData.summary : ""
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate problem");
      }

      const data = await response.json();
      setProblemData(data);
      setUserCode(data.starting_code || "");
      setEvaluationResult(null);
      setInterviewState('active');
    } catch (err) {
      setError(err.message || "An error occurred while starting the interview.");
      setInterviewState('setup');
    }
  };

  const handleSubmitSolution = async () => {
    setEvaluating(true);
    setEvaluationResult(null);

    try {
      const response = await fetch("http://localhost:8000/api/evaluate-solution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem_title: problemData.title,
          problem_description: problemData.description,
          user_code: userCode,
          language: problemData.language
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to evaluate code");
      }

      const data = await response.json();
      setEvaluationResult(data);
    } catch (err) {
      setEvaluationResult({ passed: false, feedback: err.message || "An evaluation error occurred." });
    } finally {
      setEvaluating(false);
    }
  };

  const codeHandleKeyDown = (e) => {
    // Basic Tab handling
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      setUserCode(userCode.substring(0, start) + "    " + userCode.substring(end));
      setTimeout(() => {
        if (codeTextareaRef.current) codeTextareaRef.current.selectionStart = codeTextareaRef.current.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleExitInterview = () => {
    setInterviewState('setup');
    setProblemData(null);
    setUserCode("");
    setEvaluationResult(null);
    setTabSwitchCount(0);
    setShowWarningModal(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setIsAuthLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed");
      }

      localStorage.setItem("token", data.access_token);
      localStorage.setItem("userEmail", email);
      setIsLoggedIn(true);
      setAuthError("");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setIsAuthLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Registration failed");
      }

      setAuthSuccess(data.message);
      setIsRegistering(false);
      // Do not clear email/password so they can log in easily
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setIsLoggedIn(false);
    // Reset view
    setCurrentTab('dashboard');
    setInterviewState('setup');
  };

  if (!isLoggedIn) {
    return (
      <div className="bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-200 min-h-screen flex items-center justify-center transition-colors duration-300 relative overflow-hidden">
        <div className="glow-accent top-[-100px] left-[-100px]"></div>
        <div className="glow-accent bottom-[-100px] right-[-100px] bg-green-500/20 dark:bg-green-500/10"></div>

        <div className="w-full max-w-md p-8 glass-card rounded-3xl shadow-sm bg-white dark:bg-transparent animate-in fade-in slide-in-from-bottom-4 duration-500 z-10 relative">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 font-bold text-lg mb-4 text-slate-900 dark:text-white">
              AI
            </div>
            <h1 className="text-2xl font-display font-semibold text-slate-900 dark:text-white tracking-tight">
              {isRegistering ? "Create your account" : "Welcome Back"}
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              {isRegistering ? "Join InterviewAI today" : "Sign in to your InterviewAI account"}
            </p>
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1" htmlFor="username">Username</label>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors"
                  placeholder="Enter your username"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors"
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">error</span>
                {authError}
              </p>
            )}

            {authSuccess && !isRegistering && (
              <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                {authSuccess} Please sign in below.
              </p>
            )}

            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full py-3 mt-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
            >
              {isAuthLoading ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
              ) : (
                <>
                  {isRegistering ? "Create Account" : "Sign In"}
                  <span className="material-symbols-outlined text-[18px]">arrow_right_alt</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-200 dark:border-slate-800 pt-6">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError("");
                setAuthSuccess("");
              }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium transition-colors mb-4 block w-full"
            >
              {isRegistering ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </button>
            <p className="text-xs text-slate-500">
              By logging in, you agree to our <a href="#" className="underline hover:text-slate-700 dark:hover:text-slate-300">Terms of Service</a> & <a href="#" className="underline hover:text-slate-700 dark:hover:text-slate-300">Privacy Policy</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-200 min-h-screen flex flex-col transition-colors duration-300 overflow-x-hidden relative">
      <nav className="sticky top-0 z-50 border-b border-slate-200 dark:border-white/5 bg-background-light dark:bg-background-dark">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center border border-slate-800 dark:border-slate-200 font-bold text-sm">
                AI
              </div>
              <span className="font-display font-medium text-lg tracking-tight">InterviewAI</span>
            </div>
            {interviewState === 'setup' && (
              <div className="hidden md:flex items-center gap-6">
                <button
                  onClick={() => setCurrentTab('dashboard')}
                  className={`text-sm font-medium transition-colors ${currentTab === 'dashboard' ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-500'}`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentTab('practice')}
                  className={`text-sm font-medium transition-colors ${currentTab === 'practice' ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-500'}`}
                >
                  Practice
                </button>
                <button
                  onClick={() => setCurrentTab('history')}
                  className={`text-sm font-medium transition-colors ${currentTab === 'history' ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-500'}`}
                >
                  History
                </button>
              </div>
            )}
            {interviewState === 'active' && (
              <div className="hidden md:flex items-center gap-3 px-3 py-1 bg-red-500/10 text-red-600 rounded-md text-xs font-semibold animate-pulse">
                <div className="w-2 h-2 rounded-full bg-red-600"></div> Live Technical Interview Running
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {interviewState === 'active' && (
              <button onClick={handleExitInterview} className="px-4 py-1.5 border border-slate-300 dark:border-slate-700 rounded text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                End Session
              </button>
            )}
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-white/10 group relative">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{localStorage.getItem("userEmail") || "User"}</p>
                <p className="text-xs text-slate-500">Candidate</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden cursor-pointer">
                <img alt="User" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBApSeT7iYvc3OqCsUYfd6MfBy7G92Rm-gX3zvG_C4qbuzMbX9wHRQPQ9xVoUFSHAcjiaQ-F6uUocFrzIBrLW0bxhSyiVWwiBzU8lJ2qdu7jRNa--mKc5Asdq8HT7a27O5eINVYveqINAYVwp94yGLZNY1__gpxL1ZGYYCZvzpkOgnpkgG4XAp9cdqaOlwaungF7Bij2m9JcAFpDjKN2bd30He0IEfzlurmAaf4wRPHHUQCskkDJIv96wrUOyu7i1gMrExsidYN1WYd" />
              </div>
              <button
                onClick={handleLogout}
                className="absolute top-10 right-0 mt-2 px-4 py-2 bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg text-xs font-medium text-red-500 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {interviewState === 'loading_problem' && (
        <div className="flex-grow flex flex-col items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-slate-400 animate-spin mb-4">refresh</span>
          <h2 className="text-xl font-display font-medium text-slate-800 dark:text-slate-200 mb-2">Generating Interview Question</h2>
          <p className="text-sm text-slate-500 max-w-sm text-center">Gemini AI is analyzing your requested topic and context to create a custom technical challenge.</p>
        </div>
      )}

      {interviewState === 'active' && problemData && (
        <main className="flex-grow flex flex-col md:flex-row h-full overflow-hidden border-t border-slate-200 dark:border-slate-800">
          {/* Left Pane - Problem Description */}
          <div className="w-full md:w-1/3 border-r border-slate-200 dark:border-slate-800 bg-background-light dark:bg-background-dark p-6 overflow-y-auto min-h-[400px]">
            <div className="inline-block px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-4 tracking-wider uppercase">
              {problemData.language === 'python' ? 'Python Problem' : 'Programming Task'}
            </div>
            <h2 className="text-2xl font-semibold font-display mb-4 text-slate-900 dark:text-white leading-tight">
              {problemData.title}
            </h2>
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300"
              dangerouslySetInnerHTML={{ __html: problemData.description.replace(/\n(.*)/g, '<p>$1</p>') }}
            />
          </div>

          {/* Right Pane - Code Editor */}
          <div className="w-full md:w-2/3 bg-slate-50 dark:bg-[#0A0A0A] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-2 bg-slate-100 dark:bg-[#111]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400 text-sm">code</span>
                <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">solution.{problemData.language === 'python' ? 'py' : 'js'}</span>
              </div>
              <button
                onClick={handleSubmitSolution}
                disabled={evaluating}
                className="px-4 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
              >
                {evaluating ? (
                  <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                )}
                {evaluating ? 'Running AI Evaluation...' : 'Run & Submit Code'}
              </button>
            </div>
            <div className="flex-grow relative border-b border-slate-200 dark:border-slate-800">
              <textarea
                ref={codeTextareaRef}
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                onKeyDown={codeHandleKeyDown}
                spellCheck="false"
                className="absolute inset-0 w-full h-full p-6 bg-transparent resize-none outline-none font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 focus:ring-0 border-0"
                style={{ tabSize: 4 }}
              />
            </div>

            {/* Evaluation Output Pane */}
            <div className="h-48 bg-background-light dark:bg-background-dark p-4 overflow-y-auto">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">AI Evaluation Output</h3>

              {!evaluationResult && !evaluating && (
                <p className="text-sm text-slate-400 italic">Run your code to see results.</p>
              )}

              {evaluating && (
                <div className="flex items-center gap-3 text-slate-500">
                  <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                  <p className="text-sm">Gemini is reviewing your solution for correctness and edge cases...</p>
                </div>
              )}

              {evaluationResult && (
                <div className={`p-4 rounded border ${evaluationResult.passed ? 'border-green-500/30 bg-green-500/5 text-green-800 dark:text-green-300' : 'border-red-500/30 bg-red-500/5 text-red-800 dark:text-red-300'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {evaluationResult.passed ? (
                      <>
                        <span className="material-symbols-outlined text-green-600 dark:text-green-400">check_circle</span>
                        <span className="font-semibold text-sm">Tests Passed</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-red-600 dark:text-red-400">cancel</span>
                        <span className="font-semibold text-sm">Issues Found</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{evaluationResult.feedback}</p>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* Anti-Cheat Warning Modal */}
      {showWarningModal && interviewState === 'active' && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 dark:bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-background-dark border border-red-500/30 shadow-xl rounded-xl p-8 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-600 dark:text-red-500">
                <span className="material-symbols-outlined text-4xl">gavel</span>
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white mb-2">Warning: Tab Switch Detected</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
                Navigating away from the interview tab or minimizing the window is not permitted under our strict Anti-Cheat guidelines.
              </p>
              <div className="w-full bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-400 p-3 rounded-lg mb-6 text-sm font-semibold flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                Warning {tabSwitchCount} of 3. Session will auto-terminate after 4 violations.
              </div>
              <button
                onClick={() => setShowWarningModal(false)}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors shadow-sm"
              >
                I Understand, Return to Interview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area based on Tabs */}
      {interviewState === 'setup' && currentTab === 'dashboard' && (
        <Dashboard setCurrentTab={setCurrentTab} />
      )}

      {/* Practice View (Original Setup Content) */}
      {interviewState === 'setup' && currentTab === 'practice' && (
        <main className="max-w-4xl w-full mx-auto px-6 py-12 relative z-10 flex-grow animate-in fade-in duration-300">
          <header className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium uppercase tracking-wider mb-6">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              Ready for your session
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold font-display mb-3 text-slate-900 dark:text-white">
              Pre-Interview Setup
            </h1>
            <p className="text-slate-500 max-w-xl mx-auto font-light text-sm md:text-base">
              Complete your system checks and upload your resume to begin your AI-powered technical simulation.
            </p>
          </header>

          {/* User Performance Dashboard (Dummy Data) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="glass-card p-6 rounded-2xl shadow-sm bg-white dark:bg-transparent flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-3 text-blue-600 dark:text-blue-500">
                <span className="material-symbols-outlined text-[20px]">leaderboard</span>
              </div>
              <p className="text-3xl font-display font-semibold text-slate-900 dark:text-white mb-1">12</p>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Interviews Completed</p>
            </div>

            <div className="glass-card p-6 rounded-2xl shadow-sm bg-white dark:bg-transparent flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-3 text-green-600 dark:text-green-500">
                <span className="material-symbols-outlined text-[20px]">radar</span>
              </div>
              <p className="text-3xl font-display font-semibold text-slate-900 dark:text-white mb-1">85%</p>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Average Score</p>
            </div>

            <div className="glass-card p-6 rounded-2xl shadow-sm bg-white dark:bg-transparent flex flex-col items-center justify-center text-center">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-3 text-orange-600 dark:text-orange-500">
                <span className="material-symbols-outlined text-[20px]">local_fire_department</span>
              </div>
              <p className="text-3xl font-display font-semibold text-slate-900 dark:text-white mb-1">3 Days</p>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Current Streak</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7">
              <div className="glass-card p-8 rounded-3xl h-full flex flex-col shadow-sm bg-white dark:bg-transparent">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold font-display">Resume Upload</h2>
                  <span className="material-symbols-outlined text-primary">description</span>
                </div>
                <div
                  className={`flex-grow border border-dashed ${file ? 'border-green-500/50 bg-green-50/10' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'} rounded-xl flex flex-col items-center justify-center p-10 transition-colors group cursor-pointer bg-slate-50/50 dark:bg-white/5 relative`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf"
                    className="hidden"
                  />

                  {parsing ? (
                    <div className="flex flex-col items-center animate-pulse">
                      <span className="material-symbols-outlined text-3xl text-slate-400 animate-spin mb-4">refresh</span>
                      <p className="font-medium text-sm text-center">Parsing Resume...</p>
                      <p className="text-xs text-slate-500 mt-2">Extracting your technical experience for our AI</p>
                    </div>
                  ) : file && parsedData ? (
                    <div className="flex flex-col items-center text-green-600 dark:text-green-400">
                      <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
                        <span className="material-symbols-outlined text-3xl">task_alt</span>
                      </div>
                      <p className="font-medium text-sm text-center text-slate-800 dark:text-slate-200">{file.name}</p>
                      <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-2">Successfully Extracted</p>
                      <button className="mt-5 px-5 py-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 rounded-md text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#222] transition-colors shadow-sm text-slate-700 dark:text-slate-300">
                        Replace File
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                        <span className="material-symbols-outlined text-3xl">upload_file</span>
                      </div>
                      <p className="font-medium text-sm text-center">Drag &amp; drop your resume</p>
                      <p className="text-xs text-slate-500 mt-2">PDF up to 5MB</p>
                      {error && <p className="text-xs text-red-500 mt-2 font-medium">{error}</p>}
                      <button className="mt-5 px-5 py-2 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 rounded-md text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#222] transition-colors shadow-sm">
                        Browse Files
                      </button>
                    </>
                  )}
                </div>

                {parsedData && (
                  <div className="mt-4 p-4 rounded-xl border border-green-500/20 bg-green-500/5 max-h-[160px] overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[16px] text-green-600 dark:text-green-400">psychology</span>
                      <p className="text-xs font-semibold text-green-800 dark:text-green-300">AI Context Extracted</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                      {parsedData.summary}
                    </p>
                  </div>
                )}
                <div className="mt-6 flex items-start gap-3 p-3 text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-sm mt-[2px]">info</span>
                  <p className="text-xs leading-relaxed">Your resume helps our system tailor technical questions to your experience level.</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-5 flex flex-col gap-6">
              <div className="glass-card p-8 rounded-3xl flex-grow shadow-sm bg-white dark:bg-transparent">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold font-display">System Check</h2>
                  <span className="material-symbols-outlined text-primary">settings_suggest</span>
                </div>
                <div className="space-y-6">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-transparent border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[18px]">mic</span>
                        <span className="text-sm font-medium">Microphone</span>
                      </div>
                      <div className="wave-animation text-slate-400">
                        <div className="wave-bar"></div>
                        <div className="wave-bar"></div>
                        <div className="wave-bar"></div>
                        <div className="wave-bar"></div>
                        <div className="wave-bar"></div>
                      </div>
                    </div>
                    <button className="w-full py-2 rounded-md bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#2A2A2A] transition-colors">
                      Test Microphone
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-transparent border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[18px]">volume_up</span>
                        <span className="text-sm font-medium">Speakers</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">Ready</span>
                    </div>
                    <button className="w-full py-2 rounded-md bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-slate-800 text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#2A2A2A] transition-colors">
                      Test Speakers
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-transparent border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[18px]">videocam</span>
                        <span className="text-sm font-medium">Camera</span>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                    </div>
                    <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden relative group">
                      <img alt="Camera Preview" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8kYc2jG_ynF9ZtGiJqtdeP4cdPTPrVzpNppm8b4dncwQ93lY40r_zk3NfCJldevF1AgYhC4z0ZgXQ--mlQbrp350N1P6_ZG0wvzP1u-dIkqSYSmc1Yt-Qs_dF3XfgA61poE343sMDXAMyij5ZV7pEQtwpVH4ilmA9Jg0MtkXvB4DKxNannkhmWdqsUTKYRpDbXe6g6Jhhbc8A6ccRAKdf-zYqOECnswo7orH5OBBrzw4IPkfIadVtwVZ8QwVDWwj4kSOCZrW3e-vt" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] text-white/50 font-medium">Live Preview</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center">
            <div className="flex items-center gap-6 mb-8 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                Anti-cheat enabled
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                ~45 mins duration
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">code</span>
                3 Coding problems
              </div>
            </div>

            {!showOptions ? (
              <button
                onClick={() => setShowOptions(true)}
                className="px-10 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <div className="flex items-center gap-3">
                  Start Interview
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </div>
              </button>
            ) : (
              <div className="w-full max-w-md p-6 bg-white dark:bg-background-dark border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-lg">Select Interview Type</h3>
                  <button
                    onClick={() => setShowOptions(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Default Options */}
                  <button onClick={() => handleStartInterview('Solve DSA Problems')} className="w-full group p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-left hover:border-slate-500 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-[#1A1A1A] transition-all">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">code_blocks</span>
                      <div>
                        <h4 className="font-medium text-sm">Solve DSA Problems</h4>
                        <p className="text-xs text-slate-500 mt-1">Standard Data Structures & Algorithms</p>
                      </div>
                    </div>
                  </button>

                  <button onClick={() => handleStartInterview('General Interview Questions')} className="w-full group p-4 border border-slate-200 dark:border-slate-800 rounded-lg text-left hover:border-slate-500 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-[#1A1A1A] transition-all">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200">work</span>
                      <div>
                        <h4 className="font-medium text-sm">General Behavioral Interview</h4>
                        <p className="text-xs text-slate-500 mt-1">Standard soft skills & experiences</p>
                      </div>
                    </div>
                  </button>

                  {/* Dynamic Options Based on Resume */}
                  {parsedData && dynamicOptions.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-[1px] flex-grow bg-slate-200 dark:bg-slate-800"></div>
                        <span className="text-xs font-semibold text-green-600 dark:text-green-500 tracking-wider">RECOMMENDED FOR YOU</span>
                        <div className="h-[1px] flex-grow bg-slate-200 dark:bg-slate-800"></div>
                      </div>
                      <div className="space-y-3">
                        {dynamicOptions.map((opt, idx) => (
                          <button onClick={() => handleStartInterview(opt)} key={idx} className="w-full group p-4 border border-green-500/30 bg-green-500/5 rounded-lg text-left hover:border-green-500/60 hover:bg-green-500/10 transition-all">
                            <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-green-600 dark:text-green-500">psychology</span>
                              <div>
                                <h4 className="font-medium text-sm text-green-800 dark:text-green-400">{opt}</h4>
                                <p className="text-xs text-green-700/70 dark:text-green-500/70 mt-1">Tailored from your resume</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="mt-6 text-[11px] text-slate-400 text-center max-w-sm">
              By clicking start, you agree to our Terms of Service and Privacy Policy regarding system evaluation.
            </p>
          </div>
        </main>
      )}

      {interviewState !== 'active' && (
        <footer className="mt-8 pb-8 border-t border-slate-200 dark:border-slate-800 relative z-10 w-full bg-background-light dark:bg-background-dark">
          <div className="max-w-7xl mx-auto px-6 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-400">© 2024 InterviewAI. All rights reserved.</p>
            <div className="flex gap-6">
              <a className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" href="#">Help</a>
              <a className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" href="#">Status</a>
              <a className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" href="#">Privacy</a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
