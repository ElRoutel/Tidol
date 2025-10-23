// subirfotodeperfil.js
const currentProfilePic = document.getElementById("current-profile-pic");
const fileInput = document.getElementById("profile-file-input");
const uploadBtn = document.getElementById("upload-btn");
const cancelBtn = document.getElementById("cancel-btn");
const uploadMsg = document.getElementById("upload-msg");

let originalImg = currentProfilePic.src;

// Obtener info del usuario actual
async function loadUserProfile() {
    try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (!res.ok) throw new Error("No se pudo obtener usuario");
        const user = await res.json();
        currentProfilePic.src = user.profile_img || "/public/default_cover.png";
        originalImg = currentProfilePic.src;
    } catch (err) {
        console.error(err);
        uploadMsg.textContent = "Error cargando perfil.";
    }
}

// Subir nueva foto
async function uploadProfilePic() {
    const file = fileInput.files[0];
    if (!file) {
        uploadMsg.textContent = "Selecciona una imagen primero.";
        return;
    }

    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
        uploadMsg.textContent = "Tipo de archivo no válido.";
        return;
    }

    const formData = new FormData();
    formData.append("profile", file);

    try {
        const res = await fetch("/api/upload-profile", {
            method: "POST",
            body: formData,
            credentials: "include"
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al subir imagen");

        // Actualizar imagen en frontend
        currentProfilePic.src = data.profile_img + "?t=" + Date.now();
        originalImg = currentProfilePic.src;
        uploadMsg.textContent = "Imagen subida correctamente.";
    } catch (err) {
        console.error(err);
        uploadMsg.textContent = err.message;
    }
}

// Restaurar imagen original
function cancelUpload() {
    currentProfilePic.src = originalImg;
    fileInput.value = "";
    uploadMsg.textContent = "";
}

uploadBtn.addEventListener("click", uploadProfilePic);
cancelBtn.addEventListener("click", cancelUpload);

// Cargar perfil al inicio
loadUserProfile();
