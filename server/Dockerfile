FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN apk add --no-cache docker-cli docker-cli-compose
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
