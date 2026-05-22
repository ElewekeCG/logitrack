# Use lightweight Node image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install --production
RUN apk add --no-cache curl

# Copy app source
COPY . .

# Expose the service port
EXPOSE 3002

# Start the service
CMD ["node", "server.js"]