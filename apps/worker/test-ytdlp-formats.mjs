import youtubedl from 'youtube-dl-exec';
import fs from 'fs/promises';

async function run() {
  try {
    const info = await youtubedl('https://www.loom.com/share/154d490ed66b4187986d6295a48a4414', {
      dumpJson: true,
      noWarnings: true
    });
    await fs.writeFile('loom-info.json', JSON.stringify(info, null, 2));
    console.log('Saved loom-info.json');
  } catch (e) {
    console.error('Error:', e.message);
  }
}
run();
