/**
 * GA Event Tracking Utility (Section 13)
 */
export const trackEvent = (eventName, params = {}) => {
    if (window.gtag) {
        window.gtag('event', eventName, {
            ...params,
            timestamp: new Date().toISOString()
        });
    } else {
        console.log(`[GA Event Delayed] ${eventName}`, params);
    }
};

export const GA_EVENTS = {
    PAGE_LOAD: 'page_load',
    RECORDING_START: 'recording_started',
    RECORDING_COMPLETE: 'recording_completed',
    TRANSMUTATION_START: 'transmutation_started',
    TRANSMUTATION_COMPLETE: 'transmutation_completed',
    PAYWALL_REACHED: 'paywall_reached',
    UPGRADE_CLICK: 'upgrade_clicked',
    PAYMENT_SUCCESS: 'payment_completed',
    PDF_EXPORT: 'pdf_exported',
    DOC_SHARED: 'document_shared',
    DOMAIN_CHANGED: 'domain_changed',
    EXEC_STATE_OVERRIDE: 'executive_state_overridden'
};
