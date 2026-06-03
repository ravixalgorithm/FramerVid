import youtubedl from 'youtube-dl-exec';
import path from 'path';

async function test() {
  try {
    console.log('Downloading video...');
    const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo"
    const out = path.join(process.cwd(), 'test-dl.mp4');
    
    await youtubedl(url, {
      output: out,
      format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      noCheckCertificates: true,
      noWarnings: true,
      extractorArgs: 'youtube:player_client=android,web',
    });
    
    console.log('Success! Saved to:', out);
  } catch (error) {
    console.error('Download failed:', error);
  }
}

test();
