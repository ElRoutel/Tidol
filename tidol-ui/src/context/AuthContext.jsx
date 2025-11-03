// src/context/AuthContext.jsx
import React, { createContext, useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// 1. Define la URL de tu API
const API_URL = 'http://localhost:3000';

// 2. Crea el Contexto
const AuthContext = createContext();

// 3. Crea el "Proveedor" (el componente que manejará la lógica)
export function AuthProvider({ children }) {
  // Guarda el token y el usuario en el estado de React
  // Intenta leer el token guardado en el navegador (para "Recordar sesión")
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null); // Aquí guardaremos { username, role }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Hook para redirigir al usuario
  const navigate = useNavigate();

  // 4. Función de Login
  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      // Llama a tu endpoint /login del backend
      const response = await axios.post(`${API_URL}/login`, { username, password });

      const { token, role, redirectPage } = response.data;

      // 5. ¡Éxito! Guarda todo
      setToken(token);
      setUser({ username, role });
      localStorage.setItem('token', token); // Guarda el token en el navegador

      // Redirige a la página que dijo el backend (o a la home)
      navigate(redirectPage || '/');
      
    } catch (err) {
      console.error("Error en login:", err.response?.data?.message || err.message);
      setError(err.response?.data?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  // 6. Función de Logout
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    navigate('/login');
  };

  // 7. Expone las funciones y variables al resto de la app
  const value = {
    token,
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!token // Un booleano simple para saber si está logueado
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 8. Un "hook" personalizado para usar el contexto fácilmente
export function useAuth() {
  return useContext(AuthContext);
}
