import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { IoLogOutOutline, IoPersonCircleOutline, IoSettingsOutline } from "react-icons/io5";
import "../styles/glass.css";

function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) return null;

  return (
    <div className="p-8 pb-40 max-w-4xl mx-auto animate-fade-in">
      {/* Header Card */}
      <div className="glass-card p-8 rounded-3xl flex flex-col md:flex-row items-center gap-8 mb-8 relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-purple-900/20 to-blue-900/20 pointer-events-none" />

        {/* Avatar */}
        <div className="relative z-10 w-32 h-32 rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center shadow-2xl border-4 border-white/10">
          {user.profile_img ? (
            <img src={user.profile_img} alt={user.username} className="w-full h-full rounded-full object-cover" />
          ) : (
            <IoPersonCircleOutline className="text-6xl text-gray-400" />
          )}
        </div>

        {/* Info */}
        <div className="relative z-10 text-center md:text-left flex-1">
          <h1 className="text-4xl font-bold text-white mb-2">{user.username}</h1>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 border border-white/10 text-sm text-gray-300">
            {user.role === 'admin' ? 'Administrador' : 'Miembro Premium'}
          </div>
        </div>

        {/* Actions */}
        <div className="relative z-10 flex gap-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-medium transition-all hover:scale-105"
          >
            <IoLogOutOutline size={20} />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Settings Section (Placeholder) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl hover:bg-white/5 transition-colors cursor-pointer group">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-full bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
              <IoSettingsOutline size={24} />
            </div>
            <h3 className="text-xl font-semibold text-white">Configuración</h3>
          </div>
          <p className="text-gray-400 text-sm">Gestiona tus preferencias de cuenta y reproducción.</p>
        </div>

        {/* More sections can be added here */}
      </div>
    </div>
  );
}

export default ProfilePage;
