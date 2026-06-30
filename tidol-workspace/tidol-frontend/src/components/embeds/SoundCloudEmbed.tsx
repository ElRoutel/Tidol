import { memo } from 'react';

interface SoundCloudEmbedProps {
    trackId: string;
    className?: string;
    compact?: boolean;
}

/**
 * SoundCloud embed iframe using the official SoundCloud Widget.
 * Like Spotify, the embed provides its own playback controls.
 * The SoundCloud Widget API exists for programmatic control if needed.
 */
const SoundCloudEmbed = memo(({ trackId, className, compact = false }: SoundCloudEmbedProps) => {
    const height = compact ? 166 : 300;
    const embedUrl = `https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/${trackId}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=${!compact}`;

    return (
        <iframe
            width="100%"
            height={height}
            scrolling="no"
            frameBorder="no"
            allow="autoplay"
            src={embedUrl}
            className={className}
            style={{
                borderRadius: '12px',
                border: 'none',
            }}
            title={`SoundCloud: ${trackId}`}
        />
    );
});

SoundCloudEmbed.displayName = 'SoundCloudEmbed';
export default SoundCloudEmbed;
