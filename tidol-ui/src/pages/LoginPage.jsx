import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IoMusicalNotes, IoArrowForward } from 'react-icons/io5';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await login(username, password);
    if (result.success) {
      navigate(result.redirectPage || '/');
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Bienvenido de nuevo</h2>
        <p className="text-gray-400 text-sm">Ingresa tus credenciales para continuar</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Usuario</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
            placeholder="Tu nombre de usuario"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-4 w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
          ) : (
            <>
              Iniciar Sesión <IoArrowForward />
            </>
          )}
        </button>
      </form>

      <div className="text-center text-sm text-gray-400">
        ¿No tienes cuenta?{' '}
        <Link to="/register" className="text-white hover:underline font-medium">
          Regístrate
        </Link>
      </div>
    </div>
  );
}