// src/pages/UploadPage.jsx
import React, { useState } from 'react';
import api from '../api/axiosConfig'; 
import { useAuth } from '../context/AuthContext';

export function UploadPage() {
  const [songFiles, setSongFiles] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [albumName, setAlbumName] = useState('');
  const [status, setStatus] = useState('');
  const [uploadedSongs, setUploadedSongs] = useState([]);
  
  const { token } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Subiendo...');
    setUploadedSongs([]);

    if (!songFiles || songFiles.length === 0) {
      setStatus('❌ Selecciona al menos una canción');
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < songFiles.length; i++) {
      formData.append("song", songFiles[i]);
    }
    if (coverFile) formData.append("coverFile", coverFile);
    if (albumName) formData.append("albumName", albumName);

    try {
      // ----- ¡RUTA CORREGIDA! -----
      const res = await api.post("/api/uploads/musica", formData, {
      // ------------------------------
        headers: {
          'Content-Type': 'multipart/form-data',
          // 'x-token' ya no es necesario aquí, el interceptor 'api' lo añade
        }
      });

      const data = res.data;
      if (data.error) {
        setStatus(`❌ ${data.error}`);
      } else {
        setStatus(`✅ ${data.message}`);
        setAlbumName('');
        setSongFiles(null);
        setCoverFile(null);
        e.target.reset(); 
        setUploadedSongs(data.canciones || []);
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Error al subir canciones. Revisa la consola.");
    }
  };

  return (
    <section id="uploadSection">
      <h2>Subir Canciones/Álbumes</h2>
      {/* ... (Tu JSX para el formulario es perfecto y no necesita cambios) ... */}
      <form id="uploadForm" onSubmit={handleSubmit}>
        <input 
          type="file" 
          id="songFile" 
          name="song" 
          multiple 
          accept=".mp3,.wav,.ogg,.flac,.alac" 
          onChange={(e) => setSongFiles(e.target.files)} 
          required 
        />
        <input 
          type="file" 
          id="coverFile" 
          name="coverFile" 
          accept="image/*" 
          onChange={(e) => setCoverFile(e.target.files[0])}
        />
        <input 
          type="text" 
          id="albumName" 
          name="albumName" 
          placeholder="Nombre del álbum" 
          value={albumName}
          onChange={(e) => setAlbumName(e.target.value)}
          required 
        />
        <button type="submit">Subir</button>
      </form>
      <p id="uploadStatus">{status}</p>

      <div id="uploadedSongs">
        {uploadedSongs.map(song => (
          <div key={song.id} className="song-info">
            <strong>{song.titulo}</strong> - {song.artista} ({song.album})<br/>
            <small>Calidad: {song.bitDepth}-bit {song.sampleRate/1000} kHz</small>
          </div>
        ))}
      </div>
    </section>
  );
}