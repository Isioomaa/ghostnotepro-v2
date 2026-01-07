import React from 'react';
import LanguageSelector from './LanguageSelector';

const Header = ({ isPro, currentLang, onLanguageChange, setShowPaywall, onOpenModal }) => {
    return (
        <nav className="flex flex-col md:flex-row items-center justify-between px-4 md:px-6 py-6 max-w-7xl mx-auto w-full gap-y-4 md:gap-y-0">
            <div className="font-playfair font-bold text-xl md:text-2xl text-[#D4AF37] whitespace-nowrap">
                GHOSTNOTE PRO
            </div>
            <div className="flex items-center">
                {/* Version Badge */}
                <span className="text-xs font-medium opacity-50 border border-white/10 px-3 py-1 rounded-full tracking-widest">
                    v1.0
                </span>
            </div>
        </nav>
    );
};

export default Header;
