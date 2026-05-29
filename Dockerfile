FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8787
ENV SYNC_DB_DIR=/data

EXPOSE 8787

CMD ["node", "server/index.js"]
