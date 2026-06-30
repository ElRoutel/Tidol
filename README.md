# Tidol Frontend

[Leer en Español](README.es.md)

Frontend application for the Tidol music streaming service. Built with React, TypeScript, and Vite, featuring glassmorphism design patterns, media carousels, and responsive layouts.

## Features

- Modern, responsive web interface
- Glassmorphism design aesthetics
- Interactive media carousels and playlists
- Smart image fallback and automatic cover art reporting for missing assets

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
