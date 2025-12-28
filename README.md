# 🚀 Tidol: Ecosistema Musical con IA & Bypass de Proxies

<div align="center">

![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-%23EE4C2C.svg?style=for-the-badge&logo=PyTorch&logoColor=white)
![Estado](https://img.shields.io/badge/Estado-MVP%20Funcional-success?style=for-the-badge)

**[English](README_EN.md) | Español**

</div>

<div align="center">
  <img src="https://github.com/user-attachments/assets/0e7f107f-193d-4fa3-93d0-1fad80fe8611" alt="TIDOL Banner" width="100%" />
</div>

## 📄 Descripción

**Tidol** es una plataforma autohospedada diseñada para **revolucionar la gestión y el procesamiento de música digital**. Su núcleo combina la potencia de la **IA local** para el procesamiento de audio con una infraestructura capaz de acceder a una biblioteca virtual de más de **14 millones de pistas** provenientes de archivos públicos (Internet Archive).

El proyecto integra el procesamiento pesado de IA en **Python (Spectra Engine)** con un **Backend ágil en Node.js** y una interfaz moderna en **React**, todo protegido por una **granja de proxies resiliente** para garantizar el flujo constante de datos.

## ✨ Características Principales

* 🌍 **Acceso Masivo:** Capacidad de búsqueda e ingesta sobre un catálogo de +14M de canciones, superando bloqueos de IP mediante una "Warp Farm" de proxies rotativos.
* 🤖 **Procesamiento Inteligente (Local):** Separación de pistas (voces, batería, bajo, otros) usando **Facebook Demucs** sin depender de APIs externas.
* ✍️ **Letras Automáticas:** Generación de archivos de letra sincronizada (.lrc) mediante el modelo **Faster-Whisper**.
* 📊 **Análisis Técnico:** Detección de BPM, tonalidad (Key) y generación visual de formas de onda para cada track.
* 🎨 **Interfaz de Vanguardia:** Dashboard reactivo con Tailwind CSS y Framer Motion, diseñado para una experiencia fluida tanto en desktop como en móvil.
* 🧠 **DJ Brain:** Sistema de recomendación inteligente basado en compatibilidad armónica y rítmica.

## 📸 Galería de la Aplicación

| Reproductor (Fullscreen) | Visualización de Análisis de Audio |
| :---: | :---: |
| ![Dashboard](https://github.com/user-attachments/assets/4d64149c-5757-45f3-9135-0cc8b9210144) | ![Home](https://github.com/user-attachments/assets/4f84a5e1-42a9-4158-8385-7393300bcc52) |

| Gestión de Biblioteca Musical | Vista Móvil Reactiva |
| :---: | :---: |
| ![Biblioteca](https://github.com/user-attachments/assets/72dc3353-a059-4113-80b9-2134dcfe1450) | <img src="https://github.com/user-attachments/assets/f4573357-aa82-4459-8a5d-bf01b0122832" height="500" alt="Móvil" /> |

## 🛠️ Stack Tecnológico

* **Lenguajes:** Python 3.10+ / JavaScript (Node.js & React)
* **Frontend:** React.js, Tailwind CSS, Framer Motion, Lucide Icons
* **Backend:** Node.js, Express.js, Better-SQLite3, Fluent-FFmpeg
* **Motor de IA (Spectra):** Python, Faster-Whisper, Facebook Demucs, Librosa, PyTorch

## 🚀 Instalación y Uso Local

> [!IMPORTANT]
> Tidol es una herramienta para gestionar tu propia biblioteca. Para usar el motor de búsqueda masiva, **primero debes configurar la Granja de Proxies** (Warp Farm) detallada más abajo.

### Opción A: Usando Docker (Recomendado 🐳)

1. Asegúrate de tener **Docker** y **Docker Compose** instalados.
2. Ejecuta:
   ```bash
   docker-compose up --build -d
   ```

*Frontend: puerto 5173 | Backend: puerto 3000 | Spectra IA: puerto 3001*

### Opción B: Instalación Manual

1. **Clonar el repositorio:**
```bash
git clone https://github.com/ElRoutel/Tidol.git
cd Tidol
```

2. **Dependencias (Backend/Frontend):**
```bash
cd backend && npm install && cd ..
cd tidol-ui && npm install && cd ..
```

3. **Motor Spectra (IA):**
```bash
cd tidol-spectra
python -m venv venv
# Activar venv y luego:
pip install -r requirements.txt
npm install
cd ..
```

*Se recomienda configurar los archivos `.env` en `/backend` y `/tidol-spectra` con tus propias preferencias.*

## 🚜 Configuración de la Granja de Proxies (Warp Farm)

Vital para evitar el baneo de IP al realizar búsquedas masivas.

1. Navega a `backend/warp-farm`.
2. Ejecuta `.\setup_farm.bat` (Windows).
3. Selecciona el número de proxies (se recomiendan 7-10). El script generará los perfiles de WireGuard automáticamente.

## 🧹 Mantenimiento

* **`LimpiarCacheLetras.bat`**: Sincroniza la DB con los archivos físicos y limpia la caché.
* **`FORZAR_ResetLetras.bat`**: Elimina todas las letras y fuerza la regeneración total.
* **`tidol-spectra/check_gpu.py`**: Ejecuta este script para verificar si tu sistema está aprovechando la aceleración por GPU (NVIDIA/CUDA).

## 🛡️ Estado del Proyecto

🚀 **MVP Funcional** | 🚧 **En desarrollo activo.**

---

## 📬 Contacto

Si buscas soluciones personalizadas de procesamiento de audio con IA o automatización resiliente, hablemos:

* **Email:** [ElRoutel@hotmail.com](mailto:ElRoutel@hotmail.com)
* **GitHub:** [@Routel](https://github.com/Routel)

---

<div align="center">
<i>Desarrollado con ❤️ y mucho café por Routel</i>

<br><br>

<small>Personaliza tu experiencia cambiando el `default_cover.jpg` por la imagen de tu preferencia 🐸</small>
</div>
