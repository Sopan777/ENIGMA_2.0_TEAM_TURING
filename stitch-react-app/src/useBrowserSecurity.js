import { useEffect, useState, useRef } from 'react';

export default function useBrowserSecurity(isActive, onCheatDetected) {
    const [warnings, setWarnings] = useState([]);
    const warningCount = useRef(0);
    const lastActiveTime = useRef(Date.now());
    const inactivityInterval = useRef(null);

    const MAX_WARNINGS = 3;
    const INACTIVITY_LIMIT_MS = 120000; // 2 minutes of complete zero mouse/keyboard movement is suspicious

    // Helper to add a warning and check for lockout
    const addWarning = (type, message) => {
        if (!isActive) return;

        const newWarning = {
            id: Date.now(),
            type,
            message,
            timestamp: new Date().toLocaleTimeString()
        };

        setWarnings(prev => [...prev, newWarning]);
        warningCount.current += 1;

        // Report back to parent immediately
        if (onCheatDetected) {
            onCheatDetected(newWarning, warningCount.current >= MAX_WARNINGS);
        }
    };

    useEffect(() => {
        if (!isActive) {
            if (inactivityInterval.current) clearInterval(inactivityInterval.current);
            return;
        }

        // 1. Tab visibility / Switching detection
        const handleVisibilityChange = () => {
            if (document.hidden) {
                addWarning('TAB_SWITCH', 'You switched away from the interview tab.');
            }
        };

        // 2. Fullscreen monitoring
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement) {
                // Enforce returning to fullscreen
                addWarning('FULLSCREEN_EXIT', 'You exited fullscreen mode. Please return to fullscreen.');
            }
        };

        // 3. User Interaction Tracking (Mouse/Keyboard) for Inactivity
        const handleUserActivity = () => {
            lastActiveTime.current = Date.now();
        };

        // Start Inactivity Monitor (Checks every 30s)
        inactivityInterval.current = setInterval(() => {
            const idleTime = Date.now() - lastActiveTime.current;
            if (idleTime > INACTIVITY_LIMIT_MS) {
                addWarning('INACTIVITY', 'No activity detected for a prolonged period.');
                // Reset timer to avoid spamming the warning every 30s
                lastActiveTime.current = Date.now();
            }
        }, 30000);

        // Attach DOM Listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        window.addEventListener('mousemove', handleUserActivity);
        window.addEventListener('keydown', handleUserActivity);
        window.addEventListener('scroll', handleUserActivity);

        // Initial fullscreen request on boot
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('Browser blocked automatic fullscreen request. User must click to initiate.');
            });
        }

        return () => {
            // Cleanup
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            window.removeEventListener('mousemove', handleUserActivity);
            window.removeEventListener('keydown', handleUserActivity);
            window.removeEventListener('scroll', handleUserActivity);
            if (inactivityInterval.current) clearInterval(inactivityInterval.current);
        };
    }, [isActive]);

    // Expose a function to wrap the React code editor's onPaste
    const blockLargePaste = (e) => {
        if (!isActive) return;

        // Get pasted data via clipboard API
        const clipboardData = e.clipboardData || window.clipboardData;
        const pastedData = clipboardData.getData('Text');

        if (pastedData.length > 100) {
            e.preventDefault(); // Block the paste entirely
            addWarning('LARGE_PASTE', `Attempted to paste ${pastedData.length} characters. Large pasting is disabled.`);
            return false; // Tells the editor to stop
        }
        return true; // Allow small pastes (e.g., variable names)
    };

    return {
        warnings,
        blockLargePaste,
        warningCount: warningCount.current,
        maxWarnings: MAX_WARNINGS
    };
}
