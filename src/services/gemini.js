import axios from 'axios';

const API_BASE_URL = '/api'; // Use relative path for Vercel/Production
const HISTORY_KEY = 'ghostnote_history';
const DRAFTS_KEY = 'ghostnote_drafts';

/**
 * Robustly parses JSON from AI responses by stripping markdown and conversational text.
 */
const cleanAndParseJSON = (text) => {
    // If it's already an object, return it
    if (typeof text !== 'string') return text;

    try {
        // Remove markdown block backticks and 'json' identifier
        let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Extract content between the first and last curly braces
        const start = cleanText.indexOf('{');
        const end = cleanText.lastIndexOf('}');

        if (start !== -1 && end !== -1) {
            cleanText = cleanText.substring(start, end + 1);
        }

        return JSON.parse(cleanText);
    } catch (e) {
        console.error("STRICT JSON PARSING FAILED. RAW TEXT:", text);
        throw new Error("The strategy generation returned an invalid format. Results were logged to console.");
    }
};

export const transmuteAudio = async (audioBlob, language) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    if (language) formData.append('language', language);

    try {
        const response = await axios.post(`${API_BASE_URL}/transmute`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data.text;
    } catch (error) {
        console.error("Transmutation error:", error);
        throw error;
    }
};

export const generateExecutiveSuite = async (text, analysis, language, variation = false) => {
    // Mocking the generation for now to bypass backend DB issues
    // In a real Vercel app, this would still call the backend, but the backend would not use a DB
    try {
        const response = await axios.post(`${API_BASE_URL}/generate-post`, {
            text,
            analysis,
            language,
            variation
        });

        // Apply robust parsing in case the backend returns a string or has raw fluff
        const processedData = cleanAndParseJSON(response.data);
        return processedData;
    } catch (error) {
        console.error("Generation error:", error);
        // Fallback or rethrow
        throw error;
    }
};

export const saveDraft = async (audioBlob, language) => {
    // Moved to LocalStorage in AudioRecorder.jsx directly
    return { status: 'success' };
};

export const sealWager = async (sessionId, prediction, days) => {
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        const reviewDate = new Date();
        reviewDate.setDate(reviewDate.getDate() + parseInt(days));

        const newWager = {
            id: Date.now(),
            session_id: sessionId,
            prediction,
            days,
            created_at: new Date().toISOString(),
            review_date: reviewDate.toISOString(),
            status: 'PENDING'
        };

        const updatedHistory = [newWager, ...history];
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
        return { status: 'success' };
    } catch (error) {
        console.error("Seal wager error:", error);
        throw error;
    }
};

export const fetchDecisionHistory = async () => {
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        return history;
    } catch (error) {
        console.error("Fetch history error:", error);
        return [];
    }
};

export const auditDecision = async (decisionId, audioBlob, language) => {
    // Since we can't easily record and analyze on backend WITHOUT a DB context for the original wager
    // We'll mock the audit result for now to keep the UI functional
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        const decisionIndex = history.findIndex(d => d.id === decisionId);

        if (decisionIndex === -1) throw new Error("Decision not found");

        const result = {
            accuracy_score: 85,
            blind_spot: "Overestimated the direct correlation between input and outcome.",
            growth_insight: "Focus on secondary effects in the next cycle."
        };

        history[decisionIndex] = {
            ...history[decisionIndex],
            status: 'AUDITED',
            ...result
        };

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        return result;
    } catch (error) {
        console.error("Audit decision error:", error);
        throw error;
    }
};
