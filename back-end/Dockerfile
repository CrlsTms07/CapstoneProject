FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

EXPOSE 5000
ENV NODE_ENV=production
CMD ["node", "server.js"]
