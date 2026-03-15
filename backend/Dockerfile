FROM node:20-bullseye

# Install ffmpeg and python
RUN apt-get update && \
    apt-get install -y ffmpeg python3 curl && \
    ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Download yt-dlp into the app directory directly
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /app/yt-dlp && \
    chmod 777 /app/yt-dlp

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "server.js"]
