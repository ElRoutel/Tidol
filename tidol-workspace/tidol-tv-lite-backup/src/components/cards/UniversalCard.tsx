// src/components/cards/UniversalCard.tsx
import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../context/PlayerContext';
import { useContextMenu } from '../../context/ContextMenuContext';
import { IoPlaySharp } from 'react-icons/io5';
import { FaEllipsisH } from 'react-icons/fa';
import { UnifiedTrack } from '../../types/music';
import api from '../../api/axiosConfig';

interface UniversalCardProps {
    data: any; // Ideally this is already a UnifiedTrack or something Mappable
    type?: 'song' | 'album' | 'artist' | 'playlist';
    variant?: 'shelf' | 'grid' | 'list' | 'compact' | 'hero';
    onPlay?: (track: UnifiedTrack) => void;
    index?: number;
    children?: React.ReactNode;
}

/**
 * UniversalCard Component
 * Refactored to strictly follow the UnifiedTrack contract but remaining flexible for legacy data.
 */
const UniversalCard: React.FC<UniversalCardProps> = ({
    data,
    type = 'song',
    variant = 'shelf',
    onPlay
}) => {
    const { currentTrack } = usePlayer();
    const { openContextMenu } = useContextMenu();
    const navigate = useNavigate();

    // Map data to UnifiedTrack if it's not already (best effort)
    const track = useMemo<UnifiedTrack>(() => {
        // If it follows the new structure (checking for top-level camelCase properties)
        if (data.trackName && data.trackId) {
            return data as UnifiedTrack;
        }

        // Legacy fallback mapping to top-level UnifiedTrack properties
        return {
            trackId: data.id || data.identifier || data.trackId || 'unknown',
            trackName: data.title || data.titulo || data.name || data.trackName || 'Unknown',
            artistName: data.artist || data.artista || data.creator || data.artistName || 'Unknown',
            coverArtUrl: data.portada || data.cover_url || data.artworkUrl || data.coverArtUrl || '',
            sourceType: data.source || data.sourceType || 'local',
            playbackUrl: data.url || data.streamUrl || data.playbackUrl || '',
            albumName: data.album || data.albumName,
            durationInSeconds: data.duracion || data.duration || data.durationInSeconds || 0,
        };
    }, [data]);

    const isCurrent = useMemo(() => {
        return currentTrack?.trackId === track.trackId || currentTrack?.id === track.trackId;
    }, [currentTrack, track.trackId]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();

        if (type === 'song') {
            if (onPlay) onPlay(track);
            return;
        }

        // Navigation logic for other types
        if (type === 'album') {
            const isIA = track.sourceType === 'internet-archive' || !!(data.identifier) || (typeof track.trackId === 'string' && track.trackId.startsWith('ia_'));
            let targetId = track.trackId;

            if (isIA && typeof targetId === 'string' && targetId.startsWith('ia_')) {
                // Remove the 'ia_' prefix for the URL if necessary
                targetId = targetId.replace('ia_', '');
            }

            // [FIX] If it's explicitly an album/collection type from IA, we MUST navigate
            if (isIA) {
                navigate(`/ia-album/${targetId}`);
            } else {
                navigate(`/album/${targetId}`);
            }
        } else if (type === 'artist') {
            navigate(`/artist/${track.trackId}`);
        } else if (type === 'playlist') {
            navigate(`/playlist/${track.trackId}`);
        }
    }, [type, onPlay, track, navigate, data.identifier]);

    const handlePlay = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (onPlay) {
            onPlay(track);
        }
    }, [onPlay, track]);

    const handleMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e, type as any, track);
    }, [openContextMenu, type, track]);

    // Render Helpers
    if (variant === 'shelf') {
        return (
            <div
                className={`group relative flex-shrink-0 w-36 md:w-48 flex flex-col gap-3 cursor-pointer ${type}-item`}
                onClick={handleClick}
                onContextMenu={handleMenu}
            >
                <div className={`relative aspect-square w-full ${type === 'artist' ? 'rounded-full' : 'rounded-xl'} overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl`}>
                    <img
                        src={track.coverArtUrl || '/default-artwork.png'}
                        alt={track.trackName}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/default-album.png';
                            if (type === 'album' && track.id) {
                                api.post(`/api/v1/albums/${track.id}/report-cover-404`).catch(() => {});
                            }
                        }}
                        className={`w-full h-full object-cover ${type === 'artist' ? 'rounded-full' : ''}`}
                    />

                    {(type === 'song' || type === 'album') && !isCurrent && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                                className="w-12 h-12 rounded-full bg-primary text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform hover:bg-primary-hover"
                                onClick={handlePlay}
                            >
                                <IoPlaySharp size={24} className="ml-1" />
                            </button>
                        </div>
                    )}

                    <button
                        className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                        onClick={handleMenu}
                    >
                        <FaEllipsisH size={14} />
                    </button>
                </div>

                <div className="flex flex-col gap-1 mt-1">
                    <h3 className="text-sm font-bold text-white truncate">{track.trackName}</h3>
                    <p className="text-xs text-text-secondary truncate">{track.artistName}</p>
                </div>
            </div>
        );
    }

    // Default to simplest list view or other variants
    return (
        <div
            className={`flex items-center gap-4 p-2 rounded-md hover:bg-white/5 cursor-pointer ${isCurrent ? 'bg-white/10' : ''}`}
            onClick={handleClick}
        >
            <img
                src={track.coverArtUrl || '/default-artwork.png'}
                alt={track.trackName}
                onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/default-album.png';
                    if (type === 'album' && track.id) {
                        api.post(`/api/v1/albums/${track.id}/report-cover-404`).catch(() => {});
                    }
                }}
                className={`w-12 h-12 object-cover ${type === 'artist' ? 'rounded-full' : 'rounded-md'}`}
            />
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium truncate text-white">{track.trackName}</h4>
                <p className="text-xs text-gray-400 truncate">{track.artistName}</p>
            </div>
        </div>
    );
};

export default React.memo(UniversalCard);
