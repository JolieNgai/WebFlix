FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY backend ./backend
COPY database/create_table.sql ./database/create_table.sql
USER node
EXPOSE 8080
CMD ["node", "backend/server.js"]
