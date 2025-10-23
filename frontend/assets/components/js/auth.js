// auth.js
export async function showUser() {
  const token = localStorage.getItem('token');
  if (!token) return window.location.href = 'login.html';

  try {
    const res = await fetch('/validate', { headers: { 'x-token': token } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    document.getElementById('user-name').textContent = data.username;
  } catch {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }
}

export function logout() {
  localStorage.removeItem('token');
  window.location.href = 'login.html';
}
