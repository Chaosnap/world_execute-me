#!/usr/bin/env node
// V6.1.3: animation-window auditor.
// Parses index.html, extracts the `timeline = [...]` events, walks each
// animation function and estimates its on-screen lifetime (max of its
// setTimeout(... remove/fade) calls + its longest CSS @keyframes/animation
// duration referenced inside). Then for every event computes the window
// (next event start - this event start) and flags animations that overflow.
//
// Output: a markdown table sorted by overflow severity (worst first), plus
// a CSV (audit-results.csv) for piping.

const fs = require('fs');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// --- 1. Extract timeline events ----------------------------------------------
const timelineMatch = HTML.match(/const\s+timeline\s*=\s*\[([\s\S]*?)\n\s*\]\s*;/);
if (!timelineMatch) { console.error('timeline not found'); process.exit(1); }
const tlBody = timelineMatch[1];

// Each event line: { time: 12.34, func: someName, args: {...} }
const eventRe = /\{\s*time:\s*([\d.]+)\s*,\s*func:\s*([A-Za-z_$][\w$]*)\s*(?:,\s*args:\s*\{([^}]*)\})?\s*\}/g;
const events = [];
let m;
while ((m = eventRe.exec(tlBody)) !== null) {
    const time = parseFloat(m[1]);
    const fn = m[2];
    const args = m[3] || '';
    let label = '';
    const textMatch = args.match(/text:\s*"([^"]+)"/);
    if (textMatch) label = textMatch[1];
    const onCompleteMatch = args.match(/onComplete:\s*([A-Za-z_$][\w$]*)/);
    const onComplete = onCompleteMatch ? onCompleteMatch[1] : null;
    events.push({ time, fn, args, label, onComplete });
}
console.error(`parsed ${events.length} timeline events`);

// --- 2. For each function name, find its body and estimate lifetime ----------
function findFnBody(name) {
    // Match `function NAME(...)` and capture balanced braces.
    const startRe = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`, 'g');
    const start = startRe.exec(HTML);
    if (!start) return null;
    let i = start.index + start[0].length;
    let depth = 1;
    while (i < HTML.length && depth > 0) {
        const c = HTML[i++];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '/' && HTML[i] === '/') { while (i < HTML.length && HTML[i] !== '\n') i++; }
        else if (c === '/' && HTML[i] === '*') { i++; while (i < HTML.length && !(HTML[i] === '*' && HTML[i+1] === '/')) i++; i += 2; }
        else if (c === '"' || c === "'" || c === '`') {
            const q = c;
            while (i < HTML.length && HTML[i] !== q) { if (HTML[i] === '\\') i++; i++; }
            i++;
        }
    }
    return HTML.slice(start.index, i);
}

// Find the longest setTimeout(...,N) numeric in a function body.
function maxSetTimeoutMs(body) {
    if (!body) return 0;
    const re = /setTimeout\([^,]+?,\s*(\d+(?:\.\d+)?)\s*\)/g;
    let max = 0; let m;
    while ((m = re.exec(body)) !== null) {
        const v = parseFloat(m[1]);
        if (v > max) max = v;
    }
    return max;
}

// Find max addClass({...,duration:N})
function maxAddClassMs(body) {
    if (!body) return 0;
    const re = /addClass\(\s*\{[^}]*duration:\s*(\d+(?:\.\d+)?)/g;
    let max = 0; let m;
    while ((m = re.exec(body)) !== null) {
        const v = parseFloat(m[1]);
        if (v > max) max = v;
    }
    return max;
}

// Find max `animation: name Xs/ms ... [delay Ys/ms]` referenced in BODY (CSS strings inside JS).
// And cross-reference any class names assigned in body with the global CSS rules
// for that class; sum animation duration + delay.
function cssAnimationMs(body) {
    if (!body) return 0;
    let max = 0;
    // 2a. inline CSS strings inside JS like "animation: foo 0.5s 0.2s ..."
    const inlineRe = /animation\s*:\s*([^;'"`]+)/g;
    let m;
    while ((m = inlineRe.exec(body)) !== null) {
        const v = parseAnimDecl(m[1]);
        if (v > max) max = v;
    }
    // 2b. class names assigned via .className = '...' or classList.add('...')
    const classNames = new Set();
    const cnRe1 = /className\s*=\s*['"`]([^'"`]+)['"`]/g;
    while ((m = cnRe1.exec(body)) !== null) m[1].split(/\s+/).forEach(c => classNames.add(c));
    const cnRe2 = /classList\.add\(\s*['"`]([^'"`]+)['"`]/g;
    while ((m = cnRe2.exec(body)) !== null) m[1].split(/\s+/).forEach(c => classNames.add(c));
    // also className assignments via concatenation: `flash.className = 'hk-code-flash';`
    // already caught by cnRe1.
    for (const cn of classNames) {
        if (!cn) continue;
        const v = maxAnimForClass(cn);
        if (v > max) max = v;
    }
    return max;
}

function parseAnimDecl(decl) {
    // Look for two time tokens (duration + delay). Any 0+ → ignored.
    const tokens = decl.split(/[,\s]+/).filter(Boolean);
    let times = [];
    for (const t of tokens) {
        const m1 = /^(\d+(?:\.\d+)?)(s|ms)$/.exec(t);
        if (m1) {
            const v = parseFloat(m1[1]) * (m1[2] === 's' ? 1000 : 1);
            times.push(v);
        }
    }
    // duration is first time, delay is second (if present)
    if (times.length === 0) return 0;
    const dur = times[0];
    const del = times[1] || 0;
    return dur + del;
}

// Search the whole HTML CSS for `.classname` rules and pick max animation total.
function maxAnimForClass(cn) {
    // very permissive: find all `selector { ... animation:... }` blocks where selector contains .cn
    const re = new RegExp(`\\.${cn.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}[^,{]*\\{([^{}]+)\\}`, 'g');
    let max = 0; let m;
    while ((m = re.exec(HTML)) !== null) {
        const block = m[1];
        const animRe = /animation\s*:\s*([^;]+)/g;
        let am;
        while ((am = animRe.exec(block)) !== null) {
            const v = parseAnimDecl(am[1]);
            if (v > max) max = v;
        }
    }
    return max;
}

// Composite estimate for a function: max of setTimeout / addClass / referenced CSS
function estimateLifetimeMs(name) {
    const body = findFnBody(name);
    if (!body) return null;
    const a = maxSetTimeoutMs(body);
    const b = maxAddClassMs(body);
    const c = cssAnimationMs(body);
    return Math.max(a, b, c);
}

// --- 3. Walk events, compute windows -----------------------------------------
// Two windows:
//   nextLyric_ms — until the NEXT lyric beat (typeLine / typeLineDecay /
//                  showEmphasis / showChaosText) in the same direction.
//                  Relevant for inline lyric-bound effects: if the animation
//                  overflows this window, it visually competes with the next
//                  spoken line.
//   nextClear_ms — until the NEXT clearScreenAndShapes (or end-of-song).
//                  Relevant for stage animations whose lifetime extends past
//                  several lyrics (e.g. drawSineWave, uniteEffect, BSOD, ...).
//
// We compare:
//   - typeLine/typeLineDecay/showEmphasis/showChaosText → use nextLyric_ms (the
//       "abrupt cut" the user described)
//   - everything else (stage animations) → use nextClear_ms
const LYRIC_FNS = new Set(['typeLine', 'typeLineDecay', 'showEmphasis', 'showChaosText']);
const STRUCT_FNS = new Set(['clearScreenAndShapes', 'startBinaryRain', 'stopBinaryRain', 'startBootLog', 'stopBootLog', 'showBSOD', 'hideBSOD', 'showReboot', 'hideReboot', 'initAmbient']);

// next lyric / clear lookups
const nextLyricAt = new Array(events.length).fill(Infinity);
const nextClearAt = new Array(events.length).fill(Infinity);
{
    let lastLyric = Infinity, lastClear = Infinity;
    for (let i = events.length - 1; i >= 0; i--) {
        nextLyricAt[i] = lastLyric;
        nextClearAt[i] = lastClear;
        if (LYRIC_FNS.has(events[i].fn)) lastLyric = events[i].time;
        if (events[i].fn === 'clearScreenAndShapes') lastClear = events[i].time;
    }
}

const lifetimes = new Map(); // fn -> ms
function lifetimeOf(fn) {
    if (lifetimes.has(fn)) return lifetimes.get(fn);
    const v = estimateLifetimeMs(fn);
    lifetimes.set(fn, v);
    return v;
}

const rows = [];
for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (STRUCT_FNS.has(ev.fn)) continue;

    // For typeLine/typeLineDecay/showEmphasis/showChaosText, the operative
    // window is the next-lyric (next visible spoken line). For stage animations,
    // it is the next clearScreenAndShapes.
    const isLyric = LYRIC_FNS.has(ev.fn);
    const winMs = isLyric
        ? Math.max(0, (nextLyricAt[i] - ev.time) * 1000)
        : Math.max(0, (nextClearAt[i] - ev.time) * 1000);

    // For typeLine/typeLineDecay, lifetime is dominated by the typing time +
    // onComplete sub-animation if any. Approximate type duration as text
    // length × 32ms (adaptive shrinks, never extends).
    let life = lifetimeOf(ev.fn) ?? 0;
    if (ev.fn === 'typeLine' || ev.fn === 'typeLineDecay') {
        const typeLen = ev.label.length;
        const typeMs = typeLen * 32;
        life = typeMs;
        if (ev.onComplete) {
            const subLife = lifetimeOf(ev.onComplete) ?? 0;
            life = Math.max(life, subLife);
        }
    } else if (ev.fn === 'showEmphasis' && ev.onComplete) {
        const subLife = lifetimeOf(ev.onComplete) ?? 0;
        life = Math.max(life, subLife);
    }

    const nextLyricMs = Math.round(Math.max(0, (nextLyricAt[i] - ev.time) * 1000));
    const nextClearMs = Math.round(Math.max(0, (nextClearAt[i] - ev.time) * 1000));

    rows.push({
        idx: i,
        t: ev.time.toFixed(2),
        fn: ev.fn + (ev.onComplete ? `→${ev.onComplete}` : ''),
        kind: isLyric ? 'lyric' : 'stage',
        label: ev.label.slice(0, 38),
        nextLyricMs,
        nextClearMs,
        lifeMs: Math.round(life),
        // delta vs whichever window we deem "primary"
        delta: Math.round(life - winMs),
        // delta vs next-clear (will it get wiped abruptly?)
        clearDelta: Math.round(life - nextClearMs),
    });
}

// Two reports:
// (A) "Real cuts" — animations whose lifetime exceeds the next clearScreen.
//     These genuinely get truncated by a screen wipe (the user's complaint).
// (B) "Lyric collisions" — lyric-onComplete effects whose lifetime exceeds
//     the time to the next lyric. May or may not be a real visual issue
//     depending on whether the stage decoratively persists; treat as advisory.

const realCuts   = rows.filter(r => r.clearDelta > 0).sort((a, b) => b.clearDelta - a.clearDelta);
const lyricColl  = rows.filter(r => r.delta > 0 && r.clearDelta <= 0).sort((a, b) => b.delta - a.delta);

console.log('# Real Cuts (life > nextClear) — these get truncated by clearScreenAndShapes\n');
if (realCuts.length === 0) {
    console.log('_(none)_\n');
} else {
    console.log('| # | songTime | event | label | kind | nextClear | life | Δclear |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (const r of realCuts) {
        const flag = r.clearDelta > 200 ? ' 🔴' : ' 🟡';
        console.log(`| ${r.idx} | ${r.t} | ${r.fn} | ${r.label} | ${r.kind} | ${r.nextClearMs} | ${r.lifeMs} | ${r.clearDelta}${flag} |`);
    }
}

console.log('\n# Lyric Collisions (life > nextLyric, but nextClear OK) — animation may visually overlap with subsequent lyric\n');
if (lyricColl.length === 0) {
    console.log('_(none)_\n');
} else {
    console.log('| # | songTime | event | label | nextLyric | nextClear | life | Δlyric |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (const r of lyricColl.slice(0, 20)) {
        const flag = r.delta > 1000 ? ' 🔴' : ' 🟡';
        console.log(`| ${r.idx} | ${r.t} | ${r.fn} | ${r.label} | ${r.nextLyricMs} | ${r.nextClearMs} | ${r.lifeMs} | ${r.delta}${flag} |`);
    }
    if (lyricColl.length > 20) console.log(`\n_(+ ${lyricColl.length - 20} more — see CSV)_`);
}

// CSV side-output
const csv = ['idx,time,fn,label,kind,next_lyric_ms,next_clear_ms,life_ms,delta_lyric_ms,delta_clear_ms', ...rows.map(r =>
    [r.idx, r.t, r.fn, JSON.stringify(r.label), r.kind, r.nextLyricMs, r.nextClearMs, r.lifeMs, r.delta, r.clearDelta].join(',')
)].join('\n');
fs.writeFileSync(path.join(__dirname, 'audit-results.csv'), csv);
console.error(`wrote audit-results.csv (${rows.length} rows)`);
console.error(`real cuts: ${realCuts.length}, lyric collisions: ${lyricColl.length}`);

