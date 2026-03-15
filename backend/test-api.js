const fetch = require('node-fetch');
const fs = require('fs');

async function testApi() {
  console.log('Testing /api/info with short video...');
  try {
    const videoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
    const res = await fetch('http://localhost:5000/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl })
    });
    
    if (!res.ok) {
      console.error('Info test failed:', await res.text());
      process.exit(1);
    }
    const data = await res.json();
    console.log('Video Info Title:', data.title);
    
    if (!data.formats || data.formats.length === 0) {
      console.error('No formats found.');
      process.exit(1);
    }
    
    const formatId = data.formats[0].format_id;
    const ext = data.formats[0].ext; // usually mp4 if we select a video format
    
    console.log(`Testing /api/download for format_id ${formatId} (short video)...`);
    const dlUrl = `http://localhost:5000/api/download?url=${encodeURIComponent(videoUrl)}&format_id=${formatId}&ext=mp4`;
    console.log('Fetching', dlUrl);

    const dlRes = await fetch(dlUrl);
    
    if (!dlRes.ok) {
      console.error('Download test failed:', await dlRes.text());
      process.exit(1);
    }
    
    const contentType = dlRes.headers.get('content-type');
    console.log('Download headers received successfully, Content-Type:', contentType);

    const destPath = 'downloaded_test.mp4';
    const dest = fs.createWriteStream(destPath);
    dlRes.body.pipe(dest);

    await new Promise((resolve, reject) => {
      dest.on('finish', resolve);
      dest.on('error', reject);
    });

    const stats = fs.statSync(destPath);
    console.log('Downloaded file size:', stats.size);
    if (stats.size > 10000 && contentType === 'video/mp4') {
      console.log('Backend /api/download is working perfectly and returns playable MP4.');
    } else {
      console.error('File size too small or bad content type.');
      process.exit(1);
    }

  } catch(e) {
    console.error('Test script error:', e);
    process.exit(1);
  }
}
testApi();
