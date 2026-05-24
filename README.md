# world.execute(me);

Interactive visual experience synced to **Mili — world.execute(me);**.

Click the overlay to start. Audio and visuals run in the browser — no build step required.

## Run locally

```bash
# any static file server works, e.g.:
python3 -m http.server 8080
# open http://localhost:8080
```

> Use a local server (not `file://`) so the browser can load audio reliably.

## Files

| File | Role |
|------|------|
| `index.html` | Main experience (timeline, visuals, audio sync) |
| `world-execute-sync-bracket.bundle.js` | Per-bracket word timing for visual FX |
| `assets/world-execute-me.mp3` | Audio track |

Optional dev/source:

| File | Role |
|------|------|
| `world-execute-me.enhanced.lrc` | Enhanced LRC source |
| `world-execute-words.json` | Word-level event timeline |
| `lrc-to-words.cjs` / `parse-enhanced-lrc.cjs` | LRC → JSON converters |

## Keyboard (during playback)

- `[` / `]` — adjust lyric offset ±50ms
- `\` — reset lyric offset
- `1` / `7` / `5` / `3` — playback rate 1× / 0.75× / 0.5× / 0.33×
- `Space` — pause / resume

## Credits

Song: **world.execute(me);** by Mili. This project is a fan visualization, not affiliated with Mili.
