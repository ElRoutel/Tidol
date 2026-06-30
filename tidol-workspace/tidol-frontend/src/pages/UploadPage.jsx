import React, { useState, useEffect } from 'react';
import api from '../api/axiosConfig'; 
import { useAuth } from '../context/AuthContext';
import '../styles/glass.css';
import './upload.css';

export function UploadPage() {
  const [songFiles, setSongFiles] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [lyricsFiles, setLyricsFiles] = useState(null);
  const [albumName, setAlbumName] = useState('');
  const [status, setStatus] = useState('');
  const [uploadedSongs, setUploadedSongs] = useState([]);
  const [existingAlbums, setExistingAlbums] = useState([]);
  
  const { token } = useAuth();

  useEffect(() => {
    const fetchAlbums = async () => {
      try {
        const response = await api.get('/albumes');
        setExistingAlbums(response.data);
      } catch (error) {
        console.error('Error fetching albums:', error);
      }
    };

    fetchAlbums();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Subiendo...');
    setUploadedSongs([]);

    if (!songFiles || songFiles.length === 0) {
      setStatus('❌ Selecciona al menos una canción');
      return;
    }

    // Validación de álbumes duplicados corregida
    if (existingAlbums.some(album => album.titulo?.toLowerCase() === albumName.toLowerCase())) {
      setStatus('❌ El álbum ya existe.');
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < songFiles.length; i++) {
      formData.append("song", songFiles[i]);
    }
    if (coverFile) formData.append("coverFile", coverFile);
    if (albumName) formData.append("albumName", albumName);

    if (lyricsFiles) {
      for (let i = 0; i < lyricsFiles.length; i++) {
        formData.append("lyrics", lyricsFiles[i]);
      }
    }

    try {
      const res = await api.post("/uploads/musica", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
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
        setLyricsFiles(null);
        e.target.reset(); 
        setUploadedSongs(data.canciones || []);
        
        // Actualizar lista de álbumes después de subir
        const response = await api.get('/albumes');
        setExistingAlbums(response.data);
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Error al subir canciones. Revisa la consola.");
    }
  };

  return (
    <section className="music-upload-container">
      <h2 className="music-upload-title">Subir Canciones/Álbumes</h2>
      
      <form className="music-upload-form glass-card" onSubmit={handleSubmit}>
        <input 
          type="file" 
          className="music-upload-input-file music-upload-songs-input"
          name="song" 
          multiple 
          accept=".mp3,.wav,.ogg,.flac,.alac" 
          onChange={(e) => setSongFiles(e.target.files)} 
          required 
        />
        
        <input 
          type="file" 
          className="music-upload-input-file music-upload-cover-input"
          name="coverFile" 
          accept="image/*" 
          onChange={(e) => setCoverFile(e.target.files[0])}
        />
        
        {/* <input 
          type="file" 
          className="music-upload-input-file music-upload-lyrics-input"
          name="lyrics" 
          multiple 
          accept=".lrc" 
          onChange={(e) => setLyricsFiles(e.target.files)}
        /> */}
        
        <input 
          type="text" 
          className="music-upload-input-text music-upload-album-input"
          name="albumName" 
          placeholder="Nombre del álbum" 
          value={albumName}
          onChange={(e) => setAlbumName(e.target.value)}
          required 
        />
        
        <button type="submit" className="music-upload-submit-btn">
          Subir
        </button>
      </form>
      
      <p className="music-upload-status glass-card">{status}</p>

      <div className="music-upload-songs-grid">
        {uploadedSongs.map(song => (
          <div key={song.id} className="music-upload-song-card glass-card">
            <strong className="music-upload-song-title">
              {song.titulo}
            </strong>
            <span className="music-upload-song-artist">
              {song.artista} ({song.album})
            </span>
            <small className="music-upload-song-quality">
              Calidad: {song.bitDepth}-bit {song.sampleRate/1000} kHz
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}