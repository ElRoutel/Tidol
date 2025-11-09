// src/pages/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function ProfilePage() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      return navigate("/login");
    }

    fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("No autorizado");
        }
        const data = await res.json();
        setUser(data);
      })
      .catch(() => {
        localStorage.removeItem("token");
        navigate("/login");
      });
  }, [navigate]);

  if (!user) {
    return (
      <div className="p-8 text-text">
        <p>Cargando perfil...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-text">Bienvenido, {user.username}</h1>
      <p className="text-text-subdued">Correo: {user.email}</p>
      <p className="text-text-subdued">Usuario ID: {user.id}</p>

      <button
        onClick={() => {
          localStorage.removeItem("token");
          navigate("/login");
        }}
        className="mt-6 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
      >
        Cerrar sesión
      </button>
    </div>
  );
}

export default ProfilePage;
