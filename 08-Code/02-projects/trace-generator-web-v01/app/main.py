import logging
import secrets
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import engine


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("trace-generator-web")
app = FastAPI(title="Trace Generator Web v0.1")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="frontend-assets")
_confirmations = {}
CONFIRMATION_TTL_SECONDS = 300


class GenerateRequest(BaseModel):
    mode: str = Field(pattern="^(Narrative Mode|Parameter Mode)$")
    memory: str = Field(min_length=1)
    creative_lock: list[str] = []
    must_avoid: list[str] = []
    confirmation_id: str


class PreflightRequest(BaseModel):
    mode: str = Field(pattern="^(Narrative Mode|Parameter Mode)$")
    memory: str = Field(min_length=1)
    creative_lock: list[str] = []
    must_avoid: list[str] = []


@app.get("/")
def index():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok"}


def _prompt_for(request):
    if request.mode == "Parameter Mode":
        return engine.build_parameter_prompt(request.memory, request.creative_lock, request.must_avoid), engine.PARAMETER_SCHEMA, engine.PARAMETER_MAX_OUTPUT_TOKENS
    return engine.build_trace_prompt(request.memory, request.creative_lock, request.must_avoid), engine.TRACE_SCHEMA, engine.MAX_OUTPUT_TOKENS


@app.post("/api/preflight")
def preflight(request: PreflightRequest):
    prompt, schema, max_tokens = _prompt_for(request)
    try:
        estimate = engine.estimate_cost(prompt, schema, max_tokens)
    except Exception as error:
        logger.exception("Preflight failed: %s", error)
        raise HTTPException(status_code=503, detail="成本预检暂时不可用。") from error
    confirmation_id = secrets.token_urlsafe(24)
    _confirmations[confirmation_id] = {"expires": time.monotonic() + CONFIRMATION_TTL_SECONDS,
                                       "mode": request.mode, "memory": request.memory}
    return {"confirmation_id": confirmation_id, **estimate}


def _consume_confirmation(request):
    record = _confirmations.pop(request.confirmation_id, None)
    if not record or record["expires"] < time.monotonic():
        raise HTTPException(status_code=400, detail="confirmation_id 无效或已过期。")
    if record["mode"] != request.mode or record["memory"] != request.memory:
        raise HTTPException(status_code=400, detail="confirmation_id 与请求不匹配。")


@app.post("/api/generate")
def generate(request: GenerateRequest):
    _consume_confirmation(request)
    try:
        if request.mode == "Parameter Mode":
            prompt = engine.build_parameter_prompt(request.memory, request.creative_lock, request.must_avoid)
            result, actual_usage = engine.call_structured_ai(prompt, "trace_parameters", engine.PARAMETER_SCHEMA, engine.PARAMETER_MAX_OUTPUT_TOKENS)
            import json
            parameters = engine.validate_parameter_output(json.loads(result))
            payload = engine.build_parameter_payload(request.memory, request.creative_lock, request.must_avoid, parameters)
            output_path = engine.save_output_json(engine.unique_filename("parameter"), payload)
            return {"mode": "Parameter Mode", "output": payload, "actual_usage": actual_usage, "saved_to": output_path.name}
        prompt = engine.build_trace_prompt(request.memory, request.creative_lock, request.must_avoid)
        result, actual_usage = engine.call_structured_ai(prompt, "trace_analysis", engine.TRACE_SCHEMA, engine.MAX_OUTPUT_TOKENS)
        import json
        trace = json.loads(result)
        payload = {"input": {"memory": request.memory,
                              "creative_lock": {"source": "user", "items": request.creative_lock},
                              "must_avoid": {"source": "user", "items": request.must_avoid}},
                   "ai_output": trace}
        output_path = engine.save_output_json(engine.unique_filename("trace"), payload)
        return {"mode": "Narrative Mode", "output": payload, "actual_usage": actual_usage, "saved_to": output_path.name}
    except engine.IncompleteNarrativeOutputError as error:
        logger.exception("Narrative output incomplete: %s", error)
        raise HTTPException(status_code=502, detail="Narrative 输出不完整，已达到输出上限。") from error
    except Exception as error:
        logger.exception("Generate failed: %s", error)
        raise HTTPException(status_code=502, detail="AI 生成失败，请查看后端日志。") from error


@app.get("/api/latest-parameters")
def latest_parameters():
    files = list(engine.OUTPUTS_DIR.glob("parameter-*.json"))
    if not files:
        raise HTTPException(status_code=404, detail="尚无 Parameter 文件。")
    latest = max(files, key=lambda path: path.name)
    try:
        import json
        payload = json.loads(latest.read_text(encoding="utf-8"))
        raw_ai = payload["ai_parameters"]
        raw_human = payload["human_parameters"]
        ai = engine.validate_parameter_output({field: raw_ai[field] for field in engine.PARAMETER_FIELDS})
        human = engine.validate_parameter_output({field: raw_human[field] for field in engine.PARAMETER_FIELDS})
    except Exception as error:
        logger.exception("Latest parameter file invalid: %s", error)
        raise HTTPException(status_code=500, detail="最新 Parameter 文件无效。") from error
    return {"memory": payload.get("input", {}).get("memory", ""),
            "constraints": {"creative_lock": payload.get("input", {}).get("creative_lock", {}).get("items", []),
                            "must_avoid": payload.get("input", {}).get("must_avoid", {}).get("items", [])},
            "ai_parameters": ai, "human_parameters": human}
