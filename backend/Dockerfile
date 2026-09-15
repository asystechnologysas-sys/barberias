FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
RUN npm install
COPY backend ./backend
WORKDIR /app/backend
RUN npx prisma generate && npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/prisma ./prisma
EXPOSE 3000
CMD ["sh","-c","npx prisma migrate deploy && node dist/server.js"]
