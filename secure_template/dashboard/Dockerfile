FROM node:18-slim

# No installations required. We mount the docker binary from host.

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
