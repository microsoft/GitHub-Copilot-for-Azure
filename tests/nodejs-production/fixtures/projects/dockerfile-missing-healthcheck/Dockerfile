FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# This Dockerfile is missing production best practices:
# - No NODE_ENV environment variable
# - No USER instruction (running as root)
# - No HEALTHCHECK instruction

EXPOSE 3000

CMD ["node", "server.js"]
