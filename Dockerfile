# ─── Stage 1: Build the Angular application ───────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package.json package-lock.json ./

# Install dependencies (clean install from lock-file)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the application in production mode
# (the "build" script in package.json already runs: ng build --configuration production)
RUN npm run build -- --configuration production

# ─── Stage 2: Serve with Nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove the default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled assets from the build stage
COPY --from=build /app/dist/medicare-angular /usr/share/nginx/html

# Copy custom Nginx configuration for Angular SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
