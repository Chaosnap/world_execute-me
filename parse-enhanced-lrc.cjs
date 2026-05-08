/**
 * Reads enhanced LRC (line head [mm:ss.xx] + <mm:ss.xx>word chunks)
 * → world-execute-words.json (optional legacy lane)
 * → world-execute-sync-bracket.bundle.js  (window.__SYNC_BY_BRACKET for C:\> typeLineWords)
 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const src = path.join(root, 'world-execute-me.enhanced.lrc');
const dst = path.join(root, 'world-execute-words.json');
const bracketBundle = path.join(root, 'world-execute-sync-bracket.bundle.js');

function toSec(mm, ss, frac) {
  return parseInt(mm, 10) * 60 + parseInt(ss, 10) + parseInt(frac, 10) / 100;
}

const raw = fs.readFileSync(src, 'utf8');
const lines = raw.split(/\r?\n/);
const stripRe = /<(\d{1,2}):(\d{2})\.(\d{2})>([^<\r\n]*)/g;

const events = [];
/** @type {Record<string, Array<{t:number,word:string}>>} */
const syncBracket = {};

let firstPhrase = true;

for (const line of lines) {
  const t = line.trim();
  if (!t || /^(\[ar:|\[al:|\[ti:|\[id:|\[by:|\[length)/i.test(t)) continue;

  const headMatch = line.match(/^\[(\d{1,2}):(\d{2})\.(\d{2})\]/);
  if (!headMatch) continue;
  const lineBracketSec = +toSec(headMatch[1], headMatch[2], headMatch[3]).toFixed(3);

  const words = [];
  let m;
  while ((m = stripRe.exec(line)) !== null) {
    const sec = +toSec(m[1], m[2], m[3]).toFixed(3);
    const word = (m[4] || '').trim();
    if (!word.length) continue;
    words.push({ t: sec, word });
  }
  stripRe.lastIndex = 0;

  if (words.length === 0) continue;

  syncBracket[String(lineBracketSec)] = words.map(w => ({ t: w.t, word: w.word }));

  if (!firstPhrase) {
    events.push({ clear: true, t: words[0].t });
  }
  firstPhrase = false;
  words.forEach(w => events.push(w));
}

fs.writeFileSync(dst, JSON.stringify({ events }, null, 2));
fs.writeFileSync(
  bracketBundle,
  `window.__SYNC_BY_BRACKET = ${JSON.stringify(syncBracket)};\n`,
);
console.log('wrote', dst, '(' + events.length + ' karaoke cells)');
console.log('wrote', bracketBundle, '(' + Object.keys(syncBracket).length + ' lyric lines keyed by [mm:ss.xx])');
