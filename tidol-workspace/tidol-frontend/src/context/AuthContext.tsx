// src/context/AuthContext.tsx
import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import api from '../api/axiosConfig';

export interface User {
    username: string;
    role: string;
}

interface AuthContextType {
    token: string | null;      // backwards compatibility
    jwt_token: string | null;  // explicit
    device_id: string | null;  // explicit
    user: User | null;
    loading: boolean;
    error: string | null;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<{ success: boolean; redirectPage?: string; error?: string }>;
    logout: () => void;
    register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [deviceId, setDeviceId] = useState<string | null>(localStorage.getItem('device_id'));
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const validateToken = async () => {
            if (token) {
                try {
                    const res = await api.get('/auth/me');
                    if (res.data && res.data.username) {
                        setUser({ username: res.data.username, role: 'user' });
                        localStorage.setItem('username', res.data.username);
                    } else {
                        logout();
                    }
                } catch (err) {
                    // Solo un 401 prueba que el token es inválido. Ante un fallo de
                    // red (backend caído, timeout) cerrar sesión borraba el token y
                    // expulsaba al usuario por un corte pasajero.
                    const status = (err as { response?: { status?: number } })?.response?.status;
                    if (status === 401) {
                        logout();
                    } else {
                        const cached = localStorage.getItem('username');
                        if (cached) setUser({ username: cached, role: 'user' });
                    }
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        };
        validateToken();
    }, [token]);

    const getDeviceDetails = () => {
        const userAgent = navigator.userAgent;
        let deviceName = "Web Browser";
        
        if (userAgent.indexOf("Chrome") > -1) {
            deviceName = "Chrome Browser";
        } else if (userAgent.indexOf("Safari") > -1) {
            deviceName = "Safari Browser";
        } else if (userAgent.indexOf("Firefox") > -1) {
            deviceName = "Firefox Browser";
        }
        
        return {
            device_name: deviceName,
            device_type: "Web"
        };
    };

    const login = async (username: string, password: string) => {
        setLoading(true);
        setError(null);
        try {
            const { device_name, device_type } = getDeviceDetails();
            const res = await api.post('/auth/login', { 
                username, 
                password,
                device_name,
                device_type
            });

            const { token: newToken, username: userName, device_id: newDeviceId } = res.data;

            setToken(newToken);
            setDeviceId(newDeviceId);
            setUser({ username: userName, role: 'user' });
            
            localStorage.setItem('token', newToken);
            localStorage.setItem('device_id', newDeviceId);
            localStorage.setItem('username', userName);

            setLoading(false);
            return { success: true };

        } catch (err: any) {
            const message = err.response?.data || err.response?.data?.message || "Error al iniciar sesión";
            const stringMessage = typeof message === 'string' ? message : JSON.stringify(message);
            setError(stringMessage);
            setLoading(false);
            return { success: false, error: stringMessage };
        }
    };

    const logout = () => {
        setToken(null);
        setDeviceId(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('device_id');
        localStorage.removeItem('username');
    };

    const register = async (username: string, password: string) => {
        setLoading(true);
        setError(null);
        try {
            const { device_name, device_type } = getDeviceDetails();
            await api.post('/auth/register', { 
                username, 
                password,
                device_name,
                device_type
            });
            setLoading(false);
            return { success: true };

        } catch (err: any) {
            const message = err.response?.data || err.response?.data?.message || "Error en el registro";
            const stringMessage = typeof message === 'string' ? message : JSON.stringify(message);
            setError(stringMessage);
            setLoading(false);
            return { success: false, error: stringMessage };
        }
    };

    return (
        <AuthContext.Provider value={{
            token,
            jwt_token: token,
            device_id: deviceId,
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

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
    return context;
}
