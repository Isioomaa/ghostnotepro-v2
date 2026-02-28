import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { TRANSLATIONS } from '../constants/languages';
import { renderMarkdownBlock } from '../utils/renderMarkdown';

const StrategicBriefView = () => {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [t, setT] = useState(TRANSLATIONS.EN); // Default to EN

    useEffect(() => {
        // Fetch from local storage (Simulated Archive)
        const loadArchive = () => {
            try {
                const archived = localStorage.getItem(`ghostnote_archive_${id}`);
                if (archived) {
                    const parsedData = JSON.parse(archived);
                    setData(parsedData);

                    // Identify language from archived data info if available, else EN
                    // Note: Current archive saving logic in SynthesisResult saves 'language' key
                    if (parsedData.language && TRANSLATIONS[parsedData.language]) {
                        setT(TRANSLATIONS[parsedData.language]);
                        // Set doc direction if needed
                        document.documentElement.dir = parsedData.language === 'AR' ? 'rtl' : 'ltr';
                    }
                }
            } catch (err) {
                console.error("Failed to load archive", err);
            } finally {
                setLoading(false);
            }
        };
        loadArchive();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FFFEF7] flex items-center justify-center text-gray-900 font-serif">
                <span className="animate-pulse tracking-widest uppercase text-xs">
                    {t.brief_view?.retrieving || "Retrieving from Vault..."}
                </span>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-[#FFFEF7] flex flex-col items-center justify-center text-gray-900 font-serif p-8">
                <h1 className="text-3xl font-playfair mb-4">{t.brief_view?.not_found || "404: Archive Not Found"}</h1>
                <p className="text-gray-500 italic mb-8">{t.brief_view?.expunged || "This strategic brief has been expunged or never existed."}</p>
                <Link to="/" className="text-xs font-bold uppercase tracking-widest border-b border-gray-900 pb-1 hover:opacity-50 transition-opacity">
                    {t.brief_view?.return_command || "Return to Command"}
                </Link>
            </div>
        );
    }

    const isStrategist = !!(content.executive_judgement || content.judgment);
    const scribeSnippet = content.core_thesis || (content.strategic_pillars?.[0]?.description) || "";


    return (
        <div className="min-h-screen bg-[#FFFEF7] text-gray-900 py-12 px-6 selection:bg-[#D4AF37] selection:text-white print:bg-white print:p-0 fade-in">
            <Helmet>
                <title>{content.core_thesis || "Strategic Intelligence Brief | GhostNote Pro"}</title>
                <meta name="description" content={scribeSnippet.substring(0, 160)} />

                {/* Open Graph / Facebook */}
                <meta property="og:type" content="article" />
                <meta property="og:url" content={`https://ghostnotepro.com/archive/${id}`} />
                <meta property="og:title" content={content.core_thesis || "Strategic Intelligence Brief"} />
                <meta property="og:description" content={`Executive-grade strategy from voice notes. ${scribeSnippet.substring(0, 150)}`} />
                <meta property="og:image" content="https://ghostnotepro.com/og-image.png" />

                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:url" content={`https://ghostnotepro.com/archive/${id}`} />
                <meta name="twitter:title" content={content.core_thesis || "Strategic Intelligence Brief"} />
                <meta name="twitter:description" content={scribeSnippet.substring(0, 150)} />
                <meta name="twitter:image" content="https://ghostnotepro.com/og-image.png" />
            </Helmet>

            {/* Museum Container */}
            <article className="max-w-[800px] mx-auto bg-white shadow-sm border border-gray-100 p-12 md:p-20 print:shadow-none print:border-none print:p-0">

                {/* Header */}
                <header className="mb-12 border-b-2 border-black pb-8">
                    <div className="flex justify-between items-baseline mb-6 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                        <span>{t.brief_view?.archive_label || "GhostNote Pro Archive"}</span>
                        <span>{new Date(data.timestamp || Date.now()).toLocaleDateString(data.language === 'EN' ? 'en-US' : data.language, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>

                    <h1 className="font-playfair font-bold text-4xl md:text-6xl leading-tight mb-8 text-black">
                        {content.core_thesis || "Strategic Intelligence Brief"}
                    </h1>

                    {/* Emphasis Audit Metadata */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between font-mono text-xs text-gray-600 bg-gray-50 p-4 border-t border-b border-gray-200">
                        <div className="space-x-6">
                            <span>{t.brief_view?.duration || "DURATION"}: <span className="text-black">{audit.duration || "Unknown"}</span></span>
                            <span>{t.brief_view?.intensity || "INTENSITY"}: <span className={`font-bold ${audit.intensity === 'High' ? 'text-red-700' : 'text-black'}`}>{audit.intensity || "Medium"}</span></span>
                        </div>
                        <div className="mt-2 md:mt-0 font-serif italic text-gray-800">
                            {t.brief_view?.state || "State"}: {audit.executive_state || "Reflective"}
                        </div>
                    </div>
                </header>

                {/* Content Body */}
                <div className="space-y-12 font-lora text-lg leading-[1.8] text-gray-800">

                    {/* Strategy Mode Content */}
                    {isStrategist ? (
                        <>
                            <section>
                                <h3 className="font-sans font-bold text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-6">{t.strategist?.judgment || "Executive Judgment"}</h3>
                                <div className="font-playfair font-medium text-2xl md:text-3xl leading-relaxed text-black italic">
                                    {renderMarkdownBlock(content.executive_judgement || content.judgment)}
                                </div>
                            </section>

                            <hr className="border-gray-200" />

                            <section>
                                <h3 className="font-sans font-bold text-[10px] uppercase tracking-[0.3em] text-red-800/60 mb-6">{t.strategist?.risk_audit || "Risk Audit"}</h3>
                                <div className="bg-red-50/50 p-8 md:p-12 border-l-4 border-red-800 text-red-900 text-lg md:text-xl font-medium leading-relaxed italic">
                                    {renderMarkdownBlock(content.risk_audit || content.riskAudit)}
                                </div>
                            </section>

                            <section>
                                <h3 className="font-sans font-bold text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-6">{t.strategist?.email_draft || "Drafted Communication"}</h3>
                                <div className="font-mono text-sm md:text-base bg-gray-50 p-8 md:p-12 border border-gray-100 text-gray-700 whitespace-pre-wrap leading-relaxed">
                                    {typeof (content.email_draft || content.emailDraft) === 'string'
                                        ? (content.email_draft || content.emailDraft)
                                        : ((content.email_draft || content.emailDraft)?.body || "Top Secret")}
                                </div>
                            </section>
                        </>
                    ) : (
                        /* Scribe Mode Content */
                        <>
                            {/* Thesis is already H1, so maybe intro text if any, or jump to pillars */}

                            {content.strategic_pillars && content.strategic_pillars.length > 0 && (
                                <section>
                                    <h3 className="font-sans font-bold text-xs uppercase tracking-[0.2em] text-gray-400 mb-8">{t.scribe?.strategic_pillars || "Strategic Pillars"}</h3>
                                    <div className="space-y-10">
                                        {content.strategic_pillars.map((pillar, idx) => (
                                            <div key={idx}>
                                                <h4 className="font-bold text-black text-xl mb-3">{pillar.title}</h4>
                                                <p className="text-gray-700">
                                                    {pillar.rich_description || pillar.description}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {content.tactical_steps && content.tactical_steps.length > 0 && (
                                <section className="bg-gray-50 border-t-2 border-black p-8 mt-12">
                                    <h3 className="font-sans font-bold text-xs uppercase tracking-[0.2em] text-gray-500 mb-6">{t.scribe?.tactical_steps || "Tactical Roadmap"}</h3>
                                    <ul className="space-y-4 list-none">
                                        {content.tactical_steps.map((step, idx) => (
                                            <li key={idx} className="flex items-start">
                                                <span className="font-mono text-xs font-bold mr-4 mt-1.5 text-black">0{idx + 1}</span>
                                                <span>{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </>
                    )}

                </div>

                {/* Footer */}
                <footer className="mt-20 pt-12 border-t border-gray-200 text-center print:hidden">
                    <p className="font-serif italic text-gray-400 mb-8">{t.brief_view?.generated_by || "This strategic brief was generated by GhostNote Pro."}</p>
                    <Link
                        to="/"
                        className="inline-block bg-black text-white font-sans text-xs font-bold uppercase tracking-[0.2em] px-8 py-4 hover:bg-gray-800 transition-colors"
                    >
                        {t.brief_view?.create_own || "Create Your Own Executive Intelligence"}
                    </Link>
                </footer>

            </article>
        </div>
    );
};

export default StrategicBriefView;
