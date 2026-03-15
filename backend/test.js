const fetch = require('node-fetch');

async function testApi() {
  console.log('Testing /api/info...');
  try {
    const res = await fetch('http://localhost:5000/api/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://vimeo.com/22439234' })
    });
    
    if (!res.ok) {
      const err = await res.text();
      console.error('Info test failed:', err);
      process.exit(1);
    }
    const data = await res.json();
    console.log('Video Info Title:', data.title);
    
    if (!data.formats || data.formats.length === 0) {
      console.error('No formats found.');
    } else {
      console.log('Formats found:', data.formats.length);
      const formatId = data.formats[0].format_id;
      const ext = data.formats[0].ext;
      
      console.log(`Testing /api/download for format ${formatId}...`);
      const dlRes = await fetch(`http://localhost:5000/api/download?url=${encodeURIComponent('https://vimeo.com/22439234')}&format_id=${formatId}&ext=${ext}`);
      
      if (!dlRes.ok) {
        console.error('Download test failed:', await dlRes.text());
        process.exit(1);
      }
      
      console.log('Download headers received successfully, Content-Type:', dlRes.headers.get('content-type'));
      console.log('Test completed successfully!\n');
    }
  } catch(e) {
    console.error('Test script error:', e);
  }
}
testApi();
