# Dockerfile for Azure

## Basic Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "app.js"]
```

## Multi-stage Build

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["node", "dist/app.js"]
```

## Best Practices

- Use `npm ci` (not `npm install`) for reproducible builds
- Use `--only=production` to exclude devDependencies
- Set `NODE_ENV=production`, run as non-root (`USER node`), use Alpine images
