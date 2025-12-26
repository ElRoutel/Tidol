// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axiosConfig';

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
          const res = await api.get('/auth/validate');
          setUser(res.data);
        } catch (err) {
          console.error("Token validation failed:", err);
          logout();
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    validateToken();
  }, [token]);

  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/login', { username, password });

      const { token: newToken, username: userName, role, redirectPage } = res.data;

      setToken(newToken);
      setUser({ username: userName, role });
      localStorage.setItem('token', newToken);

      setLoading(false);
      return { success: true, redirectPage };

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

  const register = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/register', { username, password });
      setLoading(false);
      return { success: true };

    } catch (err) {
      const message = err.response?.data?.message || "Error en el registro";
      setError(message);
      setLoading(false);
      return { success: false, error: message };
    }
  };

  return (
    <AuthContext.Provider value={{
      token,
      user,
      loading,
      error,
      isAuthenticated: !!user,
      login,
      logout,
      register
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return context;
}
