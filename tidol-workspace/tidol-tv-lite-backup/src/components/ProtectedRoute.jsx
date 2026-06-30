// src/components/ProtectedRoute.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // Muestra un "cargando" mientras se valida el token de localStorage
    return <h1>Cargando sesión...</h1>;
  }

  if (!isAuthenticated) {
    // Si no está autenticado, redirige a /login
    return <Navigate to="/login" replace />;
  }

  // Si está autenticado, muestra el contenido (el "children")
  return children;
}