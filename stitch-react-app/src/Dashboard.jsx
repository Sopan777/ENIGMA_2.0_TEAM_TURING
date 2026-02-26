import React from 'react';

const Dashboard = ({ setCurrentTab }) => {
    return (
        <main className="max-w-6xl w-full mx-auto px-6 py-12 relative z-10 flex-grow animate-in fade-in duration-300">

            {/* Dashboard Header */}
            <header className="mb-10">
                <h1 className="text-3xl md:text-4xl font-semibold font-display mb-2 text-slate-900 dark:text-white">
                    Welcome back, Alex
                </h1>
                <p className="text-slate-500 font-light text-sm md:text-base">
                    Here is your interview intelligence and performance overview.
                </p>
            </header>

            {/* Grid Layout for the 5 Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">

                {/* =========================================
            SECTION 1: Candidate Overview 
            ========================================= */}
                <section className="lg:col-span-8 flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Readiness Score */}
                        <div className="glass-card p-6 rounded-3xl shadow-sm bg-white dark:bg-transparent flex flex-col items-center justify-center text-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 relative z-10">Readiness Score</h3>
                            <div className="relative w-24 h-24 flex items-center justify-center mb-2 z-10">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                    <path className="text-slate-200 dark:text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path className="text-blue-500" strokeDasharray="76, 100" strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                </svg>
                                <span className="absolute text-2xl font-bold font-display text-slate-900 dark:text-white">76<span className="text-sm">%</span></span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 relative z-10">Based on 12 mock interviews</p>
                        </div>

                        {/* Goal Tracker */}
                        <div className="glass-card md:col-span-2 p-6 rounded-3xl shadow-sm bg-white dark:bg-transparent flex flex-col justify-center">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Goal Tracker</h3>
                                <span className="px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-500 text-[10px] font-bold rounded uppercase">On Track</span>
                            </div>
                            <h4 className="text-lg font-semibold font-display text-slate-900 dark:text-white mb-1">Senior Frontend Engineer Prep</h4>
                            <p className="text-xs text-slate-500 mb-5">Targeting React, System Design, and behavioral rounds.</p>

                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 mb-2 overflow-hidden">
                                <div className="bg-slate-900 dark:bg-white h-2.5 rounded-full" style={{ width: '70%' }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 font-medium">
                                <span>70% Complete</span>
                                <span>Est. 2 weeks left</span>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="glass-card p-6 rounded-3xl shadow-sm bg-white dark:bg-transparent">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6">Recent Activity</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 dark:text-orange-500">
                                        <span className="material-symbols-outlined text-[18px]">code_blocks</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">DSA Array Evaluation</p>
                                        <p className="text-xs text-slate-500">View Transcript • Score: 92%</p>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">2 hours ago</span>
                            </div>

                            <div className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-500">
                                        <span className="material-symbols-outlined text-[18px]">description</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">Resume Updated</p>
                                        <p className="text-xs text-slate-500">Parsed 24 new skills</p>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">Yesterday</span>
                            </div>
                        </div>
                        <button onClick={() => setCurrentTab('history')} className="w-full py-3 mt-4 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5">
                            View Entire History
                        </button>
                    </div>
                </section>

                {/* =========================================
            SECTION 3: AI Interview Arena (Sidebar layout)
            ========================================= */}
                <section className="lg:col-span-4 flex flex-col gap-6">
                    <div className="glass-card p-6 rounded-3xl shadow-sm bg-white dark:bg-transparent border border-blue-500/20 relative overflow-hidden h-full flex flex-col">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full"></div>

                        <div className="flex items-center gap-2 mb-6 relative z-10">
                            <span className="material-symbols-outlined text-blue-600 dark:text-blue-500">sports_esports</span>
                            <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">Interview Arena</h2>
                        </div>

                        <div className="space-y-3 flex-grow relative z-10">
                            <div onClick={() => setCurrentTab('practice')} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-500/10 transition-all cursor-pointer group">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-semibold text-sm group-hover:text-blue-700 dark:group-hover:text-blue-400">Deep Dive Mock</h4>
                                    <span className="material-symbols-outlined text-sm text-slate-400 group-hover:text-blue-500 transition-transform group-hover:translate-x-1">arrow_forward</span>
                                </div>
                                <p className="text-xs text-slate-500">Full 45-min simulation</p>
                            </div>

                            <div onClick={() => setCurrentTab('practice')} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-500/10 transition-all cursor-pointer group">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-semibold text-sm group-hover:text-orange-700 dark:group-hover:text-orange-400">5-Min Warm-up</h4>
                                    <span className="material-symbols-outlined text-sm text-slate-400 group-hover:text-orange-500 transition-transform group-hover:translate-x-1">arrow_forward</span>
                                </div>
                                <p className="text-xs text-slate-500">Rapid fire behavioral questions</p>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 relative z-10">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Upcoming Schedule</h3>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#1A1A1A] rounded-lg">
                                <div className="w-10 h-10 rounded bg-white dark:bg-black border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
                                    <span className="text-[9px] font-bold text-red-500 uppercase">OCT</span>
                                    <span className="text-sm font-bold leading-none text-slate-900 dark:text-white">24</span>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">System Design Focus</p>
                                    <p className="text-[11px] text-slate-500">Today, 4:00 PM</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* =========================================
            SECTION 2: Resume Intelligence Hub
            ========================================= */}
                <section className="lg:col-span-6 glass-card p-8 rounded-3xl shadow-sm bg-white dark:bg-transparent">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-green-600 dark:text-green-500">psychology</span>
                            Resume Intelligence
                        </h2>
                        <button className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700">
                            Update CV
                        </button>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Extracted Skill Cloud</h3>
                        <div className="flex flex-wrap gap-2">
                            {['React', 'Node.js', 'Python', 'System Design', 'AWS', 'GraphQL', 'Tailwind CSS', 'Redux', 'MongoDB'].map(skill => (
                                <span key={skill} className="px-3 py-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300">
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-red-50/50 dark:bg-red-500/5 border border-red-500/20 rounded-xl">
                            <h4 className="text-xs font-bold text-red-800 dark:text-red-400 mb-2 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">warning</span>
                                Gap Analysis
                            </h4>
                            <ul className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                                <li>Missing Docker/Kubernetes</li>
                                <li>No 'CI/CD' keywords found</li>
                                <li>Consider adding testing frameworks</li>
                            </ul>
                        </div>
                        <div className="p-4 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-500/20 rounded-xl flex flex-col justify-center items-center text-center">
                            <span className="material-symbols-outlined text-blue-500 mb-2">quiz</span>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Generate 15 tailored questions from your CV.</p>
                            <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors w-full shadow-sm">
                                Create Question Bank
                            </button>
                        </div>
                    </div>
                </section>

                {/* =========================================
            SECTION 4 & 5: Feedback & Resources Combined
            ========================================= */}
                <section className="lg:col-span-6 flex flex-col gap-6">

                    {/* Section 4: Post-Interview Feedback Insights */}
                    <div className="glass-card p-6 rounded-3xl shadow-sm bg-white dark:bg-transparent">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">insights</span>
                            Latest Feedback Insights
                        </h3>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1A1A1A]">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Filler Word Tracker</p>
                                <div className="flex items-end gap-2">
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none">14</span>
                                    <span className="text-xs text-red-500 font-medium mb-0.5">"ums" / "likes"</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2">Needs improvement</p>
                            </div>

                            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1A1A1A]">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Sentiment Vibe Check</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="material-symbols-outlined text-green-500">sentiment_satisfied</span>
                                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Professional & Calm</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-3 overflow-hidden">
                                    <div className="bg-green-500 h-full rounded-full w-4/5"></div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-purple-50/50 dark:bg-purple-500/5 border border-purple-500/20 rounded-xl">
                            <h4 className="text-[11px] font-bold text-purple-800 dark:text-purple-400 mb-1">AI Critique: Transcript Snippet</h4>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">"Instead of saying 'I sort of built the API', try asserting ownership: 'I architected and implemented the core API layer...'"</p>
                        </div>
                    </div>

                    {/* Section 5: Resources & Market Alignment */}
                    <div className="glass-card p-6 rounded-3xl shadow-sm bg-white dark:bg-transparent">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                            Market Alignment
                        </h3>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                        Google <span className="text-[9px] px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-500 rounded uppercase">High Match</span>
                                    </h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Top AWS & JS questions asked recently</p>
                                </div>
                                <span className="material-symbols-outlined text-sm text-slate-300 group-hover:text-slate-500">open_in_new</span>
                            </div>

                            <div className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Stripe</h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">API Design Challenge Frameworks</p>
                                </div>
                                <span className="material-symbols-outlined text-sm text-slate-300 group-hover:text-slate-500">open_in_new</span>
                            </div>
                        </div>
                    </div>

                </section>

            </div>
        </main>
    );
};

export default Dashboard;
