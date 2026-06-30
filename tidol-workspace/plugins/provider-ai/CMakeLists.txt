# ============================================================================
# CONFIGURACIÓN E INICIALIZACIÓN DEL PROYECTO
# ============================================================================
cmake_minimum_required(VERSION 3.24)
project(provider_ai LANGUAGES C CXX CUDA)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_POSITION_INDEPENDENT_CODE ON)
set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)

# ============================================================================
# TARGET DE OPTIMIZACIÓN CPU: Intel Core i7-9700 (Coffee Lake / AVX2)
# ============================================================================
if (CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    add_compile_options(
        -O3
        -march=native
        -mtune=native
        -mavx2
        -mfma
        -msse4.1
        -msse4.2
        -fPIC
        -ffast-math
        -fno-finite-math-only # <-- Corrección matemática requerida por GGML
        -fno-plt
    )

elseif (MSVC)
    add_compile_options(/O2 /fp:fast /arch:AVX2)
endif()

# ============================================================================
# TARGET DE ACELERACIÓN CUDA: NVIDIA RTX 2080 (Turing Arch cc 7.5)
# ============================================================================
set(CMAKE_CUDA_STANDARD 17)
set(CMAKE_CUDA_STANDARD_REQUIRED ON)
set(CMAKE_CUDA_ARCHITECTURES 75)

if (CMAKE_CUDA_COMPILER)
    enable_language(CUDA)
endif()

# ============================================================================
# CONFIGURACIÓN INTEGRADA DE WHISPER.CPP / GGML
# ============================================================================
set(BUILD_SHARED_LIBS ON CACHE BOOL "" FORCE)
set(GGML_CUDA ON CACHE BOOL "Enable CUDA backend for ggml" FORCE)
set(GGML_BLAS OFF CACHE BOOL "" FORCE)
set(GGML_METAL OFF CACHE BOOL "" FORCE)
set(GGML_VULKAN OFF CACHE BOOL "" FORCE)
set(GGML_OPENMP ON CACHE BOOL "" FORCE)

# Optimizaciones de coma flotante de precisión media para arquitectura Turing
set(GGML_CUDA_F16 ON CACHE BOOL "Use f16 on CUDA" FORCE)
set(GGML_CUDA_FORCE_MMQ OFF CACHE BOOL "" FORCE)
set(GGML_CUDA_FORCE_DMMV OFF CACHE BOOL "" FORCE)
set(GGML_CUDA_NO_VMM OFF CACHE BOOL "" FORCE)
set(GGML_CUDA_FORCE_CUBLAS ON CACHE BOOL "Prefer cuBLAS kernels" FORCE)

# ============================================================================
# ORQUESTACIÓN DE DIRECTORIOS Y DEPENDENCIAS SUBMODULARES
# ============================================================================
set(WHISPERCPP_DIR ${CMAKE_SOURCE_DIR}/third_party/whisper.cpp)

# Procesar de forma aislada el árbol de CMake de whisper.cpp
add_subdirectory(${WHISPERCPP_DIR} ${CMAKE_BINARY_DIR}/whispercpp-build)

# ============================================================================
# CONSTRUCCIÓN DEL COMPONENTE COMPARTIDO FFI (PLUGIN)
# ============================================================================
# CORRECCIÓN DE RUTA: Apuntamos exactamente al archivo src/ai_plugin.cpp
add_library(provider_ai SHARED
    src/ai_plugin.cpp
)

# Mapeo de directorios de inclusión locales del submódulo
target_include_directories(provider_ai PRIVATE
    ${WHISPERCPP_DIR}/include
    ${WHISPERCPP_DIR}/ggml/include
)

target_compile_definitions(provider_ai PRIVATE
    _GNU_SOURCE
)

# Enlazado determinista con las dependencias estructurales de Whisper
target_link_libraries(provider_ai PRIVATE
    whisper
    ggml
)

# Enlazado dinámico según la topología del árbol de Whisper compilado
if (TARGET ggml-cpu)
    target_link_libraries(provider_ai PRIVATE ggml-cpu)
endif()

if (TARGET ggml-cuda)
    target_link_libraries(provider_ai PRIVATE ggml-cuda)
endif()

# Propiedades de salida para concordancia exacta con Rust libloading (.so)
set_target_properties(provider_ai PROPERTIES
    OUTPUT_NAME "provider_ai"
    PREFIX "lib"
    SUFFIX ".so"
)

# ============================================================================
# DIAGNÓSTICO E INFORMACIÓN TÉCNICA DEL PROCESO DE BUILD
# ============================================================================
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ compiler: ${CMAKE_CXX_COMPILER_ID}")
message(STATUS "CUDA architectures: ${CMAKE_CUDA_ARCHITECTURES}")
message(STATUS "GGML_CUDA: ${GGML_CUDA}")
message(STATUS "WHISPERCPP_DIR: ${WHISPERCPP_DIR}")
