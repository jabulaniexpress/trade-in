# Local dev/build container only — production hosting is a static site
# (DO App Platform builds from the repo; this image never ships).
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
