#!/bin/bash
set -e

echo "=== Iniciando compilación de Provider AI (CUDA 7.5 / AVX2) ==="

# 1. Preparar dependencias
if [ ! -d "third_party/whisper.cpp" ]; then
    echo "[+] Clonando whisper.cpp en third_party..."
    mkdir -p third_party
    git clone https://github.com/ggerganov/whisper.cpp.git third_party/whisper.cpp
else
    echo "[+] whisper.cpp ya existe. Omitiendo clonación."
fi

# 2. Preparar directorio de build
mkdir -p build
cd build

# 3. Configurar CMake
echo "[+] Configurando CMake..."
cmake .. -DCMAKE_BUILD_TYPE=Release

# 4. Compilar usando todos los núcleos disponibles (i7-9700 = 8 hilos)
echo "[+] Compilando con make..."
make -j$(nproc)

# 5. Exportar al workspace de Rust
echo "[+] Exportando libprovider_ai.so al target de Rust..."
mkdir -p ../../../target/debug/
mkdir -p ../../../target/release/

# Copiamos a ambas carpetas por si corres con --release
cp libprovider_ai.so ../../../target/debug/
cp libprovider_ai.so ../../../target/release/

echo "=== Compilación exitosa. El plugin AI está listo. ==="
