FROM node:18-alpine

WORKDIR /app

# Package files kopyala
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Dependencies kur
RUN npm ci --only=production

# Source code kopyala
COPY . .

# Build
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/v1/health || exit 1

# Start command
CMD ["npm", "run", "start:prod"]