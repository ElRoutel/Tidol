import { memo } from 'react';

interface SpotifyEmbedProps {
    trackId: string;
    className?: string;
    compact?: boolean;
}

/**
 * Spotify embed iframe. The Spotify embed comes with its own playback controls.
 * We can't control it programmatically (Spotify's embed doesn't expose a JS API
 * for external control), but it provides a fully legal listening experience.
 */
const SpotifyEmbed = memo(({ trackId, className, compact = false }: SpotifyEmbedProps) => {
    const height = compact ? 80 : 352;
    const embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;

    return (
        <iframe
            src={embedUrl}
            width="100%"
            height={height}
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className={className}
            style={{
                borderRadius: '12px',
                border: 'none',
            }}
            title={`Spotify: ${trackId}`}
        />
    );
});

SpotifyEmbed.displayName = 'SpotifyEmbed';
export default SpotifyEmbed;
