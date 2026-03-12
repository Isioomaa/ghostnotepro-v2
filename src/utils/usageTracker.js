const USAGE_DATA_KEY = 'ghostnote_daily_usage';
const PRO_STATUS_KEY = 'ghostnote_is_pro';
export const LIMIT = 3;

export const PRO_STATUS_CHANGED_EVENT = 'ghostnote-pro-changed';

// Daily Usage Data Management
const getTodayDateString = () => {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
};

const getDailyUsageData = () => {
    try {
        const raw = localStorage.getItem(USAGE_DATA_KEY);
        if (!raw) return { count: 0, date: getTodayDateString() };
        const data = JSON.parse(raw);
        // Reset if it's a new day
        if (data.date !== getTodayDateString()) {
            return { count: 0, date: getTodayDateString() };
        }
        return data;
    } catch {
        return { count: 0, date: getTodayDateString() };
    }
};

const saveDailyUsageData = (data) => {
    localStorage.setItem(USAGE_DATA_KEY, JSON.stringify(data));
};

// Usage Count Management
export const getUsageCount = () => {
    return getDailyUsageData().count;
};

export const incrementUsageCount = () => {
    const data = getDailyUsageData();
    data.count += 1;
    data.date = getTodayDateString();
    saveDailyUsageData(data);
};

export const resetUsageCount = () => {
    saveDailyUsageData({ count: 0, date: getTodayDateString() });
};

// Pro Status Management
export const isPro = () => {
    const proStatus = localStorage.getItem(PRO_STATUS_KEY);
    const legacyProStatus = localStorage.getItem('isPro'); // Fallback for manual user override
    return proStatus === 'true' || legacyProStatus === 'true';
};

export const setPro = (value) => {
    localStorage.setItem(PRO_STATUS_KEY, value.toString());
    window.dispatchEvent(new CustomEvent(PRO_STATUS_CHANGED_EVENT, { detail: { isPro: value } }));
};

// Daily Limit Check
export const hasReachedLimit = () => {
    if (isPro()) return false;
    return getUsageCount() >= LIMIT;
};

export const getRemainingGenerations = () => {
    if (isPro()) return Infinity;
    const remaining = LIMIT - getUsageCount();
    return Math.max(0, remaining);
};

// Daily limit message
export const getDailyLimitMessage = () => {
    return "You have used your 3 daily transmutations. Your limit resets in 24 hours. Upgrade to Pro for unlimited access and The Strategist suite.";
};
