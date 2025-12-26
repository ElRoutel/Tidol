# 🚀 Tidol: Ecosistema Musical con IA & Bypass de Proxies

<div align="center">

![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-%23EE4C2C.svg?style=for-the-badge&logo=PyTorch&logoColor=white)
![Estado](https://img.shields.io/badge/Estado-MVP%20Funcional-success?style=for-the-badge)

</div>

---

<div align="center">
  <img src="https://github.com/user-attachments/assets/0e7f107f-193d-4fa3-93d0-1fad80fe8611" alt="TIDOL Banner" width="100%" />
</div>

## 📄 Descripción

**Tidol** es una herramienta diseñada para **revolucionar la gestión y el procesamiento de música digital**. Su objetivo principal es optimizar **la experiencia del usuario y la accesibilidad de contenidos** mediante algoritmos de **IA local** (separación de voces y generación de letras) y una **granja de proxies resiliente** para superar bloqueos de red geográficos.

Este proyecto demuestra cómo integrar una arquitectura robusta que combina el procesamiento pesado de IA en **Python (Spectra Engine)** con un **Backend ágil en Node.js** y una interfaz de usuario fluida y reactiva en **React (Frontend)**.

## ✨ Características Principales

* ✅ **Automatización Resiliente:** Ingesta y descarga automática de contenido musical desde Internet Archive, superando bloqueos de IP mediante una "Warp Farm" de proxies rotativos.
* ✅ **Procesamiento Inteligente de Audio:** Separación de pistas (creación de instrumentales/acapellas) usando el modelo de IA **Demucs**.
* ✅ **Generación de Letras Sincronizadas:** Transcripción automática de audio a texto con marcas de tiempo (.lrc) utilizando el modelo **Faster-Whisper**.
* ✅ **Análisis Musical Profundo:** Detección automática de BPM (tempo), tonalidad (Key) y generación visual de formas de onda (Waveforms) para cada track.
* ✅ **Interfaz Reactiva y Moderna:** Dashboard intuitivo diseñado con Tailwind CSS y Framer Motion, con modo oscuro y visualización dinámica de la biblioteca musical.
* ✅ **DJ Brain (Sistema de Recomendación):** Motor inteligente que sugiere mezclas basadas en compatibilidad armónica y de ritmo entre canciones.

## 📸 Galería de la Aplicación

| Reproductor (Fullscreen) | Visualización de Análisis de Audio |
| :---: | :---: |
| ![Dashboard](https://github.com/user-attachments/assets/4d64149c-5757-45f3-9135-0cc8b9210144) | ![Home](https://github.com/user-attachments/assets/4f84a5e1-42a9-4158-8385-7393300bcc52) |

| Gestión de Biblioteca Musical | Vista Móvil Reactiva |
| :---: | :---: |
| ![Biblioteca](https://github.com/user-attachments/assets/72dc3353-a059-4113-80b9-2134dcfe1450) | <img src="https://github.com/user-attachments/assets/f4573357-aa82-4459-8a5d-bf01b0122832" height="500" alt="Móvil" /> |

## 🛠️ Stack Tecnológico

Este proyecto fue construido utilizando una arquitectura de microservicios:

* **Lenguajes:** Python 3.10+ / JavaScript (Node.js & React)
* **Frontend:** React.js, Tailwind CSS, Framer Motion, Lucide Icons, Vite
* **Backend/Data:** Node.js, Express.js, Better-SQLite3 (Base de datos local rápida), Axios, Fluent-FFmpeg
* **Motor de IA (Spectra):** Python, Faster-Whisper, Facebook Demucs, Librosa, PyTorch, NumPy, Pandas

## 🚀 Instalación y Uso Local

### Opción A: Usando Docker (Recomendado 🐳)

La forma más sencilla de ejecutar todo el ecosistema sin preocuparse por dependencias.

1.  Asegúrate de tener **Docker** y **Docker Compose** instalados.
2.  Clona el repositorio y navega a la carpeta raíz.
3.  **Ejecuta el ecosistema completo:**
    ```bash
    docker-compose up --build -d
    ```
    *Esto iniciará los contenedores del Frontend (puerto 5173), Backend (puerto 3000) y el motor Spectra de IA (puerto 3001) en segundo plano.*

### Opción B: Instalación Manual

Si prefieres ejecutar cada servicio por separado en tu máquina host.

#### Prerrequisitos
* Git
* Python 3.10+ (con pip)
* Node.js 18+ (con npm)
* **FFmpeg** instalado y agregado al PATH del sistema.

#### Pasos

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/ElRoutel/Tidol.git
    cd Tidol
    ```

2.  **Instalar dependencias (Backend y Frontend):**
    ```bash
    # Desde la raíz del proyecto
    cd backend && npm install && cd ..
    cd tidol-ui && npm install && cd ..
    ```

3.  **Configurar Spectra (Motor de IA):**
    ```bash
    cd tidol-spectra
    # Se recomienda usar un entorno virtual (venv)
    python -m venv venv
    # Activar venv:
    #   Windows: .\venv\Scripts\activate
    #   Linux/Mac: source venv/bin/activate
    pip install -r requirements.txt
    # Instalar dependencias del servidor Node de Spectra si es necesario
    npm install
    cd ..
    Opcional pero recomendado modificar los .env para usar tus propias claves (Tidol\backend\.env y Tidol\tidol-spectra\.env)
    ```

4.  **Ejecutar:**
    Puedes usar el script lanzador incluido para Windows que inicia todos los servicios:
    ```bash
    # En Windows
    .\Tidol.bat
    ```

## 🚜 Configuración de la Granja de Proxies (Warp Farm)

Para superar los límites de descarga de sitios como Internet Archive, Tidol utiliza una granja de proxies rotativos basados en Cloudflare WARP.

1.  **Navega a la carpeta de la granja:**
    ```bash
    cd backend/warp-farm
    ```
2.  **Configura los proxies:**
    Ejecuta el script de configuración automática (Windows):
    ```bash
    .\setup_farm.bat
    ```
    *Este script te preguntará cuántos proxies quieres (se recomiendan 7-10) y generará los perfiles de WireGuard necesarios automáticamente.*
3.  **Monitorea los proxies:**
    Puedes ver el estado de tus proxies con:
    ```bash
    docker stats
    ```

> [!TIP]
> Si experimentas errores de conexión, puedes resetear la granja usando `.\clean_farm.bat` y volviendo a ejecutar el setup.

## 🧹 Mantenimiento y Utilidades

Tidol incluye herramientas para mantener la integridad de los datos y gestionar el espacio en disco de forma eficiente.

### Gestión de Letras y Caché
Si necesitas limpiar las letras generadas o sincronizar la base de datos con los archivos físicos, utiliza los siguientes scripts desde la raíz del proyecto:

* **`LimpiarCacheLetras.bat`**: Escanea la carpeta de letras y desactiva las banderas de letras en la base de datos para aquellas canciones cuyos archivos `.lrc` físicos hayan sido eliminados manualmente. También vacía la tabla de caché de letras línea por línea.
* **`FORZAR_ResetLetras.bat`**: **Acción Nuclear**. Elimina todos los archivos `.lrc` físicos, vacía la caché de letras y reinicia todas las banderas de procesamiento en la base de datos para forzar una regeneración completa en la próxima reproducción.

### Scripts de Motor (Spectra)
* **`tidol-spectra/check_gpu.py`**: Verifica si el sistema detecta correctamente tu GPU (NVIDIA/CUDA) para acelerar el procesamiento de IA.

## 🛡️ Estado del Proyecto

🚀 **MVP Funcional** | 🚧 **En desarrollo activo: Expandiendo capacidades de IA y optimización.**

---

## 📬 Contacto

Si te interesa implementar una solución de procesamiento de audio con IA similar para tu negocio o deseas colaborar en el proyecto, contáctame:

* **Email:** [ElRoutel@hotmail.com](mailto:ElRoutel@hotmail.com)
* **GitHub:** [@Routel](https://github.com/Routel)

---
<div align="center">
  <i>Desarrollado con ❤️ y mucho café por Routel</i>
  <br>
  <small>Si llegaste hasta aquí siempre puedes cambiar el cover (default_cover.jpg) que es una rana por la imagen de tu preferencia 🐸</small>
</div>
