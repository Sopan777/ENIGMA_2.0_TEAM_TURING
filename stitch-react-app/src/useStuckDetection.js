import { useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook that detects when the user hasn't edited code for a while.
 * Calls the analyze-stuck endpoint and returns suggestions.
 */
export function useStuckDetection({
    code,
    problemData,
    isActive,
    onStuckDetected,
    idleThresholdSeconds = 60
}) {
    const lastEditTimeRef = useRef(Date.now());
    const timerRef = useRef(null);
    const lastCodeRef = useRef(code);
    const hasFiredRef = useRef(false);

    // Track code changes
    useEffect(() => {
        if (code !== lastCodeRef.current) {
            lastCodeRef.current = code;
            lastEditTimeRef.current = Date.now();
            hasFiredRef.current = false; // Reset so it can fire again after next idle
        }
    }, [code]);

    const checkIfStuck = useCallback(async () => {
        if (!isActive || !problemData || hasFiredRef.current) return;

        const idleSeconds = Math.floor((Date.now() - lastEditTimeRef.current) / 1000);
        if (idleSeconds < idleThresholdSeconds) return;

        try {
            const response = await fetch('http://localhost:8000/api/analyze-stuck', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: lastCodeRef.current,
                    problem_title: problemData.title,
                    problem_description: problemData.description,
                    language: problemData.language,
                    time_since_last_edit_seconds: idleSeconds,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.is_stuck && data.suggestion) {
                    hasFiredRef.current = true;
                    onStuckDetected(data.suggestion);
                }
            }
        } catch (err) {
            // Silent fail — stuck detection is non-critical
            console.warn('Stuck detection check failed:', err);
        }
    }, [isActive, problemData, idleThresholdSeconds, onStuckDetected]);

    // Poll every 30 seconds
    useEffect(() => {
        if (!isActive) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(checkIfStuck, 30000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isActive, checkIfStuck]);
}
