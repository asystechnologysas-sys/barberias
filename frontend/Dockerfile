FROM node:22-alpine AS build

WORKDIR /app

# Instalar dependencias del frontend
COPY package*.json ./
RUN npm install

# Variable de entorno para que Vite conecte con el backend
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copiar el código del frontend y compilar
COPY . .
RUN npm run build

# Servidor web Nginx de producción
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]