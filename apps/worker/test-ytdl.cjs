const youtubedl = require('youtube-dl-exec');

async function test() {
  try {
    console.log("Fetching format info...");
    const info = await youtubedl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      dumpJson: true,
      noWarnings: false,
      extractorArgs: 'youtube:player_client=android,web',
    });
    
    console.log("Available formats:");
    info.formats.forEach(f => {
      console.log(`${f.format_id} - ${f.ext} - ${f.resolution || f.width + 'x' + f.height} - ${f.format_note}`);
    });
    
    console.log("\nBest video format: ", info.format);
  } catch(e) {
    console.error(e);
  }
}

test();
