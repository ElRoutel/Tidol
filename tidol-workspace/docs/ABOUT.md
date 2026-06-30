# About Tidol

## What is Tidol?

Tidol is a **music search aggregator** — a unified search engine that helps you discover and listen to music across multiple platforms from a single, beautiful interface.

Think of Tidol like a search engine for music: we don't host the content, we help you find it and listen to it through the official platforms that do.

## How It Works

1. **You search** for an artist, song, or album.
2. **Tidol searches** across multiple platforms simultaneously using their official APIs:
   - YouTube (via YouTube Data API v3)
   - Spotify (via Spotify Web API)
   - SoundCloud (via SoundCloud API)
   - Internet Archive (for CC-licensed and public domain music)
   - MusicBrainz (for comprehensive music metadata)
3. **Results are displayed** in Tidol's glassmorphism UI with rich metadata and album art.
4. **You listen** through the platform's official embed player, or open the track on the platform's website/app.

## What Makes Tidol Different

- **Multi-platform search:** Find music across YouTube, Spotify, SoundCloud, and Internet Archive in one search.
- **Beautiful UI:** Our signature glassmorphism design adapts to album art colors for an immersive experience.
- **Personal library:** Build playlists, track your listening history, and get personalized recommendations — all powered by MusicBrainz's open music database.
- **Legal and transparent:** We use only official, documented APIs. No scraping, no unauthorized downloads, no grey areas.
- **Free CC/PD music:** Discover hidden gems in Internet Archive's vast collection of Creative Commons and public domain music, including live concert recordings and vintage 78rpm records.

## What Tidol Does NOT Do

- We do **not** download or store copyrighted audio files.
- We do **not** circumvent DRM or platform restrictions.
- We do **not** proxy or re-stream copyrighted content.
- We do **not** offer offline playback of copyrighted music.

## Our Technology

- **Backend:** Rust (Axum web framework) — fast, safe, and efficient.
- **Frontend:** React with our custom glassmorphism design system.
- **Database:** MusicBrainz for music metadata, MariaDB for user data.
- **Caching:** Intelligent caching to minimize API calls and respect rate limits.

## Internet Archive: Legal Streaming

Internet Archive content streamed through Tidol comes exclusively from collections with legal licenses:

- **Live Music Archive (etree):** Concert recordings shared with artists' permission under taper-friendly policies.
- **78rpm and Cylinder Recordings:** Historical recordings in the public domain.
- **Open Source Audio:** Music released under open-source licenses.
- **Netlabels:** Music from independent labels that release under Creative Commons.

All Internet Archive content is verified to have Creative Commons or public domain licensing before being made available through Tidol.

## Contact

- General: hello@tidol.app
- Legal: legal@tidol.app
- DMCA: dmca@tidol.app
