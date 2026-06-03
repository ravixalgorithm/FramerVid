import { parseDeepgramUtterances, utterancesToVtt } from './app/lib/deepgram-vtt';

const payload = {
  results: {
    utterances: [
      { start: 0, end: 1, transcript: 'Hello world' },
      { start: 1, end: 2, transcript: 'Testing captions' }
    ]
  }
};

const utterances = parseDeepgramUtterances(payload);
console.log('Utterances parsed:', utterances.length);
console.log('VTT Output:', utterancesToVtt(utterances));
