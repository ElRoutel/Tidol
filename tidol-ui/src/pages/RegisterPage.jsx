// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { register, loading } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 4) {
      setError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }

    const result = await register(username, password);
    if (result.success) {
      setSuccess('¡Registro exitoso! Redirigiendo al login...');
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setError(result.error || 'Error en el registro.');
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
        <h1 style={{ marginBottom: '24px', textAlign: 'center' }}>Crear Cuenta</h1>
        
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ width: '100%', padding: '12px', marginBottom: '16px', background: '#282828', border: 'none', borderRadius: '6px', color: 'white' }}
        />
        
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '12px', marginBottom: '24px', background: '#282828', border: 'none', borderRadius: '6px', color: 'white' }}
        />
        
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '14px', background: '#1db954', border: 'none', borderRadius: '24px', color: 'white', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}
        >
          {loading ? 'Registrando...' : 'Registrarse'}
        </button>
        
        {error && (
          <p style={{ color: '#ff5555', marginTop: '16px', textAlign: 'center' }}>
            {error}
          </p>
        )}

        {success && (
          <p style={{ color: '#1db954', marginTop: '16px', textAlign: 'center' }}>
            {success}
          </p>
        )}

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#b3b3b3' }}>
          ¿Ya tienes una cuenta?{' '}
          <Link to="/login" style={{ color: 'white', textDecoration: 'underline', fontWeight: 'bold' }}>
            Inicia sesión
          </Link>
        </div>
      </form>
    </div>
  );
}