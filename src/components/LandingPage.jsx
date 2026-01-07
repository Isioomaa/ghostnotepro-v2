import React from 'react';
import AudioRecorder from './AudioRecorder';
import { getLanguageName } from '../constants/languages';

const LandingPage = ({ onUploadSuccess, t, currentLang, isPro }) => {
    return (
        <section className="text-center mb-12 fade-in">
            <h1 className="font-playfair font-bold text-4xl leading-tight md:text-5xl md:leading-tight lg:text-7xl lg:leading-tight mb-6 tracking-tight">
                {t.hero.title}<span className="italic text-[#D4AF37]">{t.hero.titleHighlight}</span>
            </h1>
            <p className="font-sans text-base md:text-xl opacity-60 max-w-xl mx-auto mb-12 font-light px-4">
                {t.hero.subtitle}
            </p>

            {/* The Machine (AudioRecorder) */}
            <div className="luxury-glow rounded-3xl p-8 bg-white/5 border border-white/10 backdrop-blur-sm shadow-2xl">
                <AudioRecorder
                    onUploadSuccess={onUploadSuccess}
                    t={t}
                    languageName={getLanguageName(currentLang)}
                    isPro={isPro}
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
