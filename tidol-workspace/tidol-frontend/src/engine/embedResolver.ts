// src/engine/embedResolver.ts
import api from '../api/axiosConfig';
import { UnifiedTrack } from '../types/music';

export type PlaybackMode = 'youtube' | 'archive';

export interface ResolvedPlayback {
    mode: PlaybackMode;
    /** YouTube videoId (mode === 'youtube') */
    videoId?: string;
    /** Direct legal audio URL (mode === 'archive': Internet Archive CC / blob / local) */
    audioUrl?: string;
}

/**
 * Canonicaliza el identificador de plataforma. El backend (serde snake_case)
 * emite `you_tube` para el enum `YouTube`; lo unificamos a `youtube`. También
 * acepta 'internet-archive' → 'internet_archive'.
 */
export function canonicalPlatform(raw?: string): string {
    const p = String(raw || '').replace(/-/g, '_').toLowerCase();
    return p === 'you_tube' ? 'youtube' : p;
}

function platformOf(track: UnifiedTrack): string {
    return canonicalPlatform(track.platform || track.sourceType);
}

/**
 * Devuelve una URL de audio directo LEGAL si la pista la tiene:
 *  - blob: local en memoria
 *  - stream CC/dominio público de Internet Archive
 *  - fichero subido por el propio usuario (`local`, p.ej. /api/stream/local/:id)
 * Ignora siempre el antiguo endpoint ilegal /api/v1/stream/.
 */
function directLegalAudio(track: UnifiedTrack): string | null {
    const platform = platformOf(track);
    if (track.playbackUrl?.startsWith('blob:')) return track.playbackUrl;

    const isLegacyStream = (u?: string) => !!u && u.includes('/api/v1/stream/');

    if (platform === 'internet_archive') {
        const u = track.previewUrl || track.playbackUrl;
        if (u && !isLegacyStream(u)) return u;
    }
    if (platform === 'local' && track.playbackUrl && !isLegacyStream(track.playbackUrl)) {
        return track.playbackUrl;
    }
    return null;
}

/**
 * Resuelve una pista a una fuente reproducible LEGAL.
 *
 * - Internet Archive / blob / local → audio nativo directo (`archive`).
 * - YouTube ya resuelto → reproduce ese videoId.
 * - Cualquier otra (MusicBrainz, radio, spotify, soundcloud) → busca una
 *   coincidencia en YouTube vía `/api/v1/embed/search` y reproduce el embed.
 *
 * NUNCA descarga ni proxea audio con derechos de autor: la reproducción de
 * YouTube ocurre dentro del IFrame oficial de YouTube.
 */
export async function resolvePlayback(track: UnifiedTrack): Promise<ResolvedPlayback> {
    const platform = platformOf(track);

    // 1. Audio directo legal (Internet Archive / blob)
    const direct = directLegalAudio(track);
    if (direct) {
        return { mode: 'archive', audioUrl: direct };
    }

    // 2. YouTube ya resuelto
    if (platform === 'youtube' && (track.videoId || track.id)) {
        return { mode: 'youtube', videoId: track.videoId || track.id! };
    }

    // 3. Resolver vía búsqueda de embeds a una coincidencia de YouTube
    const artist = track.artistName || track.artist || track.attributes?.artistName || '';
    const title = track.trackName || track.title || track.attributes?.name || '';
    const q = `${artist} ${title}`.trim();

    if (q) {
        try {
            const res = await api.get('/embed/search', { params: { q, limit: 5 } });
            const tracks: any[] = res.data?.tracks || [];
            const yt = tracks.find((t) => canonicalPlatform(t.platform) === 'youtube' && t.id);
            if (yt) return { mode: 'youtube', videoId: yt.id };
        } catch (err) {
            console.error('[embedResolver] Fallo al resolver embed:', err);
        }
    }

    throw new Error(`No se encontró una fuente reproducible legal para: ${q || track.id}`);
}
