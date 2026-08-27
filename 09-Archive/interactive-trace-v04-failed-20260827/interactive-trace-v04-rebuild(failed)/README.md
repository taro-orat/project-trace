# interactive-trace-v04-rebuild

This rebuild starts from the stable v03 state machine and keeps its moving,
staying, leaving, carry, residual, fade, and memory behavior as the baseline.

Ambient Human and AI traces are independent source elements sharing a dense
legacy spatial grid. Each source has a stable `sourceId` and `sourceType`.
Distance selects real sources into one imprint; the source is crossfaded from
its captured visible position into the existing imprint target. Fragmentation
adds target gaps/displacement, while persistence only affects the carried
source cluster. `uncertainty` remains present in the JSON but is intentionally
unused in this rebuild.

The first sound pass is deliberately quiet and minimal. Click or tap once to
enable it: low triangle/sine tones represent Human, AI, and carried states.

## Getting Started

Open `index.html` in your web browser and start editing `sketch.js`.

## Running Locally

For projects with media files, use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Using VS Code Live Server extension
# Right-click index.html -> "Open with Live Server"
```

## Resources

- [p5.js 2.0](https://beta.p5js.org/)
- [p5.js Reference](https://p5js.org/reference/)
