import { useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { Play, Pause, SkipForward, SkipBack, Maximize2 } from 'lucide-react';

export default function TvLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { 
        currentTrack, 
        isPlaying, 
        togglePlayPause, 
        nextSong, 
        previousSong, 
        setIsFullScreenOpen 
    } = usePlayer();

    // Global D-pad navigation handler
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        // Don't intercept if user is typing in an input
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            if (e.key === 'Escape') {
                target.blur();
                e.preventDefault();
            }
            return;
        }

        const focusable = Array.from(
            document.querySelectorAll('a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])')
        ) as HTMLElement[];
        
        const active = document.activeElement as HTMLElement;
        const currentIndex = focusable.indexOf(active);

        if (currentIndex === -1 && focusable.length > 0) {
            focusable[0].focus();
            return;
        }

        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                if (currentIndex < focusable.length - 1) focusable[currentIndex + 1].focus();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (currentIndex > 0) focusable[currentIndex - 1].focus();
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (active) {
                    const rect = active.getBoundingClientRect();
                    let bestNext: HTMLElement | null = null;
                    let minDistance = Infinity;
                    
                    focusable.forEach(node => {
                        const r = node.getBoundingClientRect();
                        if (r.top > rect.bottom - 10) {
                            const dist = Math.abs(r.left - rect.left) + Math.abs(r.top - rect.bottom);
                            if (dist < minDistance) {
                                minDistance = dist;
                                bestNext = node;
                            }
                        }
                    });
                    if (bestNext) (bestNext as HTMLElement).focus();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (active) {
                    const rect = active.getBoundingClientRect();
                    let bestNext: HTMLElement | null = null;
                    let minDistance = Infinity;
                    
                    focusable.forEach(node => {
                        const r = node.getBoundingClientRect();
                        if (r.bottom < rect.top + 10) {
                            const dist = Math.abs(r.left - rect.left) + Math.abs(r.bottom - rect.top);
                            if (dist < minDistance) {
                                minDistance = dist;
                                bestNext = node;
                            }
                        }
                    });
                    if (bestNext) (bestNext as HTMLElement).focus();
                }
                break;
            case 'Enter':
                if (active && active.tagName !== 'BUTTON' && active.tagName !== 'A' && active.tagName !== 'INPUT') {
                    e.preventDefault();
                    active.click();
                }
                break;
            case 'Escape':
            case 'Backspace':
                if (location.pathname !== '/') {
                    e.preventDefault();
                    navigate(-1);
                }
                break;
        }
    }, [location.pathname, navigate]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Set body background to pure black for TV
    useEffect(() => {
        document.body.style.backgroundColor = '#0a0a0a';
        return () => {
            document.body.style.backgroundColor = '';
        };
    }, []);

    const navItems = [
        { label: 'Inicio', path: '/' },
        { label: 'Buscar', path: '/search' },
        { label: 'Biblioteca', path: '/library' },
        { label: 'Perfil', path: '/profile' },
    ];

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans overflow-hidden">
            {/* Navbar TV */}
            <header className="flex items-center justify-between p-8 bg-neutral-900/50 backdrop-blur-md z-10 border-b border-neutral-800">
                <div className="text-5xl font-bold tracking-tighter">Tidol <span className="text-blue-500">TV</span></div>
                <nav className="flex gap-6">
                    {navItems.map((item) => (
                        <button
                            key={item.label}
                            onClick={() => navigate(item.path)}
                            className={`text-3xl px-8 py-4 rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-white focus:scale-105 ${
                                location.pathname === item.path 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-neutral-800 text-neutral-300 focus:text-white focus:bg-blue-600'
                            }`}
                            tabIndex={0}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto pb-40 px-12 pt-8" style={{ scrollbarWidth: 'none' }}>
                <Outlet />
            </main>

            {/* Mini Player TV */}
            {currentTrack && (
                <div className="fixed bottom-0 left-0 right-0 h-32 bg-neutral-900 border-t border-neutral-800 flex items-center px-12 justify-between z-20">
                    <div className="flex items-center gap-6 overflow-hidden max-w-2xl">
                        <img 
                            src={currentTrack.coverArtUrl || currentTrack.artworkUrl || currentTrack.attributes?.artwork?.url || '/default-album.png'} 
                            className="w-24 h-24 rounded-lg object-cover" 
                            alt="Cover"
                        />
                        <div className="flex flex-col justify-center">
                            <h4 className="text-3xl font-bold truncate text-white">{currentTrack.trackName || currentTrack.title || currentTrack.attributes?.name || 'Unknown'}</h4>
                            <p className="text-2xl text-neutral-400 truncate">{currentTrack.artistName || currentTrack.artist || currentTrack.attributes?.artistName || 'Unknown'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
                        <button tabIndex={0} onClick={previousSong} className="p-4 rounded-full focus:outline-none focus:ring-4 focus:ring-white focus:bg-neutral-800 transition-all">
                            <SkipBack size={48} />
                        </button>
                        <button tabIndex={0} onClick={togglePlayPause} className="p-6 rounded-full bg-white text-black focus:outline-none focus:ring-4 focus:ring-blue-500 focus:scale-110 transition-all">
                            {isPlaying ? <Pause size={48} /> : <Play size={48} className="ml-2" />}
                        </button>
                        <button tabIndex={0} onClick={() => nextSong()} className="p-4 rounded-full focus:outline-none focus:ring-4 focus:ring-white focus:bg-neutral-800 transition-all">
                            <SkipForward size={48} />
                        </button>
                        <button tabIndex={0} onClick={() => setIsFullScreenOpen(true)} className="p-4 ml-8 rounded-full focus:outline-none focus:ring-4 focus:ring-white focus:bg-neutral-800 transition-all">
                            <Maximize2 size={40} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
