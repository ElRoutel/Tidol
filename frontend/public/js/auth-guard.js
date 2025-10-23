(async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    console.log("No hay token, redirigiendo a login...");
    window.location.href = "/login.html";
    return;
  }

  try {
    const res = await fetch("/validate", {
      headers: { "x-token": token }
    });

    if (!res.ok) throw new Error("Token inválido o expirado");

    const user = await res.json();

    // Roles permitidos para esta página
    const allowedRoles = ["admin", "tester", "owner"];
    if (!allowedRoles.includes(user.role)) {
      console.log("Rol no permitido:", user.role);
      window.location.href = "/login.html";
      return;
    }

    console.log("Acceso autorizado ✅", user);

  } catch (err) {
    console.error("Error validando acceso:", err.message);
    window.location.href = "/login.html";
  }
})();
console.log("auth-guard cargado ✅ ");