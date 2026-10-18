FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY backend ./backend
COPY docs ./docs
COPY data ./data
COPY frontend ./frontend
EXPOSE 7860
ENV PORT=7860 HOST=0.0.0.0 NODE_ENV=production
CMD ["node","backend/server.js"]
