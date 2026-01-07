import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const StrategicBriefView = () => {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch from local storage (Simulated Archive)
        const loadArchive = () => {
            try {
                const archived = localStorage.getItem(`archive:${id}`);
                if (archived) {
                    setData(JSON.parse(archived));
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
                <span className="animate-pulse tracking-widest uppercase text-xs">Retrieving from Vault...</span>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-[#FFFEF7] flex flex-col items-center justify-center text-gray-900 font-serif p-8">
                <h1 className="text-3xl font-playfair mb-4">404: Archive Not Found</h1>
                <p className="text-gray-500 italic mb-8">This strategic brief has been expunged or never existed.</p>
                <Link to="/" className="text-xs font-bold uppercase tracking-widest border-b border-gray-900 pb-1 hover:opacity-50 transition-opacity">Return to Command</Link>
            </div>
        );
    }

    // Determine Mode and Content
    const isStrategist = !!data.content?.executive_judgement;
    const content = data.content || {};
    const audit = data.analysis?.audit || {};

    return (
        <div className="min-h-screen bg-[#FFFEF7] text-gray-900 py-12 px-6 selection:bg-[#D4AF37] selection:text-white print:bg-white print:p-0">
            {/* Museum Container */}
            <article className="max-w-[800px] mx-auto bg-white shadow-sm border border-gray-100 p-12 md:p-20 print:shadow-none print:border-none print:p-0">

                {/* Header */}
                <header className="mb-12 border-b-2 border-black pb-8">
                    <div className="flex justify-between items-baseline mb-6 font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                        <span>GhostNote Pro Archive</span>
                        <span>{new Date(data.timestamp || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>

                    <h1 className="font-playfair font-bold text-4xl md:text-6xl leading-tight mb-8 text-black">
                        {content.core_thesis || "Strategic Intelligence Brief"}
                    </h1>

                    {/* Emphasis Audit Metadata */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between font-mono text-xs text-gray-600 bg-gray-50 p-4 border-t border-b border-gray-200">
                        <div className="space-x-6">
                            <span>DURATION: <span className="text-black">{audit.duration || "Unknown"}</span></span>
                            <span>INTENSITY: <span className={`font-bold ${audit.intensity === 'High' ? 'text-red-700' : 'text-black'}`}>{audit.intensity || "Medium"}</span></span>
                        </div>
                        <div className="mt-2 md:mt-0 font-serif italic text-gray-800">
                            State: {audit.executive_state || "Reflective"}
                        </div>
                    </div>
                </header>

                {/* Content Body */}
                <div className="space-y-12 font-lora text-lg leading-[1.8] text-gray-800">

                    {/* Strategy Mode Content */}
                    {isStrategist ? (
                        <>
                            <section>
                                <h3 className="font-sans font-bold text-xs uppercase tracking-[0.2em] text-gray-400 mb-6">Executive Judgment</h3>
                                <p className="font-medium text-xl md:text-2xl leading-relaxed text-black">
                                    {content.executive_judgement}
                                </p>
                            </section>

                            <hr className="border-gray-200" />

                            <section>
                                <h3 className="font-sans font-bold text-xs uppercase tracking-[0.2em] text-red-800/60 mb-6">Risk Audit</h3>
                                <div className="bg-red-50 p-8 border-l-2 border-red-800 text-red-900 text-base italic">
                                    {content.risk_audit}
                                </div>
                            </section>

                            <section>
                                <h3 className="font-sans font-bold text-xs uppercase tracking-[0.2em] text-gray-400 mb-6">Drafted Communication</h3>
                                <div className="font-mono text-sm bg-gray-50 p-8 border border-gray-100 text-gray-700 whitespace-pre-wrap">
                                    {typeof content.email_draft === 'string' ? content.email_draft : (content.email_draft?.body || "Top Secret")}
                                </div>
                            </section>
                        </>
                    ) : (
                        /* Scribe Mode Content */
                        <>
                            {/* Thesis is already H1, so maybe intro text if any, or jump to pillars */}

                            {content.strategic_pillars && content.strategic_pillars.length > 0 && (
                                <section>
                                    <h3 className="font-sans font-bold text-xs uppercase tracking-[0.2em] text-gray-400 mb-8">Strategic Pillars</h3>
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
                                    <h3 className="font-sans font-bold text-xs uppercase tracking-[0.2em] text-gray-500 mb-6">Tactical Roadmap</h3>
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
                    <p className="font-serif italic text-gray-400 mb-8">This strategic brief was generated by GhostNote Pro.</p>
                    <Link
                        to="/"
                        className="inline-block bg-black text-white font-sans text-xs font-bold uppercase tracking-[0.2em] px-8 py-4 hover:bg-gray-800 transition-colors"
                    >
                        Create Your Own Brief
                    </Link>
                </footer>

            </article>
        </div>
    );
};

export default StrategicBriefView;
