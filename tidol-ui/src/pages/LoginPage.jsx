// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Importa nuestro hook

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Saca la lógica de autenticación de nuestro "cerebro"
  const { login, loading, error } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault(); // Evita que la página se recargue
    if (!username || !password) {
      alert("Por favor, ingresa usuario y contraseña");
      return;
    }
    // Llama a la función de login de nuestro AuthContext
    login(username, password); 
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <h1>Bienvenido a Tidol</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Usuario: </label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
          />
        </div>
        <div style={{ margin: '1rem 0' }}>
          <label>Contraseña: </label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Cargando...' : 'Entrar'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </form>
    </div>
  );
}