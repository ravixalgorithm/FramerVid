import fs from 'fs/promises';

async function testLoom() {
  const url = 'https://www.loom.com/share/154d490ed66b4187986d6295a48a4414';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  const html = await res.text();
  await fs.writeFile('loom.html', html);
  console.log('Saved loom.html');
  
  const cdnPatterns = [
    /\"raw_cdn_url\"\s*:\s*\"([^\"]+\.mp4[^\"]*)\"/i,
    /\"transcode_url\"\s*:\s*\"([^\"]+\.mp4[^\"]*)\"/i,
    /\"url\"\s*:\s*\"(https:\/\/[^\"]*\.loom\.com\/[^\"]*\.mp4[^\"]*)\"/i,
    /\"url\"\s*:\s*\"(https:\/\/cdn\.loom\.com\/[^\"]+)\"/i,
    /(https:\/\/cdn\.loom\.com\/sessions\/[^\"'\s]+\.mp4[^\"'\s]*)/i,
    /(https:\/\/cdn\.loom\.com\/[^\"]+\.mp4[^\"]*)/ig, // Global search for all mp4s
  ];

  const matches = [...html.matchAll(/(https:\/\/cdn\.loom\.com\/[^"'\s]+\.mp4[^"'\s]*)/ig)];
  console.log('All MP4 URLs found:');
  for (const m of matches) {
    console.log(m[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/'));
  }
}

testLoom().catch(console.error);
