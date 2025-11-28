from faster_whisper import download_model
import sys

print("⬇️ Iniciando descarga del modelo 'large-v2'...")
print("Esto puede tardar dependiendo de tu conexión a internet (Tamaño: ~3GB)")

try:
    # Descargar el modelo explícitamente
    model_path = download_model("large-v2")
    print(f"\n✅ Modelo descargado exitosamente en: {model_path}")
    print("Ahora puedes usar VOXW con 'large-v2' sin esperas.")
except Exception as e:
    print(f"\n❌ Error durante la descarga: {e}")
    sys.exit(1)
