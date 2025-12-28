# 🚀 Tidol: AI-Powered Music Ecosystem & Proxy Bypass

<div align="center">

![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-%23EE4C2C.svg?style=for-the-badge&logo=PyTorch&logoColor=white)
![Status](https://img.shields.io/badge/Status-Functional%20MVP-success?style=for-the-badge)

**English | [Español](README.md)**

</div>

<div align="center">
  <img src="https://github.com/user-attachments/assets/0e7f107f-193d-4fa3-93d0-1fad80fe8611" alt="TIDOL Banner" width="100%" />
</div>

## 📄 Description

**Tidol** is a self-hosted platform designed to **revolutionize digital music management and processing**. Its core combines the power of **local AI** for audio processing with infrastructure capable of accessing a virtual library of over **14 million tracks** from public archives (Internet Archive).

The project integrates heavy AI processing in **Python (Spectra Engine)** with an **agile Node.js Backend** and a modern **React** interface, all protected by a **resilient proxy farm** to ensure constant data flow.

## ✨ Key Features

* 🌍 **Massive Access:** Search and ingest capabilities over a catalog of +14M songs, bypassing IP blocks through a "Warp Farm" of rotating proxies.
* 🤖 **Intelligent Processing (Local):** Track separation (vocals, drums, bass, other) using **Facebook Demucs** without relying on external APIs.
* ✍️ **Automatic Lyrics:** Generation of synchronized lyrics files (.lrc) using the **Faster-Whisper** model.
* 📊 **Technical Analysis:** BPM detection, key detection, and visual waveform generation for each track.
* 🎨 **Cutting-Edge Interface:** Responsive dashboard with Tailwind CSS and Framer Motion, designed for a smooth experience on both desktop and mobile.
* 🧠 **DJ Brain:** Intelligent recommendation system based on harmonic and rhythmic compatibility.

## 📸 Application Gallery

| Player (Fullscreen) | Audio Analysis Visualization |
| :---: | :---: |
| ![Dashboard](https://github.com/user-attachments/assets/4d64149c-5757-45f3-9135-0cc8b9210144) | ![Home](https://github.com/user-attachments/assets/4f84a5e1-42a9-4158-8385-7393300bcc52) |

| Music Library Management | Responsive Mobile View |
| :---: | :---: |
| ![Library](https://github.com/user-attachments/assets/72dc3353-a059-4113-80b9-2134dcfe1450) | <img src="https://github.com/user-attachments/assets/f4573357-aa82-4459-8a5d-bf01b0122832" height="500" alt="Mobile" /> |

## 🛠️ Technology Stack

* **Languages:** Python 3.10+ / JavaScript (Node.js & React)
* **Frontend:** React.js, Tailwind CSS, Framer Motion, Lucide Icons
* **Backend:** Node.js, Express.js, Better-SQLite3, Fluent-FFmpeg
* **AI Engine (Spectra):** Python, Faster-Whisper, Facebook Demucs, Librosa, PyTorch

## 🚀 Installation and Local Usage

> [!IMPORTANT]
> Tidol is a tool to manage your own library. To use the massive search engine, **you must first configure the Proxy Farm** (Warp Farm) detailed below.

### Option A: Using Docker (Recommended 🐳)

1. Make sure you have **Docker** and **Docker Compose** installed.
2. Run:
   ```bash
   docker-compose up --build -d
   ```

*Frontend: port 5173 | Backend: port 3000 | Spectra AI: port 3001*

### Option B: Manual Installation

1. **Clone the repository:**
```bash
git clone https://github.com/ElRoutel/Tidol.git
cd Tidol
```

2. **Dependencies (Backend/Frontend):**
```bash
cd backend && npm install && cd ..
cd tidol-ui && npm install && cd ..
```

3. **Spectra Engine (AI):**
```bash
cd tidol-spectra
python -m venv venv
# Activate venv and then:
pip install -r requirements.txt
npm install
cd ..
```

*It's recommended to configure the `.env` files in `/backend` and `/tidol-spectra` with your own preferences.*

### Option C: Quick Start on Windows 🪟

On Windows, you can use the automated script:

```bash
Tidol.bat
```

> [!NOTE]
> **Prerequisites:**
> - Make sure **Spectra is running** on port 3001 before starting the backend
> - The backend will run on `localhost:3000`
> - The frontend will be available on `localhost:5173`

## 🚜 Proxy Farm Configuration (Warp Farm)

Essential to avoid IP bans when performing massive searches.

1. Navigate to `backend/warp-farm`.
2. Run `.\setup_farm.bat` (Windows).
3. Select the number of proxies (7-10 recommended). The script will automatically generate WireGuard profiles.

## 🧹 Maintenance

* **`LimpiarCacheLetras.bat`**: Synchronizes the DB with physical files and cleans the cache.
* **`FORZAR_ResetLetras.bat`**: Removes all lyrics and forces complete regeneration.
* **`tidol-spectra/check_gpu.py`**: Run this script to verify if your system is leveraging GPU acceleration (NVIDIA/CUDA).

## 🛡️ Project Status

🚀 **Functional MVP** | 🚧 **Under active development.**

---

## 📬 Contact

If you're looking for custom audio processing solutions with AI or resilient automation, let's talk:

* **Email:** [ElRoutel@hotmail.com](mailto:ElRoutel@hotmail.com)
* **GitHub:** [@Routel](https://github.com/Routel)

---

<div align="center">
<i>Developed with ❤️ and lots of coffee by Routel</i>

<br><br>

<small>Customize your experience by changing the `default_cover.jpg` to your preferred image 🐸</small>
</div>
