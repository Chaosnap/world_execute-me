#!/usr/bin/env node
// Parses the enhanced LRC (per-word timestamps in <MM:SS.cc> markers) and
// emits world-execute-words.json with { events: [{t, word, line?}] }.
//
// LRC format:
//   [00:34.54]<00:35.05>Then <00:35.31>I <00:35.43>will ...
//
// Output schema (matches the established WORD_EVENTS contract):
//   { "events": [
//       { "t": 35.05, "word": "Then", "line": 34.54 },
//       { "t": 35.31, "word": "I",    "line": 34.54 },
//       ...
//       { "t": <last word + 0.05>, "br": true, "line": 34.54 },
//       ...
//     ]
//   }
//
// Notes:
//   - "br" event between consecutive lyric lines so the karaoke lane wraps
//     to a new visual row at the right beat.
//   - "line" annotates each event with the lyric line it belongs to (the
//     bracketed line-start time). Useful for debugging / future filters.
//   - Empty lines and metadata lines (`[id:...]`, etc) are ignored.

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'assets', 'world-execute-me.enhanced.lrc');
const DST = path.join(__dirname, 'world-execute-words.json');

function parseTime(mm, ss) { return parseInt(mm, 10) * 60 + parseFloat(ss); }

const text = fs.readFileSync(SRC, 'utf8');
const events = [];
let lineCount = 0;

for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // skip metadata: [tag: value] (no number after the colon)
    if (/^\[[a-zA-Z]/.test(line)) continue;

    // grab line-start [MM:SS.cc]
    const lineMatch = line.match(/^\[(\d{1,3}):(\d{2}(?:\.\d+)?)\]/);
    if (!lineMatch) continue;
    const lineTime = parseTime(lineMatch[1], lineMatch[2]);
    const body = line.slice(lineMatch[0].length);
    if (!body) continue;

    // walk word markers <MM:SS.cc>WORD
    const wordRe = /<(\d{1,3}):(\d{2}(?:\.\d+)?)>([^<]+)/g;
    let lineEvents = [];
    let m;
    while ((m = wordRe.exec(body)) !== null) {
        const t = parseTime(m[1], m[2]);
        // strip leading/trailing whitespace from the chunk; keep punctuation
        const word = m[3].replace(/^\s+|\s+$/g, '');
        if (!word) continue;
        lineEvents.push({ t: +t.toFixed(3), word, line: +lineTime.toFixed(3) });
    }
    // fallback: no word markers — treat the whole body as one word at line time
    if (lineEvents.length === 0) {
        const word = body.replace(/^\s+|\s+$/g, '');
        if (word) lineEvents.push({ t: +lineTime.toFixed(3), word, line: +lineTime.toFixed(3) });
    }

    // line-break between consecutive lines (small +50ms after last word)
    if (events.length > 0 && lineEvents.length > 0) {
        const lastLineTime = events[events.length - 1].line;
        if (lastLineTime !== +lineTime.toFixed(3)) {
            const lastWordT = events[events.length - 1].t;
            events.push({ t: +(lastWordT + 0.05).toFixed(3), br: true, line: lastLineTime });
        }
    }
    for (const ev of lineEvents) events.push(ev);
    lineCount++;
}

const out = { source: 'enhanced LRC (Mili - world.execute(me))', lineCount, eventCount: events.length, events };
fs.writeFileSync(DST, JSON.stringify(out, null, 2));
console.log(`wrote ${DST}: ${events.length} events across ${lineCount} lyric lines`);
