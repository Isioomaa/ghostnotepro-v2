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
        return response.data;
    } catch (error) {
        console.error("Transmutation error:", error);
        throw error;
    }
};

export const generateExecutiveSuite = async (text, analysis, language, mode = 'scribe', isPro = false, industry = null) => {
    // Note: analysis, language might be unused in backend but keeping signature compatible if needed, 
    // or we can clean up. The backend only uses `text`, `mode`, `isPro`.

    try {
        const response = await fetch(`${API_BASE_URL}/generate-post`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text,
                mode,
                isPro,
                industry
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Generation failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();

        // Apply robust parsing in case the backend returns a string or has raw fluff
        // The backend now returns { status: "success", mode: "...", content: {...} }
        // We need to return the 'content' part, or merged data?
        // The previous code returned `processedData`.

        if (data.status === 'success' && data.content) {
            return data.content;
        } else {
            // Fallback if structure is different
            return cleanAndParseJSON(data);
        }

    } catch (error) {
        console.error("Generation error:", error);
        throw error;
    }
};

export const saveDraft = async () => {
    // Moved to LocalStorage in AudioRecorder.jsx directly
    return { status: 'success' };
};

export const updateDraft = async (draftId, updates) => {
    try {
        const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
        const index = drafts.findIndex(d => d.id === draftId);

        if (index !== -1) {
            drafts[index] = { ...drafts[index], ...updates };
            localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
            return drafts[index];
        }
        return null;
    } catch (e) {
        console.error("Failed to update draft", e);
        return null;
    }
};

export const deleteDraft = async (draftId) => {
    try {
        const drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]');
        const updated = drafts.filter(d => d.id !== draftId);
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
        return true;
    } catch (e) {
        console.error("Failed to delete draft", e);
        return false;
    }
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

export const auditDecision = async (decisionId) => {
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
