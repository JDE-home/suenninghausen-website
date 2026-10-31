# Dorf-Website Sünninghausen – Produktions-Image
# Bauen:  docker build --build-arg SITE_URL=https://suenninghausen.de -t suenninghausen .
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG SITE_URL=https://suenninghausen.example
ENV SITE_URL=$SITE_URL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 DATA_DIR=/data
COPY --from=build /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
