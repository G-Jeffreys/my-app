# Use the official lightweight Node.js 20 image
FROM node:20-slim

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . ./

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies and source files to reduce image size
RUN npm prune --production && rm -rf src tsconfig.json

# Run the web service on container startup
CMD ["npm", "start"]

# Expose port 8080 (Cloud Run default)
EXPOSE 8080 