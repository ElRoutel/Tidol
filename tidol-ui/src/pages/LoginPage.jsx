// src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error } = useAuth(); // 'error' viene del contexto
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(username, password); // Llama a la función del contexto
    if (result.success) {
      // Redirige a la página que dijo el backend o a la home
      navigate(result.redirectPage || '/');
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1db954 0%, #191414 100%)'
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#181818',
          padding: '40px',
          borderRadius: '12px',
          width: '400px',
          maxWidth: '90%'
        }}
      >
        <h1 style={{ marginBottom: '24px', textAlign: 'center' }}>Tidol</h1>
        
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '16px',
            background: '#282828',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            fontSize: '14px'
          }}
        />
        
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '24px',
            background: '#282828',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            fontSize: '14px'
          }}
        />
        
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: '#1db954',
            border: 'none',
            borderRadius: '24px',
            color: 'white',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Cargando...' : 'Entrar'}
        </button>
        
        {error && (
          <p style={{ color: '#ff5555', marginTop: '16px', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}