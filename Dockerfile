# ===================================================================
# Dockerfile optimizado para Google Cloud Run
# =================================================================== 

# 1. Imagen base oficial y ligera de Node.js (LTS Alpine)
FROM node:20-alpine

# Definir entorno de producción
ENV NODE_ENV=production

# 2. Directorio de trabajo
WORKDIR /app

# 3. Copiar manifiestos de dependencias primero para aprovechar el caché de capas
COPY package*.json ./

# 4. Instalar únicamente dependencias de producción de forma limpia
RUN npm ci --omit=dev || npm install --omit=dev

# 5. Copiar el código fuente y assets asignando permisos al usuario no root 'node'
COPY --chown=node:node . .

# 6. Ejecutar como usuario sin privilegios (Seguridad recomendada para Cloud Run)
USER node

# 7. Puerto estándar por defecto inyectado por Google Cloud Run
ENV PORT=8080
EXPOSE 8080

# 8. Arrancar Node directamente (en lugar de npm) para recibir adecuadamente señales SIGTERM/SIGINT de Cloud Run
CMD ["node", "index.js"]
