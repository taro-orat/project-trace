# interactive-trace-v09

v05 = Material & Sensory stable base.

v09 = v05 + reliable Web Bridge.

v06 was the Day 10 Web Bridge experiment and is not the code baseline for v09.

## Day 14 Ugly Final Status

v09 is a complete but rough functional prototype for Case01, “Traces of Disappearance” (`消逝的痕迹`). It is a diagnostic Ugly Final, not the final artwork and not the formal System01.

### Confirmed capabilities — PASS

- Existing input, Behaviour, Media, gathering, carry, residual and re-entry mechanisms can run together.
- The following lifecycle handoff was manually repeated successfully and recorded by Trace Log v0.2:

  ```text
  STAYING → MOVING → STOP_LEAVE → RESIDUAL_FROZEN
  → CARRY_ASSIGNED → STAYING → REENTRY_DETECTED → STOP_BEGIN
  ```

- Sound works as a technical read-only layer; no reverse pollution of Behaviour was found.
- Trace Log v0.2 records event-driven lifecycle and performance observations without per-frame logging.

### Unconfirmed capabilities — INCONCLUSIVE

- The formal exported Trace began while already in `STAYING`, so it does not prove a complete `OUTSIDE → MOVING → STAYING` run.
- `fragments` and `imprints` increased during the observed run, but the long-run test ended early. Final performance failure was not established.
- The final long-run stability threshold remains untested.

### Known limitations — FAIL / INCONCLUSIVE

- The current oscillator / fixed-frequency Sound is a technical placeholder and is not an acceptable formal Case01 sound solution (**FAIL**).
- The Debug HUD is for diagnosis only and must not become part of the formal Case01 visual (**FAIL**).
- Camera heuristic, fragment / imprint lifecycle, visual system, Web Bridge and overall Behaviour architecture remain prototype limitations (**INCONCLUSIVE as long-term solutions**).

### Trace Log v0.2

The browser Console exposes:

```js
window.exportTraceLog()
window.clearTraceLog()
```

`exportTraceLog()` returns formatted JSON and logs the complete trace once. `clearTraceLog()` clears the in-memory trace and records a new `TRACE_RESET` event.

The available event names are:

```text
RUN_START
INPUT_SOURCE_CHANGE
STATE_CHANGE
STOP_BEGIN
STOP_LEAVE
CARRY_ASSIGNED
RESIDUAL_FROZEN
REENTRY_DETECTED
STOP_SUMMARY
SOUND_UNLOCKED
SOUND_UNAVAILABLE
PERFORMANCE_SAMPLE
TRACE_RESET
```

### Day 15 boundary

Day 15 will not continue patching v09. No Behaviour, visual, Sound, Camera, Media, Web Bridge or fragment-lifecycle rebuild is planned in this prototype.

The next stage starts two independent projects in Mac Documents:

1. An AI Systems project beginning with `System01`, followed by `System02 / 03 / 04`, for reusable Input, Interpretation, Behaviour, Renderer, Media, Sound and Logging / Observability modules.
2. A new Project Trace Rebuild for Case01, “Traces of Disappearance,” which will call System01 and separately own its Concept, Research, Assets, Creative Direction, case-specific logic and documentation.

The existing Project Trace remains the historical project. v09 is closed as an Ugly Final diagnostic prototype.

## Getting Started

Open `index.html` in your web browser and start editing `sketch.js`.

## Running Locally

For the Day 11 bridge, run the FastAPI backend on `http://localhost:8000` and
serve this folder separately on `http://localhost:5500`:

```bash
# From this folder
python -m http.server 5500

# Using Node.js
npx http-server

# Or use the VS Code Live Server extension on port 5500
# Right-click index.html -> "Open with Live Server"
```

## Resources

- [p5.js 2.0](https://beta.p5js.org/)
- [p5.js Reference](https://p5js.org/reference/)
