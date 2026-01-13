import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import SynthesisResult from './components/SynthesisResult';
import PublicReadView from './components/PublicReadView';
import DraftsView from './components/DraftsView';
import TheLoopDashboard from './components/TheLoopDashboard';
import { TRANSLATIONS, getLanguageName } from './constants/languages';
import { analyzeText } from './utils/analysis';
import { isPro as getInitialPro, PRO_STATUS_CHANGED_EVENT } from './utils/usageTracker';
import { PrivacyPolicy, TermsOfService, RefundPolicy } from './components/LegalDocs';
import LanguageSelector from './components/LanguageSelector';
import { FaLinkedin, FaXTwitter, FaWhatsapp } from 'react-icons/fa6';
import PaywallModal from './components/PaywallModal';

function MainApp() {
  const [transcription, setTranscription] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [currentLang, setCurrentLang] = useState('EN');
  const [activeView, setActiveView] = useState('main'); // 'main', 'privacy', 'terms', 'refund'
  const [showToast, setShowToast] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [toastMessage, setToastMessage] = useState("Link copied to clipboard");
  const [isPro, setIsPro] = useState(getInitialPro());
  const [activeModal, setActiveModal] = useState(null); // 'drafts', 'history', null
  const [initialResultData, setInitialResultData] = useState(null); // For loading drafts
  const [currentDraftId, setCurrentDraftId] = useState(null); // Track active draft ID
  const [industry, setIndustry] = useState(null); // Detected industry context

  // Reactive Pro Status
  useEffect(() => {
    const handleProChange = (e) => {
      setIsPro(e.detail.isPro);
    };
    window.addEventListener(PRO_STATUS_CHANGED_EVENT, handleProChange);
    return () => window.removeEventListener(PRO_STATUS_CHANGED_EVENT, handleProChange);
  }, []);

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.EN;

  // RTL Support
  useEffect(() => {
    document.documentElement.dir = currentLang === 'AR' ? 'rtl' : 'ltr';
  }, [currentLang]);

  const handleUploadSuccess = async (text, platforms, analysisData) => {
    if (!text) return;
    setTranscription(text);
    setCurrentDraftId(null); // Reset draft ID on new upload/recording unless we explicitly save it there (which we don't yet in AudioRecorder directly to App)

    // Store content if provided separately (for Scribe view)
    if (analysisData && analysisData.content) {
      setInitialResultData(analysisData.content);
    }

    if (analysisData && analysisData.industry) {
      setIndustry(analysisData.industry);
    }

    try {
      if (analysisData && analysisData.audit) {
        // Use the backend-provided Emphasis Audit
        setAnalysis(analysisData.audit);
      } else {
        // Fallback to local analysis (Legacy)
        const analysisResult = analyzeText(text);
        setAnalysis(analysisResult || {
          word_count: 0,
          tone: "Neutral",
          emotion: "calm",
          virality_score: 0,
          suggestions: []
        });
      }
    } catch (err) {
      console.error("Analysis failed", err);
      // Fallback
      setAnalysis({
        word_count: 0,
        tone: "Neutral",
        emotion: "calm",
        virality_score: 0,
        suggestions: []
      });
    }
  };

  const handleReset = () => {
    setTranscription(null);
    setAnalysis(null);
    setInitialResultData(null);
    setCurrentDraftId(null);
    setIndustry(null);
  };

  const showCustomToast = (msg) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'GhostNote Pro',
          text: t.messages.share_text,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showCustomToast(t.messages.copy_success);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0] flex flex-col font-sans selection:bg-[#D4AF37] selection:text-black">

      {/* Navbar / Header */}
      <Header
        isPro={isPro}
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        setShowPaywall={setShowPaywall}
        onOpenModal={setActiveModal}
        t={t}
      />

      {/* Main Navigation (Tabs) */}
      {!transcription && (
        <div className="max-w-4xl mx-auto w-full px-6 flex justify-between items-center border-b border-white/5 pb-4 mb-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveModal('drafts')}
              className={`text-[10px] uppercase tracking-[0.2em] transition-colors ${activeModal === 'drafts' ? 'text-tactical-amber font-bold' : 'text-gray-500 hover:text-white'}`}
            >
              {t.navigation.drafts}
            </button>
            <button
              onClick={() => setActiveModal('history')}
              className={`text-[10px] uppercase tracking-[0.2em] transition-colors ${activeModal === 'history' ? 'text-tactical-amber font-bold' : 'text-gray-500 hover:text-white'}`}
            >
              {t.navigation.history}
            </button>
          </div>
          <LanguageSelector
            currentLang={currentLang}
            onLanguageChange={setCurrentLang}
          />
        </div>
      )}

      <div className="max-w-4xl mx-auto w-full px-4 md:px-6 py-8">

        {/* Hero Section / Landing Page */}
        {!transcription && (
          <LandingPage
            onUploadSuccess={handleUploadSuccess}
            t={t}
            currentLang={currentLang}
            isPro={isPro}
          />
        )}

        {/* Results View */}
        {transcription && (
          <main className="space-y-12 fade-in">
            <SynthesisResult
              text={transcription}
              analysis={analysis}
              languageName={getLanguageName(currentLang)}
              currentLang={currentLang}
              t={t}
              onReset={handleReset}
              isPro={isPro}
              onShowToast={showCustomToast}
              initialData={initialResultData}
              draftId={currentDraftId}
              onEdit={(newText) => setTranscription(newText)}
              industry={industry}
            />
          </main>
        )}

      </div>

      {/* Footer: System Status Bar */}
      <footer className="w-full bg-zinc-950 border-t border-zinc-900 py-4 px-6 mt-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">

          {/* Left: System Navigation */}
          <div className="flex space-x-8 text-[10px] font-bold uppercase tracking-[0.3em]">
            <button onClick={() => setActiveView('privacy')} className="text-zinc-600 hover:text-tactical-amber transition-colors">{t.legal.privacy}</button>
            <button onClick={() => setActiveView('terms')} className="text-zinc-600 hover:text-tactical-amber transition-colors">{t.legal.terms}</button>
          </div>

          {/* Center: Social Interconnect */}
          <div className="flex space-x-6 text-zinc-500 opacity-40 hover:opacity-100 transition-opacity">
            <a href="#" className="hover:text-tactical-amber transition-colors"><FaLinkedin size={16} /></a>
            <a href="#" className="hover:text-tactical-amber transition-colors"><FaXTwitter size={16} /></a>
            <a href="#" className="hover:text-tactical-amber transition-colors"><FaWhatsapp size={16} /></a>
          </div>

          {/* Right: System Ident / Gift */}
          <div className="flex items-center space-x-8">
            <button
              onClick={handleShare}
              className="text-[10px] uppercase tracking-widest text-zinc-600 hover:text-tactical-amber transition-colors"
            >
              {t.buttons.gift}
            </button>
            <span className="text-[10px] text-zinc-800 font-mono tracking-tighter">SYSTEM v1.0.42</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {activeModal === 'drafts' && (
        <DraftsView
          onClose={() => setActiveModal(null)}
          t={t}
          onLoadDraft={(draft) => {
            setTranscription(draft.transcript || draft.transcription);
            setAnalysis(draft.analysis || null);
            setInitialResultData(draft.content || null); // Pass persisted content if available
            setCurrentDraftId(draft.id); // Set the active draft ID!
            setActiveModal(null);
          }}
        />
      )}
      {activeModal === 'history' && (
        <TheLoopDashboard
          onClose={() => setActiveModal(null)}
          languageName={getLanguageName(currentLang)}
          t={t}
        />
      )}

      {/* Legal Views */}
      {activeView === 'privacy' && <PrivacyPolicy onClose={() => setActiveView('main')} />}
      {activeView === 'terms' && <TermsOfService onClose={() => setActiveView('main')} />}
      {activeView === 'refund' && <RefundPolicy onClose={() => setActiveView('main')} />}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full text-xs font-bold shadow-2xl tracking-widest uppercase z-[100]">
          {toastMessage}
        </div>
      )}

      {/* Paywall Modal */}
      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          scenario="upsell"
          t={t}
        />
      )}
    </div>
  );
}

import StrategicBriefView from './components/StrategicBriefView';

function App() {
  return (
    <HelmetProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route path="/p/:slug" element={<PublicReadView />} />
          <Route path="/s/:id" element={<StrategicBriefView />} />
        </Routes>
      </Router>
    </HelmetProvider>
  );
}

export default App;
