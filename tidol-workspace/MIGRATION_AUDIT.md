# Tidol Legal Migration Audit

**Generated:** 2026-06-29  
**Purpose:** Identify all code that downloads, streams, or proxies copyrighted audio for removal/replacement with legal alternatives (official API embeds).

---

## 1. Files Containing yt-dlp / YouTube Scraping / Direct Audio Download References

### Direct yt-dlp Usage
| File | Lines | Description |
|------|-------|-------------|
| `tidol-core/src/providers/ytdlp.rs` | Full file (1-92) | **PRIMARY OFFENDER** — Shells out to `python3 -m yt_dlp` to resolve direct audio stream URLs. Uses `--get-url`, `--bestaudio`, cookies, PO token provider, proxy rotation. |
| `tidol-core/Cargo.toml` | L17 | Depends on `rusty_ytdl = "0.7.1"` (Rust yt-dlp bindings, currently unused but present). |
| `tidol-core/Dockerfile` | L41-42 | Runtime image installs `python3`, `pip`, `ffmpeg`, `nodejs`, and `pip install yt-dlp[default] yt-dlp-ejs bgutil-ytdlp-pot-provider`. |
| `tidol-core/src/providers/mod.rs` | L9 | `pub mod ytdlp;` — module declaration. |
| `tidol-core/src/main.rs` | L1798 | `Box::new(providers::ytdlp::YtDlpProvider::new(...))` — instantiation in audio_providers vec. |

### YouTube Scraping via Piped (Unofficial YouTube Frontend)
| File | Lines | Description |
|------|-------|-------------|
| `tidol-core/src/providers/piped.rs` | Full file (1-152) | Queries Piped API instances (`pipedapi.tokhmi.xyz`, etc.) to search YouTube and extract raw audio stream URLs from `/streams/{videoId}`. Gets `audioStreams[].url` directly. |
| `tidol-core/src/main.rs` | L1784-1787 | `PipedProvider::new(...)` instantiated with proxy rotator. |

### YouTube Scraping via Invidious (Unofficial YouTube Frontend)
| File | Lines | Description |
|------|-------|-------------|
| `tidol-core/src/providers/invidious.rs` | Full file (1-158) | Queries Invidious API instances to search YouTube, then extracts raw `adaptiveFormats[].url` audio stream URLs. |
| `tidol-core/src/main.rs` | L1789-1791 | `InvidiousProvider::new(...)` instantiated. |

### Deezer Decryption (Unauthorized Stream Decryption)
| File | Lines | Description |
|------|-------|-------------|
| `tidol-core/src/providers/deezer.rs` | Full file (1-395) | Implements Deezer session hijacking via ARL cookie, calls `song.getData` GW endpoint, obtains encrypted FLAC streams, **performs Blowfish CBC decryption** on-the-fly and serves raw audio. |
| `tidol-core/src/main.rs` | L1800-1808 | `DeezerProvider::new(deezer_arl)` instantiated. |
| `tidol-core/src/main.rs` | L1899-1901 | `/api/v1/internal/deezer_decrypt/:id` endpoint registered. |

### SoundCloud (OAuth Stream Resolution)
| File | Lines | Description |
|------|-------|-------------|
| `tidol-core/src/providers/soundcloud.rs` | Full file (1-142) | Uses private SoundCloud API (`api-v2.soundcloud.com`) with OAuth token to resolve progressive audio stream URLs. |
| `tidol-core/src/main.rs` | L1821-1828 | `SoundCloudProvider::new(sc_oauth, ...)` instantiated. |

### Spotify (Preview URL Extraction + Unused librespot)
| File | Lines | Description |
|------|-------|-------------|
| `tidol-core/src/providers/spotify.rs` | Full file (1-196) | Uses Spotify Web API (official) but resolves `preview_url` for direct audio streaming. Also has stub `spotify_stream_handler` for librespot streaming. |
| `tidol-core/Cargo.toml` | L39-41 | `librespot-core`, `librespot-metadata`, `librespot-audio` dependencies (for unauthorized Spotify stream decryption). |
| `tidol-core/src/main.rs` | L1903-1905 | `/api/v1/internal/spotify_stream/:id` endpoint registered. |

---

## 2. Backend Endpoints That Serve/Proxy Audio

| Endpoint | Method | File:Line | Description | Legal? |
|----------|--------|-----------|-------------|--------|
| `/api/v1/stream/:mbid` | GET | `main.rs:1892` | **Main streaming endpoint.** Resolves track via orchestrator, checks local files (premium/provisional audio), then proxies from external source via reqwest. Serves `audio/*` content-types. | **NO** — Proxies copyrighted audio |
| `/api/v1/internal/deezer_decrypt/:id` | GET | `main.rs:1899` | Decrypts Deezer FLAC streams with Blowfish and serves raw audio. | **NO** — Unauthorized decryption |
| `/api/v1/internal/spotify_stream/:id` | GET | `main.rs:1903` | Stub for librespot streaming (returns NOT_IMPLEMENTED). | **NO** — Intended for unauthorized streaming |
| `/api/v1/playlists/:id/m3u` | GET | `main.rs:1894` | Generates M3U playlists pointing to `/api/v1/stream/` URLs. | **NO** — References illegal stream endpoint |
| `/api/v1/radio/m3u` | GET | `main.rs:1895` | Radio M3U pointing to stream endpoint. | **NO** |
| `/api/v1/search/m3u` | GET | `main.rs:1896` | Search results as M3U. | **NO** |
| `/api/v1/albums/:mbid/m3u` | GET | `main.rs:1897` | Album M3U. | **NO** |
| `/api/v1/queue/events/:track_id` | GET | `main.rs:1914` | SSE for audio processing queue status. | Neutral — remove processing queue |
| `/api/v1/lyrics/:track_id` | GET | `main.rs:1893` | Fetches lyrics from LRCLIB. | **YES** — Legal API |
| `/api/v1/covers/:mbid` | GET | `main.rs:1907` | Serves cover art. | **YES** — Metadata |

---

## 3. React Components Using `<audio>` or Backend Audio Streams

| Component | File | Description |
|-----------|------|-------------|
| `TidolAudioEngine.ts` | `src/engine/TidolAudioEngine.ts` | **Core audio engine.** Creates dual `HTMLAudioElement` (A/B) for crossfade. `resolveStreamUrl()` at L237 constructs `/api/v1/stream/${trackId}` URL. All playback goes through this. |
| `PlayerContext.tsx` | `src/context/PlayerContext.tsx` | Player state management. Instantiates `TidolAudioEngine`, calls `engine.playTrack()` which triggers stream resolution. |
| `FullScreenPlayer.jsx` | `src/components/FullScreenPlayer.jsx` | Full-screen player UI with glassmorphism. Uses `usePlayer()` context — doesn't directly reference audio sources. |
| `useVoxAudio.ts` | `src/hooks/useVoxAudio.ts` | VOX (stems separation) — references stem audio files at `/stems/` path. |
| `useSpectraSync.js` | `src/hooks/useSpectraSync.js` | Audio visualization — connects to audio element for frequency data. |
| `MiniWaveform.jsx` | `src/components/audio/MiniWaveform.jsx` | Waveform visualization component. |
| `WaveformCanvas.jsx` | `src/components/WaveformCanvas.jsx` | Canvas-based waveform renderer. |
| `useLazyCaching.ts` | `src/hooks/useLazyCaching.ts` | Lazy loading/caching hook. |

### Key Flow:
```
UniversalCard/AlbumCard → PlayerContext.playSongList() 
  → TidolAudioEngine.playTrack() 
    → resolveStreamUrl() → `/api/v1/stream/${trackId}`
      → HTMLAudioElement.src = streamUrl
```

---

## 4. Current Provider Trait/Interface Structure

### Trait Definition (`tidol-core/src/providers/provider_trait.rs`)
```rust
#[async_trait]
pub trait AudioProvider: Send + Sync {
    fn name(&self) -> &'static str;
    fn priority(&self) -> u8;                    // 1=highest, 6=lowest
    async fn resolve_stream_url(&self, artist: &str, title: &str) -> Result<String, String>;
    fn max_timeout(&self) -> Duration { Duration::from_millis(800) }
}
```

### Orchestrator (`tidol-core/src/providers/waterfall.rs`)
- `ProviderOrchestrator` holds `Vec<Box<dyn AudioProvider>>`
- `resolve_fastest()` uses 3-phase waterfall:
  - **Phase 1:** Priority 1-2 (serial) — Deezer, Spotify
  - **Phase 2:** Priority 3-4 (concurrent race) — SoundCloud, Piped, Invidious
  - **Phase 3:** Priority 5-6 (serial fallback) — yt-dlp, Archive

### Current Providers
| Provider | File | Priority | Method |
|----------|------|----------|--------|
| Deezer | `deezer.rs` | 1 | ARL session hijack + Blowfish decrypt |
| Spotify | `spotify.rs` | 2 | Official API but extracts preview_url for direct play |
| SoundCloud | `soundcloud.rs` | 3 | Private API v2 with OAuth token |
| Piped | `piped.rs` | 4 | Unofficial YouTube frontend scraping |
| Invidious | `invidious.rs` | 4 | Unofficial YouTube frontend scraping |
| yt-dlp | `ytdlp.rs` | 5 | Python subprocess for YouTube audio extraction |
| Archive | `archive.rs` | 6 | Stub (not implemented) |

### Plugin System (FFI `.so`)
- `provider-archive` (separate crate, FFI plugin)
- `provider-jamendo` (separate crate, FFI plugin)
- `provider-lyrics` (separate crate, FFI plugin)
- Loaded dynamically via `libloading` in `main.rs`

---

## 5. Additional Concerns

### Audio Processing Pipeline (main.rs L762-1066)
- `ai_worker_loop()` downloads audio files to `./storage/audio/`, processes with FFMPEG for Whisper transcription
- `audioProcessingQueue` table tracks download/processing status
- Local audio files stored at `premium_audio_path` / `provisional_audio_path` in DB

### librespot Dependencies (Cargo.toml)
- `librespot-core`, `librespot-metadata`, `librespot-audio` — designed for unauthorized Spotify stream decryption
- Currently has a stub endpoint but the dependency exists

### Docker Image Size
- Current runtime image includes: Python3, pip, ffmpeg, Node.js 22, yt-dlp ecosystem
- Estimated unnecessary overhead: ~500MB+

---

## 6. Migration Action Items

### REMOVE (Illegal/Unauthorized)
- [ ] `providers/ytdlp.rs` — Delete entirely
- [ ] `providers/piped.rs` — Delete entirely  
- [ ] `providers/invidious.rs` — Delete entirely
- [ ] `providers/deezer.rs` — Delete entirely (Blowfish decryption is unauthorized)
- [ ] `providers/soundcloud.rs` — Rewrite to use embed URLs only
- [ ] `/api/v1/stream/:mbid` endpoint — Remove audio proxying
- [ ] `/api/v1/internal/deezer_decrypt/:id` endpoint — Remove
- [ ] `/api/v1/internal/spotify_stream/:id` endpoint — Remove
- [ ] M3U endpoints referencing `/stream/` — Remove or redirect to embeds
- [ ] `ai_worker_loop()` audio download logic — Remove
- [ ] `rusty_ytdl` dependency — Remove from Cargo.toml
- [ ] `librespot-*` dependencies — Remove from Cargo.toml
- [ ] `blowfish`, `cipher`, `block-padding` dependencies — Remove (only used by Deezer decrypt)
- [ ] Dockerfile: Remove Python, pip, ffmpeg, Node.js, yt-dlp installation
- [ ] Local audio storage (`./storage/audio/`) — Remove

### REWRITE (To Legal Alternatives)
- [ ] `providers/spotify.rs` → Official Web API, embed URLs, preview_url (30s legal)
- [ ] `providers/archive.rs` → Legal collections only (etree, 78rpm, CC), direct streaming IS legal
- [ ] New `providers/youtube.rs` → YouTube Data API v3, embed URLs only
- [ ] `TidolAudioEngine.ts` → Platform-specific embed components instead of `<audio>`
- [ ] `provider_trait.rs` → New trait with `resolve()` returning `EmbedInfo`
- [ ] `waterfall.rs` → Update orchestrator for new trait

### KEEP (Legal)
- [ ] `/api/v1/lyrics/:track_id` — LRCLIB is a legal API
- [ ] `/api/v1/covers/:mbid` — Metadata is legal
- [ ] `/api/v1/search/:query` — MusicBrainz catalog search is legal
- [ ] All auth, playlist, history, library endpoints — User data management
- [ ] Plugin system (FFI) for provider-archive, provider-jamendo, provider-lyrics
