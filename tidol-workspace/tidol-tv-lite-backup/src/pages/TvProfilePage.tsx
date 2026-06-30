import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function TvProfilePage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="space-y-16 flex flex-col items-center pt-32">
            <div className="w-[400px] h-[400px] bg-blue-600 rounded-full flex items-center justify-center text-[180px] font-bold text-white shadow-2xl mb-12">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            
            <h1 className="text-[80px] font-extrabold">{user?.username || 'Usuario'}</h1>
            <p className="text-[40px] text-neutral-400">Plan: <span className="text-blue-400 capitalize">{user?.role || 'Gratis'}</span></p>

            <div className="mt-20">
                <button
                    tabIndex={0}
                    onClick={handleLogout}
                    className="text-4xl bg-red-600 hover:bg-red-500 text-white px-16 py-8 rounded-full font-bold focus:outline-none focus:ring-[8px] focus:ring-white focus:scale-110 transition-all shadow-xl"
                >
                    Cerrar Sesión
                </button>
            </div>
        </div>
    );
}
