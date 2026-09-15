FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

# Copiar package.json raíz y de backend
COPY package*.json ./
COPY backend/package*.json ./backend/

RUN npm install

# Copiar el código del backend
COPY backend ./backend

WORKDIR /app/backend

# Generar cliente de Prisma y compilar TypeScript
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]