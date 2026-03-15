FROM node:20

RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
