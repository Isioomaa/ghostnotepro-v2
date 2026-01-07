import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import SEO from './SEO';
import { TRANSLATIONS } from '../constants/languages';

const PublicReadView = () => {
    const { slug } = useParams();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [t, setT] = useState(TRANSLATIONS.EN); // Default to EN

    useEffect(() => {
        const fetchSession = async () => {
            let data = null;

            // 1. Try API
            try {
                const response = await axios.get(`/api/public/${slug}`);
                data = response.data;
            } catch (err) {
                console.log("API fetch failed, trying local storage fallback...");
            }

            // 2. Fallback to LocalStorage (Museum Mode Demo)
            if (!data) {
                try {
                    const local = localStorage.getItem(`ghostnote_archive_${slug}`);
                    if (local) {
                        data = JSON.parse(local);
                        // Identify structure: LocalStorage saves { content: ..., language: ... }
                        // API usually returns { data: { content... }, ... }
                        // We normalize to a session object
                    }
                } catch (e) {
                    console.error("Local storage lookup failed", e);
                }
            }

            if (data) {
                setSession(data);

                // Determine Language
                const langCode = data.language || 'EN';
                const translation = TRANSLATIONS[langCode] || TRANSLATIONS.EN;
                setT(translation);

                // Set Direction
                document.documentElement.dir = langCode === 'AR' ? 'rtl' : 'ltr';
            } else {
                setError("Strategy session not found.");
            }
            setLoading(false);
        };
        fetchSession();
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-pulse text-gray-400 font-playfair italic text-2xl">
                    {t.museum?.opening || "Opening the archives..."}
                </div>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
                <h1 className="font-playfair font-bold text-4xl text-gray-900 mb-4">404</h1>
                <p className="font-sans text-gray-600 mb-8">{t.messages?.archive_fail || "Strategy session not found."}</p>
                <Link to="/" className="bg-gray-900 text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-gray-800 transition-all">
                    {t.messages?.create_own || "Generate Your Own Strategy"}
                </Link>
            </div>
        );
    }

    // Normalizing data structure between API and LocalStorage
    // LocalStorage: { content: { core_thesis... }, language: 'EN' }
    // API might wrap it. Assuming 'content' structure is consistent.
    const freeTier = session.content?.free_tier || session.content || session.data?.free_tier;
    const thesis = freeTier?.core_thesis || "";
    const description = thesis.substring(0, 160) + "...";
    const date = session.timestamp ? new Date(session.timestamp) : new Date();

    return (
        <div className="min-h-screen bg-white text-gray-900 selection:bg-gold-500/30 selection:text-gray-900 font-serif fade-in">
            <SEO
                title={thesis}
                description={description}
            />

            {/* Museum Header */}
            <nav className="border-b border-gray-100 py-6 px-6 md:px-12 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-50">
                <div className="font-playfair font-bold text-xl tracking-tight text-gray-900">
                    GHOSTNOTE <span className="text-gray-400 font-light italic">{t.museum.header_reader}</span>
                </div>
                <Link to="/" className="bg-gray-900 text-white px-4 py-2 md:px-6 md:py-2.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-all shadow-lg">
                    {t.museum.try_free}
                </Link>
            </nav>

            <main className="max-w-3xl mx-auto px-6 py-16 md:py-24">
                {/* Metadata */}
                <div className="flex items-center space-x-4 mb-12">
                    <span className="bg-gray-900 text-white text-[10px] uppercase tracking-[0.2em] font-bold px-3 py-1">{t.museum.memo_label}</span>
                    <span className="text-gray-400 text-xs font-sans uppercase tracking-widest">
                        {date.toLocaleDateString(session.language === 'EN' ? 'en-US' : session.language, { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="h-px w-8 bg-gray-200"></span>
                    <span className="text-gray-400 text-xs italic font-sans">{t.museum.internal_access}</span>
                </div>

                {/* Core Thesis */}
                <h1 className="font-playfair font-bold text-4xl md:text-6xl leading-tight mb-12 text-gray-900 tracking-tight">
                    {thesis}
                </h1>

                {/* Article Body */}
                <div className="prose prose-lg max-w-none space-y-16">
                    {freeTier?.strategic_pillars?.map((pillar, idx) => (
                        <section key={idx} className="group">
                            <h2 className="font-sans font-bold uppercase tracking-[0.3em] text-xs text-gold-600 mb-6 group-hover:text-gold-500 transition-colors">
                                {t.scribe?.strategic_pillars || "PILLAR"} 0{idx + 1} &mdash; {pillar.title}
                            </h2>
                            <p className="text-gray-800 text-lg md:text-xl leading-relaxed font-serif">
                                {pillar.rich_description || pillar.description}
                            </p>
                        </section>
                    ))}

                    {freeTier?.tactical_steps && (
                        <section className="bg-gray-50 p-8 md:p-12 border-l-4 border-gray-900">
                            <h2 className="font-sans font-bold uppercase tracking-[0.3em] text-xs text-gray-500 mb-8">{t.scribe?.tactical_steps || "TACTICAL STEPS"}</h2>
                            <ul className="space-y-6">
                                {freeTier.tactical_steps.map((step, idx) => (
                                    <li key={idx} className="flex items-start space-x-4 text-gray-800">
                                        <div className="w-5 h-5 border-2 border-gray-900 flex-shrink-0 mt-1 flex items-center justify-center">
                                            <div className="w-2 h-2 bg-gray-900 opacity-0 transition-opacity"></div>
                                        </div>
                                        <span className="text-base md:text-lg">{step}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>

                {/* Viral Hook (Pro Teaser) */}
                <div className="mt-32 pt-16 border-t border-gray-200 relative overflow-hidden">
                    <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-white to-transparent z-10"></div>

                    <div className="relative z-20">
                        <h3 className="font-sans font-bold uppercase tracking-[0.3em] text-xs text-red-600 mb-12 text-center">{t.museum.encrypted}</h3>

                        <div className="space-y-8 opacity-20 select-none blur-sm pointer-events-none">
                            <div className="h-4 bg-gray-200 w-3/4 mx-auto"></div>
                            <div className="h-4 bg-gray-200 w-full"></div>
                            <div className="h-4 bg-gray-200 w-5/6 mx-auto"></div>
                            <div className="h-4 bg-gray-200 w-2/3 mx-auto"></div>
                        </div>

                        {/* Lock Card */}
                        <div className="max-w-md mx-auto mt-[-80px] bg-gray-900 text-white p-10 text-center shadow-2xl relative z-30 transform hover:scale-[1.02] transition-all">
                            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="text-xl">🔒</span>
                            </div>
                            <h4 className="font-playfair font-bold text-2xl mb-4">{t.museum.lock_title}</h4>
                            <p className="font-sans text-gray-400 text-sm mb-8 leading-relaxed">
                                {t.museum.lock_desc}
                            </p>
                            <Link to="/" className="block w-full bg-white text-gray-900 py-3 rounded-none font-bold uppercase tracking-widest text-xs hover:bg-gray-100 transition-all">
                                {t.messages.create_own}
                            </Link>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="bg-gray-50 py-16 px-6 text-center border-t border-gray-100">
                <div className="font-playfair font-bold text-gray-400 text-lg mb-4 tracking-tighter">GHOSTNOTE PRO</div>
                <p className="text-gray-400 text-xs font-sans uppercase tracking-[0.3em]">{t.museum.built_for}</p>
            </footer>
        </div>
    );
};

export default PublicReadView;
