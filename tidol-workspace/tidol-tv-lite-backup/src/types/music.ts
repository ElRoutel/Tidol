/**
 * Orígenes de datos soportados por Tidol.
 */
export type SourceType = 'local' | 'youtube' | 'spotify' | 'torrent' | 'internet-archive' | 'musicbrainz';

/**
 * Representación del arte de la canción, inspirada en MusicKit.
 * El campo `url` utiliza los placeholders {w} y {h} para redimensionado dinámico.
 */
export interface Artwork {
    url: string;
    width?: number;
    height?: number;
    bgColor?: string;
    textColor1?: string;
    textColor2?: string;
    textColor3?: string;
    textColor4?: string;
}

/**
 * Contrato Universal de Pista (UnifiedTrack).
 * Basado en el objeto Song de Apple MusicKit JS, optimizado para multisource.
 */
export interface UnifiedTrack {
    /** Contrato principal de datos (alineado con Rust Backend DTO) */
    trackId?: string;
    trackName?: string;
    artistName?: string;
    coverArtUrl?: string;

    // Optional legacy/internal properties
    albumName?: string;
    durationInSeconds?: number;
    genreNames?: string[];
    releaseDate?: string;
    trackNumber?: number;
    isLiked?: boolean;
    hasLyrics?: boolean;
    isCached?: boolean;
    
    // Legacy compatibility fields (deprecated)
    id?: string;
    title?: string;
    artist?: string;
    album?: string;
    artworkUrl?: string;
    image?: string;
    titulo?: string;
    artista?: string;
    portada?: string;

    /** Metadatos de infraestructura */
    sourceType: SourceType;

    /** URL de streaming o path local resuelto */
    playbackUrl?: string;

    /** Colores extraídos por Spectra */
    extractedColors?: {
        dominant: string;
        secondary?: string;
        accent?: string;
        lightVibrant?: string;
        darkMuted?: string;
    };

    /** Datos brutos específicos de la fuente (opcional, para depuración) */
    rawMetadata?: Record<string, any>;

    /** Backward compatibility wrapper */
    attributes?: {
        name?: string;
        artistName?: string;
        albumName?: string;
        artwork?: Artwork;
        durationInSeconds?: number;
        hasLyrics?: boolean;
        isLiked?: boolean;
        cue_in?: number;
        releaseDate?: string | null;
        trackNumber?: number;
    };
}

/**
 * Estado global del reproductor utilizando el nuevo contrato.
 */
export interface PlayerState {
    currentTrack: UnifiedTrack | null;
    queue: UnifiedTrack[];
    isPlaying: boolean;
    volume: number;
    progress: number;
    shuffle: boolean;
    repeatMode: 'none' | 'one' | 'all';
}
