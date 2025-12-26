import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IoCloudUploadOutline,
  IoMusicalNotes,
  IoImageOutline,
  IoCheckmarkCircle,
  IoAlertCircle,
  IoArrowBack,
  IoTrashOutline
} from "react-icons/io5";
import '../styles/glass.css';

export function UploadPage() {
  const [songFiles, setSongFiles] = useState([]);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [albumName, setAlbumName] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedSongs, setUploadedSongs] = useState([]);
  const [existingAlbums, setExistingAlbums] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const { user } = useAuth();

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

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files).filter(file =>
        file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|flac|alac)$/i)
      );
      if (files.length > 0) {
        setSongFiles(prev => [...prev, ...files]);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSongFiles(prev => [...prev, ...files]);
    }
  };

  const handleCoverChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setCoverPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeSong = (index) => {
    setSongFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    setStatus({ type: 'loading', message: 'Subiendo tus canciones...' });
    setUploadedSongs([]);

    if (songFiles.length === 0) {
      setStatus({ type: 'error', message: 'Selecciona al menos una canción' });
      setIsUploading(false);
      return;
    }

    if (existingAlbums.some(album => album.titulo?.toLowerCase() === albumName.trim().toLowerCase())) {
      setStatus({ type: 'error', message: 'El álbum ya existe.' });
      setIsUploading(false);
      return;
    }

    const formData = new FormData();
    songFiles.forEach(file => formData.append("song", file));
    if (coverFile) formData.append("coverFile", coverFile);
    if (albumName) formData.append("albumName", albumName.trim());

    try {
      const res = await api.post("/uploads/musica", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.error) {
        setStatus({ type: 'error', message: res.data.error });
      } else {
        setStatus({ type: 'success', message: res.data.message });
        setAlbumName('');
        setSongFiles([]);
        setCoverFile(null);
        setCoverPreview(null);
        setUploadedSongs(res.data.canciones || []);

        const response = await api.get('/albumes');
        setExistingAlbums(response.data);
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: "Error al subir canciones. Revisa la consola." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-8 flex flex-col items-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => window.history.back()} className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <IoArrowBack size={24} />
          </button>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter">
            Subir <span className="text-green-500">Música</span>
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Side */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleSubmit} className="glass-card p-6 md:p-8 space-y-8 rounded-3xl border border-white/5 shadow-2xl">

              {/* Drag & Drop Zone */}
              <div
                className={`relative group h-48 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-3 cursor-pointer
                  ${dragActive ? 'border-green-500 bg-green-500/10' : 'border-white/10 hover:border-white/30 bg-white/5'}
                  ${songFiles.length > 0 ? 'h-32' : 'h-48'}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".mp3,.wav,.ogg,.flac,.alac"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="p-3 rounded-full bg-white/5 text-green-500 group-hover:scale-110 transition-transform">
                  <IoCloudUploadOutline size={32} />
                </div>
                <div className="text-center px-4">
                  <p className="text-white font-bold text-lg">Arrastra tus canciones aquí</p>
                  <p className="text-white/40 text-sm">O haz click para buscar en tu dispositivo</p>
                </div>
              </div>

              {/* Selected Files List */}
              <AnimatePresence>
                {songFiles.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2"
                  >
                    {songFiles.map((file, idx) => (
                      <motion.div
                        key={`${file.name}-${idx}`}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 20, opacity: 0 }}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <IoMusicalNotes className="text-green-500 shrink-0" />
                          <span className="text-white text-sm truncate">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeSong(idx); }}
                          className="text-white/30 hover:text-red-500 transition-colors p-1"
                        >
                          <IoTrashOutline size={18} />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Metadata Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">Nombre del Álbum</label>
                  <input
                    type="text"
                    value={albumName}
                    onChange={(e) => setAlbumName(e.target.value)}
                    placeholder="Ej: Golden Hits Vol. 1"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-green-500/50 transition-colors shadow-inner"
                    required
                  />
                  <p className="text-[10px] text-white/30 px-1 font-medium">Se creará un nuevo álbum si no existe. El artista se extraerá de los metadatos de los archivos.</p>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">Portada del Álbum</label>
                  <label className="flex items-center gap-4 w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white hover:bg-white/10 cursor-pointer transition-all border-dashed">
                    <IoImageOutline className="text-green-500" size={20} />
                    <span className="text-sm text-white/60 truncate">{coverFile ? coverFile.name : 'Seleccionar imagen'}</span>
                    <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUploading || songFiles.length === 0}
                className={`w-full py-5 rounded-2xl font-black text-lg tracking-tight transition-all duration-300 shadow-xl flex items-center justify-center gap-3
                  ${isUploading ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-green-500 hover:bg-green-400 text-black hover:scale-[1.02] active:scale-[0.98]'}`}
              >
                {isUploading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-black/20 border-t-black rounded-full animate-spin" />
                    SUBIENDO...
                  </>
                ) : (
                  <>SUBIR A TIDOL</>
                )}
              </button>
            </form>

            {/* Status Message */}
            <AnimatePresence>
              {status.message && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={`p-4 rounded-2xl flex items-center gap-3 border shadow-lg ${status.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                      status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                        'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}
                >
                  {status.type === 'error' ? <IoAlertCircle size={22} /> : <IoCheckmarkCircle size={22} />}
                  <span className="font-bold">{status.message}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Preview Side */}
          <div className="space-y-6">
            <div className="glass-card p-6 rounded-3xl border border-white/5 sticky top-24">
              <h3 className="text-sm font-black text-white/40 uppercase tracking-widest mb-6">Vista Previa</h3>

              <div className="aspect-square w-full rounded-2xl bg-white/5 overflow-hidden shadow-2xl mb-6 flex items-center justify-center relative group">
                {coverPreview ? (
                  <img src={coverPreview} alt="Preview" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <div className="flex flex-col items-center text-white/20">
                    <IoImageOutline size={64} />
                    <p className="text-xs font-bold mt-2">SIN PORTADA</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="h-4 w-3/4 bg-white/10 rounded-full animate-pulse" />
                <div className="h-3 w-1/2 bg-white/5 rounded-full animate-pulse" />
                <div className="pt-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-white/30 uppercase">
                    <span>Archivos</span>
                    <span>{songFiles.length}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-white/30 uppercase">
                    <span>Peso aprox.</span>
                    <span>{(songFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Last Uploaded Songs */}
            {uploadedSongs.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-2">Recién subidas</h3>
                {uploadedSongs.map(song => (
                  <div key={song.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-1">
                    <span className="text-white text-sm font-bold truncate">{song.titulo}</span>
                    <span className="text-white/40 text-[10px]">{song.bitDepth}-bit · {song.sampleRate / 1000}kHz</span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
