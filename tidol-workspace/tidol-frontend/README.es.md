# Tidol Frontend

[Read in English](README.md)

Aplicación frontend para el servicio de streaming de música Tidol. Construida con React, TypeScript y Vite, presenta patrones de diseño glassmorphism, carruseles de medios y diseños adaptables.

## Características

- Interfaz web moderna y responsiva
- Estética de diseño glassmorphism
- Carruseles de medios y listas de reproducción interactivas
- Mecanismo inteligente de fallback de imágenes y reporte automático de carátulas faltantes

## Desarrollo

Para ejecutar el servidor de desarrollo localmente:

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Ejecutar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

3. Compilar la aplicación para producción:
   ```bash
   npm run build
   ```

## Despliegue en Producción con Docker

Puede compilar y ejecutar el frontend dentro de un contenedor Docker:

1. Compilar la imagen Docker:
   ```bash
   docker build -t tidol-frontend:latest .
   ```

2. Ejecutar el contenedor Docker:
   ```bash
   docker run -d -p 8080:80 tidol-frontend:latest
   ```

La aplicación estará accesible en http://localhost:8080.
