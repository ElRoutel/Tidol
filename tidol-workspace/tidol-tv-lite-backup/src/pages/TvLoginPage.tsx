import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function TvLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const usernameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (usernameRef.current) {
            usernameRef.current.focus();
        }
    }, []);

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorMsg('');
        
        if (!username || !password) {
            setErrorMsg('Por favor ingresa usuario y contraseña');
            return;
        }

        const res = await login(username, password);
        if (res.success) {
            navigate('/');
        } else {
            setErrorMsg(res.error || 'Error al iniciar sesión');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, nextAction: 'focusPass' | 'submit') => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (nextAction === 'focusPass') {
                document.getElementById('tv-password-input')?.focus();
            } else if (nextAction === 'submit') {
                handleLogin();
            }
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white">
            <div className="w-[800px] bg-neutral-900 rounded-[48px] p-16 shadow-2xl flex flex-col items-center">
                <h1 className="text-7xl font-extrabold mb-4 text-center">Tidol <span className="text-blue-500">TV</span></h1>
                <p className="text-3xl text-neutral-400 mb-12 text-center">Inicia sesión con tu cuenta</p>

                {errorMsg && (
                    <div className="bg-red-500/20 text-red-500 text-3xl p-6 rounded-2xl mb-8 w-full text-center font-bold">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleLogin} className="w-full flex flex-col gap-8">
                    <input
                        ref={usernameRef}
                        type="text"
                        placeholder="Usuario"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'focusPass')}
                        className="w-full bg-neutral-800 text-4xl p-8 rounded-3xl focus:outline-none focus:ring-[6px] focus:ring-blue-500 transition-all placeholder-neutral-500"
                        tabIndex={0}
                    />

                    <input
                        id="tv-password-input"
                        type="password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, 'submit')}
                        className="w-full bg-neutral-800 text-4xl p-8 rounded-3xl focus:outline-none focus:ring-[6px] focus:ring-blue-500 transition-all placeholder-neutral-500"
                        tabIndex={0}
                    />

                    <button
                        type="submit"
                        className="w-full mt-8 bg-blue-600 hover:bg-blue-500 text-white text-4xl font-bold py-8 rounded-3xl focus:outline-none focus:ring-[6px] focus:ring-white focus:scale-105 transition-all shadow-lg"
                        tabIndex={0}
                    >
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    );
}
