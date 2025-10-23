const urlParams = new URLSearchParams(window.location.search);
const redirectPage = urlParams.get('redirect') || null;

const loginPanel = document.getElementById('login-panel');
const registerPanel = document.getElementById('register-panel');

// Cambiar paneles
document.getElementById('show-register').addEventListener('click', () => {
    loginPanel.style.display = 'none';
    registerPanel.style.display = 'block';
});
document.getElementById('show-login').addEventListener('click', () => {
    loginPanel.style.display = 'block';
    registerPanel.style.display = 'none';
});

// ===== Registro =====
async function registerUser() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value.trim();
    if (!username || !password) return alert('Completa todos los campos');

    try {
        const res = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            alert("✅ Registro exitoso. Ahora inicia sesión.");
            loginPanel.style.display = 'block';
            registerPanel.style.display = 'none';
        } else {
            alert("❌ " + (data.message || "Error desconocido"));
        }
    } catch (err) {
        console.error(err);
        alert("⚠️ Error de conexión");
    }
}

// ===== Login =====
async function loginUser() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!username || !password) return alert('Completa todos los campos');

    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok && data.token) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify({ username: data.username }));
            localStorage.setItem('role', data.role);

            // Redirigir según rol
            if (redirectPage) {
                window.location.href = redirectPage;
            } else if (["owner", "admin", "tester"].includes(data.role)) {
                window.location.href = "/index_dev.html";
            } else {
                window.location.href = "/index.html";
            }
        } else {
            alert("❌ " + (data.message || "Error desconocido"));
        }
    } catch (err) {
        console.error(err);
        alert("⚠️ Error de conexión");
    }
}

// ===== Eventos =====
document.getElementById('register-btn').addEventListener('click', registerUser);
document.getElementById('login-btn').addEventListener('click', loginUser);
