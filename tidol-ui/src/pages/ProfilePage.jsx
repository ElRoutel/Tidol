// src/pages/ProfilePage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // 1. Importar el hook de autenticación

function ProfilePage() {
  const { user, logout } = useAuth(); // 2. Usar el contexto para obtener el usuario y la función de logout
  const navigate = useNavigate();

  const handleLogout = () => {
    logout(); // Llama a la función del contexto
    navigate("/login"); // Redirige al login
  };

  if (!user) {
    return (
      <div className="p-8 text-text">
        {/* El componente ProtectedRoute ya muestra "Cargando..." */}
        <p>No se pudo cargar el perfil del usuario.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-text">Bienvenido, {user.username}</h1>
      {/* El ID del usuario ya no se obtiene en el frontend, se puede añadir al endpoint /validate si se necesita */}
      <p className="text-text-subdued">Tipo de cuenta: {user.role || 'Usuario'}</p>
      <div>
        <p>
          Cambiar foto de perfil y otros ajustes próximamente.
        </p>
      </div>
      <button
        onClick={handleLogout}
        className="mt-6 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
      >
        Cerrar sesión
      </button>
    </div>
  );
}

export default ProfilePage;
