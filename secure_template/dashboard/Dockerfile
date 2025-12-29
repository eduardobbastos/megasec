FROM node:18-alpine

# Network timeout fix: Use HTTP registry and increase timeout
RUN npm config set registry http://registry.npmjs.org/
RUN npm config set fetch-retry-maxtimeout 120000

# Install Docker CLI to control sibling containers
RUN apk add --no-cache docker-cli

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
