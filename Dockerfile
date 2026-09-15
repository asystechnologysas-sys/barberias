FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

# Copiar archivos de dependencias
COPY package*.json ./
COPY backend/package*.json ./backend/

RUN npm install

# Copiar el código del backend y prisma
COPY backend ./backend

WORKDIR /app/backend

RUN npx prisma generate
RUN npm run build

# Imagen final
FROM node:22-alpine

WORKDIR /app/backend

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ../
COPY backend/package*.json ./

RUN npm install --only=production

COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/prisma ./prisma

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]