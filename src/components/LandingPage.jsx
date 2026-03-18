import React from 'react';
import AudioRecorder from './AudioRecorder';
import { getLanguageName } from '../constants/languages';

const LandingPage = ({ onUploadSuccess, t, currentLang, isPro, initialAudio }) => {
    return (
        <section className="text-center mb-12 fade-in">
            <h1 className="font-playfair font-bold text-4xl leading-tight md:text-5xl md:leading-tight lg:text-7xl lg:leading-tight mb-6 tracking-tight">
                {t.hero.title}<span className="italic text-[#D4AF37]">{t.hero.titleHighlight}</span>
            </h1>
            <p className="font-sans text-base md:text-xl opacity-60 max-w-xl mx-auto mb-12 font-light px-4">
                {t.hero.subtitle}
            </p>

            {/* Static Scribe Preview */}
            <div className="max-w-xl mx-auto mb-16 px-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-4 text-center">
                    {t.labels.what_voice_becomes}
                </p>
                <div className="dossier-card p-6 md:p-8 text-left bg-[#0a0a0a] border border-[#222] rounded-xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-[#D4AF37]"></div>
                    <div className="mb-6">
                        <h4 className="font-sans font-bold uppercase tracking-widest text-[10px] text-[#D4AF37] mb-2">Core Thesis</h4>
                        <p className="font-playfair font-bold text-xl md:text-2xl leading-tight text-white">
                            "The next phase of growth requires decoupling revenue from headcount by productizing our internal operations."
                        </p>
                    </div>
                    <div className="border-l-2 border-[#D4AF37]/20 pl-4 py-1">
                        <h5 className="font-sans font-bold text-white text-sm md:text-base uppercase tracking-wider mb-2">SaaS Operational Pivot</h5>
                        <p className="font-serif text-sm md:text-base text-gray-400 leading-relaxed">
                            We must package our proprietary delivery workflows into a licensable product. This transition will temporarily compress margins but unlock exponential scale by Q4.
                        </p>
                    </div>
                </div>
            </div>

            {/* The Machine (AudioRecorder) */}
            <div className="luxury-glow rounded-3xl p-8 bg-white/5 border border-white/10 backdrop-blur-sm shadow-2xl">
                <AudioRecorder
                    onUploadSuccess={onUploadSuccess}
                    t={t}
                    languageName={getLanguageName(currentLang)}
                    isPro={isPro}
                    initialAudio={initialAudio}
                />
            </div>

            {/* Social Proof */}
            <div className="mt-12 opacity-40 text-sm tracking-[0.3em] uppercase flex flex-col items-center space-y-4 px-4 text-center">
                <span className="h-px w-12 bg-white/20"></span>
                <p>{t.hero.footer}</p>
            </div>
        </section>
    );
};

export default LandingPage;
