// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axiosConfig'; // ¡Correcto!

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const validateToken = async () => {
      if (token) {
        try {
          // ***** CORRECCIÓN AQUÍ *****
          // La ruta es /api/auth/validate
          const res = await api.get('/api/auth/validate');
          setUser(res.data);
        } catch (err) {
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    validateToken();
  }, [token]);

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      // ***** CORRECCIÓN AQUÍ *****
      // La ruta es /api/auth/login
      const res = await api.post('/api/auth/login', { username, password });
      
      const { token, username: userName, role, redirectPage } = res.data;
      
      setToken(token);
      setUser({ username: userName, role });
      localStorage.setItem('token', token);
      
      setLoading(false);
      return { success: true, redirectPage: redirectPage };

    } catch (err) {
      const message = err.response?.data?.message || "Error al iniciar sesión";
      setError(message);
      setLoading(false);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  const value = {
    token,
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}