FROM node:20-slim

RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl ca-certificates && \
    update-ca-certificates && \
    ln -s /usr/bin/python3 /usr/bin/python

# Install specific stable yt-dlp version that works reliably
RUN pip3 install --no-cache-dir yt-dlp --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p downloads && chmod 777 downloads

EXPOSE 8080

CMD ["node", "server.js"]
