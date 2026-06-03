import youtubedl from 'youtube-dl-exec';
import util from 'util';

async function run() {
  try {
    const info = await youtubedl('https://www.loom.com/share/154d490ed66b4187986d6295a48a4414', {
      dumpJson: true,
      noWarnings: true
    });
    console.log(info.title);
    console.log(info.url);
    console.log(info.duration);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
run();
