# Imagen base oficial y ligera de Node.js (LTS)
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de dependencias primero para aprovechar la caché de Docker
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar el resto del código fuente del proyecto
COPY . .

# Puerto expuesto por el contenedor
EXPOSE 3000

# Variable de entorno para el puerto
ENV PORT=3000

# Comando para arrancar el servidor
CMD ["npm", "start"]
