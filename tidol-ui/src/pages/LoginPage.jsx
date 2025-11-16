// src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';
import logo from '/logo.svg';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(username, password);
    if (result.success) {
      navigate(result.redirectPage || '/');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-gradient-orb auth-orb-1"></div>
        <div className="auth-gradient-orb auth-orb-2"></div>
        <div className="auth-gradient-orb auth-orb-3"></div>
      </div>

      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="Tidol Logo" className="auth-logo-icon" />
          <h1 className="auth-title">Tidol</h1>
        </div>

        <p className="auth-subtitle">Musica gratis para todos</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label htmlFor="username" className="auth-label">Usuario</label>
            <input
              id="username"
              type="text"
              placeholder="Ingresa tu usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="auth-input"
              required
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="password" className="auth-label">Contraseña</label>
            <input
              id="password"
              type="password"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              required
            />
          </div>

          {error && (
            <div className="auth-alert auth-alert-error">
              <svg className="auth-alert-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-button auth-button-primary"
          >
            {loading ? (
              <>
                <span className="auth-spinner"></span>
                Entrando...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span className="auth-divider-text">o</span>
        </div>

        <div className="auth-footer">
          <p className="auth-footer-text">
            ¿No tienes una cuenta?{' '}
            <Link to="/register" className="auth-link">
              Regístrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}