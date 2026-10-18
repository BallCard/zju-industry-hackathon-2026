# Build with the GitHub repository root as context: docker build -t pc-studio .
FROM node:22-alpine
WORKDIR /app
COPY apps/pc-studio/package.json ./
COPY apps/pc-studio/backend ./backend
COPY apps/pc-studio/docs/SYSTEM_PROMPT.md ./docs/SYSTEM_PROMPT.md
COPY apps/pc-studio/data/models.json ./data/models.json
COPY apps/pc-studio/frontend ./frontend
EXPOSE 7860
ENV PORT=7860 HOST=0.0.0.0 NODE_ENV=production
CMD ["node","backend/server.js"]
