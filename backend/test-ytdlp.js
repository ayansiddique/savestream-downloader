const ytdlp = require('yt-dlp-exec');
const fs = require('fs');

async function test() {
  console.log('Testing yt-dlp with ffmpeg merge...');
  try {
    const url = 'https://vimeo.com/22439234';
    await ytdlp(url, {
      format: 'bestvideo+bestaudio/best',
      mergeOutputFormat: 'mp4',
      output: 'test_output.mp4',
      noPlaylist: true
    });
    console.log('yt-dlp merged test completed perfectly!');
    if(fs.existsSync('test_output.mp4')) {
      const stats = fs.statSync('test_output.mp4');
      console.log('File size:', stats.size);
    }
  } catch(e) {
    console.error('yt-dlp test error:', e);
    process.exit(1);
  }
}
test();
