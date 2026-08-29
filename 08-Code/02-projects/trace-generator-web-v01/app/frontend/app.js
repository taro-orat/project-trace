const result = document.getElementById("result");
const parameterFields = ["intensity", "instability", "persistence", "distance"];
const narrativeOutputWarningTokens = 700;
const narrativeMaxOutputTokens = 1400;

function lines(id) {
  return document.getElementById(id).value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function formatResult(mode, data) {
  const usage = data.actual_usage;
  const usageText = usage
    ? [
        `实际输入：${usage.input_tokens} tokens`,
        `实际输出：${usage.output_tokens} tokens`,
        `总计：${usage.total_tokens} tokens`,
        `实际估算成本：$${Number(usage.estimated_cost_usd).toFixed(6)}`,
      ].join("\n")
    : "";
  if (mode === "Parameter Mode" && data.output?.ai_parameters) {
    const ai = data.output.ai_parameters;
    const human = data.output.human_parameters;
    return `${usageText}\n\n${JSON.stringify({
      ai_parameters: Object.fromEntries(parameterFields.map((field) => [field, ai[field]])),
      human_parameters: Object.fromEntries(parameterFields.map((field) => [field, human[field]])),
    }, null, 2)}`;
  }
  if (mode === "Narrative Mode" && data.output?.ai_output) {
    return `${usageText}\n\n${JSON.stringify(data.output.ai_output, null, 2)}`;
  }
  return JSON.stringify(data, null, 2);
}

document.getElementById("generate").addEventListener("click", async () => {
  const request = {
    mode: document.getElementById("mode").value,
    memory: document.getElementById("memory").value.trim(),
    creative_lock: lines("creative-lock"),
    must_avoid: lines("must-avoid"),
  };
  if (!request.memory) {
    result.textContent = "请输入一段记忆。";
    return;
  }
  try {
    const preflightResponse = await fetch("/api/preflight", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(request)});
    const preflight = await preflightResponse.json();
    const costSummary = request.mode === "Narrative Mode"
      ? [
          `预计输入：${preflight.input_tokens} tokens`,
          `输出预警线：${narrativeOutputWarningTokens} tokens`,
          `最大允许输出：${narrativeMaxOutputTokens} tokens`,
          `预计最大成本：$${Number(preflight.estimated_max_cost_usd).toFixed(6)}`,
          "",
          `Narrative 模式建议将输出控制在 ${narrativeOutputWarningTokens} tokens 左右；系统最多允许 ${narrativeMaxOutputTokens} tokens。预计最大成本按 ${narrativeMaxOutputTokens} tokens 计算。是否继续生成？`,
        ].join("\n")
      : [
          `预计输入：${preflight.input_tokens} tokens`,
          `最大输出：${preflight.max_output_tokens} tokens`,
          `预计最大成本：$${Number(preflight.estimated_max_cost_usd).toFixed(6)}`,
        ].join("\n");
    if (!preflightResponse.ok || !window.confirm(costSummary)) return;
    const generateResponse = await fetch("/api/generate", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({...request, confirmation_id: preflight.confirmation_id})});
    const generated = await generateResponse.json();
    result.textContent = formatResult(request.mode, generated);
  } catch (error) {
    result.textContent = "请求失败，请检查后端服务。";
  }
});
