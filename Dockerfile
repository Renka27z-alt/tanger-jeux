FROM node:22
RUN apt-get update && apt-get install -y fonts-liberation
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]
