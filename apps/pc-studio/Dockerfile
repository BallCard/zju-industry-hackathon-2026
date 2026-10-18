FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY docs ./docs
COPY data ./data
COPY public ./public
EXPOSE 7860
ENV PORT=7860 HOST=0.0.0.0 NODE_ENV=production
CMD ["node","server.js"]
