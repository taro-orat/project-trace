# trace-generator-web-v02

Day 11 copy of the FastAPI backend with a fixed four-parameter bridge contract.

Run from this directory:

```bash
uv run uvicorn app.main:app --host localhost --port 8000
```

The v07 p5.js client is served separately on port 5500 and reads
`GET /api/latest-parameters` from this backend.
