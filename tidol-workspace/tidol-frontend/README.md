# Tidol Frontend

[Leer en Español](README.es.md)

Frontend application for **Tidol**, a music search aggregator. Built with React, TypeScript, and Vite, featuring glassmorphism design patterns, media carousels, and responsive layouts.

## Features

- Modern, responsive web interface with glassmorphism design
- Multi-platform music search (YouTube, Spotify, SoundCloud, Internet Archive)
- Official embed players for each platform
- Interactive media carousels and playlists
- Smart image fallback and automatic cover art reporting for missing assets
- Personalized recommendations and listening history

## Legal: How Tidol Works

Tidol is a **search aggregator**, not a streaming service. Here's what that means:

- **We do NOT host copyrighted content.** All music is played through official platform embeds (YouTube, Spotify, SoundCloud) provided by the platforms themselves for sharing purposes.
- **We are a search engine** that aggregates results from multiple music platforms via their official, documented APIs.
- **We redirect to official platforms.** Every track links back to its original platform page.
- **Internet Archive content is legally streamed.** We only serve Internet Archive audio that is explicitly licensed under Creative Commons or is in the public domain (collections: etree, 78rpm, opensource_audio, netlabels).
- **No downloading, no proxying, no DRM circumvention.** Tidol never downloads, caches, or re-streams copyrighted audio.

For full details, see our [Terms of Service](../docs/TERMS_OF_SERVICE.md), [Privacy Policy](../docs/PRIVACY_POLICY.md), and [DMCA Policy](../docs/DMCA_POLICY.md).

## Development

To run the development server locally:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Build the production application:
   ```bash
   npm run build
   ```

## Production Deployment with Docker

You can build and run the frontend inside a Docker container:

1. Build the Docker image:
   ```bash
   docker build -t tidol-frontend:latest .
   ```

2. Run the Docker container:
   ```bash
   docker run -d -p 8080:80 tidol-frontend:latest
   ```

The application will be accessible at http://localhost:8080.
