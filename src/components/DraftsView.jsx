import { deleteDraft } from '../services/gemini';

const DraftsView = ({ onClose, t, onLoadDraft }) => {
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Default fallback to English if t prop is missing (safe guard)
    const localT = t || TRANSLATIONS.EN;

    useEffect(() => {
        fetchDrafts();
    }, []);

    const fetchDrafts = () => {
        try {
            const localDrafts = JSON.parse(localStorage.getItem('ghostnote_drafts') || '[]');
            setDrafts(localDrafts);
        } catch (err) {
            console.error('Failed to fetch local drafts:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (window.confirm("Delete this draft permanently?")) {
            await deleteDraft(id);
            fetchDrafts();
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (draft) => {
        if (draft.content && (draft.content.core_thesis || draft.content.judgment)) {
            return <span className="text-[10px] bg-green-900/40 text-green-400 px-2 py-1 rounded border border-green-500/20 uppercase tracking-widest">COMPLETE</span>;
        }
        return <span className="text-[10px] bg-yellow-900/40 text-yellow-400 px-2 py-1 rounded border border-yellow-500/20 uppercase tracking-widest">TRANSCRIBED</span>;
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto backdrop-blur-sm transition-all duration-300">
            <div className="max-w-4xl mx-auto px-4 py-8 md:px-6 md:py-12">
                {/* Header */}
                <div className="flex justify-between items-start mb-12">
                    <div>
                        <h2 className="font-playfair font-bold text-3xl text-white mb-2">{localT.navigation?.drafts || "DRAFTS"}</h2>
                        <p className="text-gray-400 text-sm italic">
                            {localT.drafts_view?.subtitle || "Raw ideas. Unhatched plans. Dump your brain here."}
                        </p>
                    </div>
                    <motion.button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                        whileTap={{ scale: 0.96 }}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </motion.button>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-2 border-tactical-amber border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && drafts.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
                            <span className="text-3xl">💭</span>
                        </div>
                        <h3 className="text-white font-bold mb-2">{localT.drafts_view?.empty_title || "No drafts yet"}</h3>
                        <p className="text-gray-400 text-sm">
                            {localT.drafts_view?.empty_desc || "Record a thought and hit 'Save Draft' to save it here."}
                        </p>
                    </div>
                )}

                {/* Masonry Grid */}
                {!loading && drafts.length > 0 && (
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                        {drafts.map((draft, idx) => (
                            <motion.div
                                key={draft.id}
                                onClick={() => onLoadDraft && onLoadDraft(draft)}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: idx * 0.1 }}
                                className="dossier-card p-5 break-inside-avoid mb-4 group cursor-pointer border border-white/5 hover:border-tactical-amber/50 hover:bg-white/5 transition-all relative"
                            >
                                {/* Tag */}
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-lg">{draft.tag ? draft.tag.split(' ')[0] : '🎤'}</span>
                                    <div className="flex items-center space-x-2">
                                        {getStatusBadge(draft)}
                                    </div>
                                </div>

                                {/* Title */}
                                <h3 className="font-bold text-white text-sm mb-3 leading-tight line-clamp-2 group-hover:text-tactical-amber transition-colors">
                                    {draft.title}
                                </h3>

                                {/* Transcript Preview */}
                                <p className="text-gray-400 text-xs leading-relaxed line-clamp-3 mb-4">
                                    {draft.transcript}
                                </p>

                                {/* Footer Info */}
                                <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                                    <span className="text-[10px] uppercase tracking-widest text-gray-500">
                                        {formatDate(draft.created_at)}
                                    </span>
                                    <button
                                        onClick={(e) => handleDelete(e, draft.id)}
                                        className="text-gray-600 hover:text-red-500 transition-colors p-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DraftsView;
