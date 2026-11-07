// Provider-agnostic LLM execution adapter with PII redaction, context restriction, and token/spend logging.
// Uses Node 24 native fetch. Never embeds API keys in code.

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const UK_PHONE_RE = /(?:\+44\s?7\d{3}|\(?07\d{3}\)?|\+44\s?[12]\d{2,3}|\(?0[12]\d{2,3}\)?)\s?\d{3}\s?\d{3,4}\b/g;
const NI_NUMBER_RE = /\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi;
const SORT_CODE_RE = /\b\d{2}-\d{2}-\d{2}\b/g;
const CARD_OR_ACCOUNT_RE = /\b(?:\d[ -]*?){13,19}\b/g;

// Conservative per-1k-token GBP pricing table for spend-cap enforcement
export const MODEL_PRICING_GBP_PER_1K = {
  'gpt-4o-mini': { input: 0.00012, output: 0.00048 },
  'gpt-4o': { input: 0.002, output: 0.008 },
  'claude-3-5-haiku-latest': { input: 0.00065, output: 0.0032 },
  'claude-3-5-sonnet-latest': { input: 0.0024, output: 0.012 },
  'gemini-2.5-flash': { input: 0.00012, output: 0.00048 },
  default: { input: 0.001, output: 0.003 }
};

export function estimateTokens(text = '') {
  return Math.max(1, Math.ceil(String(text).length / 4));
}

export function estimateCostGbp(model, promptTokens, completionTokens) {
  const rates = MODEL_PRICING_GBP_PER_1K[model] || MODEL_PRICING_GBP_PER_1K.default;
  const cost = (promptTokens / 1000) * rates.input + (completionTokens / 1000) * rates.output;
  return Number(cost.toFixed(6));
}

export function redactPersonalData(input, options = {}) {
  let redactionCount = 0;
  const countReplace = (str, regex, replacement) =>
    str.replace(regex, () => {
      redactionCount++;
      return replacement;
    });

  const scrubString = value => {
    let out = String(value);
    out = countReplace(out, EMAIL_RE, '[REDACTED_EMAIL]');
    out = countReplace(out, UK_PHONE_RE, '[REDACTED_PHONE]');
    out = countReplace(out, NI_NUMBER_RE, '[REDACTED_NI]');
    out = countReplace(out, SORT_CODE_RE, '[REDACTED_SORT_CODE]');
    out = countReplace(out, CARD_OR_ACCOUNT_RE, '[REDACTED_CARD_OR_ACCOUNT]');
    return out;
  };

  const SENSITIVE_NAME_KEYS = new Set([
    'name',
    'full_name',
    'contact_name',
    'occupant_name',
    'tenant_name',
    'landlord_name',
    'reporter_name'
  ]);
  const SENSITIVE_CONTACT_KEYS = new Set(['email', 'phone', 'mobile', 'telephone', 'bank_account', 'sort_code']);

  const walk = (node, parentKey = '') => {
    if (node === null || node === undefined) return node;
    if (typeof node === 'string') {
      return scrubString(node);
    }
    if (Array.isArray(node)) {
      return node.map(item => walk(item, parentKey));
    }
    if (typeof node === 'object') {
      const copy = {};
      const recordId = node.id || node.contact_id || node.occupant_id || node.landlord_id || 'anon';
      for (const [k, v] of Object.entries(node)) {
        const lowerKey = k.toLowerCase();
        if (SENSITIVE_CONTACT_KEYS.has(lowerKey) && typeof v === 'string' && v.trim()) {
          redactionCount++;
          copy[k] = lowerKey.includes('email')
            ? '[REDACTED_EMAIL]'
            : lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('telephone')
              ? '[REDACTED_PHONE]'
              : lowerKey.includes('sort_code')
                ? '[REDACTED_SORT_CODE]'
                : '[REDACTED_PII]';
        } else if (
          SENSITIVE_NAME_KEYS.has(lowerKey) &&
          typeof v === 'string' &&
          v.trim() &&
          !options.allowNames
        ) {
          redactionCount++;
          copy[k] = `[CONTACT:${recordId}]`;
        } else {
          copy[k] = walk(v, lowerKey);
        }
      }
      return copy;
    }
    return node;
  };

  const redacted = walk(input);
  return {
    redacted,
    redactionCount
  };
}

export function resolveLlmConfig(employeeData = {}, env = process.env) {
  const roleLimits = employeeData.limits || {};
  const adapter =
    employeeData.executionAdapter ||
    env.LLM_ADAPTER ||
    (employeeData.model && employeeData.model !== 'local-extractive-v1' ? 'llm-provider-v1' : 'local-extractive-v1');
  const provider = (employeeData.provider || env.LLM_PROVIDER || 'openai').toLowerCase();
  const model =
    employeeData.model && employeeData.model !== 'local-extractive-v1'
      ? employeeData.model
      : env.LLM_MODEL || 'gpt-4o-mini';
  const temperature = Math.min(
    1,
    Math.max(0, Number(employeeData.temperature ?? env.LLM_TEMPERATURE ?? 0.1))
  );
  const envMaxTokens = Number(env.LLM_MAX_TOKENS || 2048);
  const roleMaxTokens = Number(roleLimits.maxTokensPerRun || 8000);
  const maxTokens = Math.min(envMaxTokens, roleMaxTokens);

  const envRunCap = Number(env.LLM_MAX_COST_PER_RUN_GBP || 0.5);
  const roleRunCap = Number(roleLimits.maxCostPerRunGbp ?? envRunCap);
  const maxCostPerRunGbp = Math.min(envRunCap, roleRunCap);

  const envDailyCap = Number(env.LLM_DAILY_SPEND_CAP_GBP || 2.5);
  const roleDailyCap = Number(roleLimits.maxDailySpendGbp ?? envDailyCap);
  const maxDailySpendGbp = Math.min(envDailyCap, roleDailyCap);

  const apiKey =
    env.LLM_API_KEY ||
    (provider === 'openai' || provider === 'compatible' ? env.OPENAI_API_KEY : undefined) ||
    (provider === 'anthropic' ? env.ANTHROPIC_API_KEY : undefined) ||
    (provider === 'gemini' ? env.GEMINI_API_KEY : undefined) ||
    null;

  const baseUrl = env.LLM_BASE_URL || null;
  const fallbackToExtractive = (env.LLM_FALLBACK_TO_EXTRACTIVE ?? 'true') !== 'false';

  return {
    adapter,
    provider,
    model,
    temperature,
    maxTokens,
    maxCostPerRunGbp,
    maxDailySpendGbp,
    apiKey,
    baseUrl,
    fallbackToExtractive
  };
}

export function buildRestrictedContext({ assignment, approvedSources, toolResults = [] }) {
  if (!Array.isArray(approvedSources) || approvedSources.length === 0) {
    throw new Error('Context restriction violation: at least one approved company source is required');
  }
  for (const s of approvedSources) {
    if (s.data?.status !== 'approved') {
      throw new Error(`Context restriction violation: source ${s.id} is not approved`);
    }
  }
  for (const tr of toolResults) {
    if (!tr || typeof tr.toolName !== 'string' || tr.verified !== true) {
      throw new Error('Context restriction violation: tool results must originate from verified read tools');
    }
  }

  let totalRedactions = 0;
  const sanitizedSources = approvedSources.map(s => {
    const { redacted, redactionCount } = redactPersonalData(s.data.text);
    totalRedactions += redactionCount;
    return {
      id: s.id,
      version: s.version,
      title: s.data.title,
      text: redacted
    };
  });

  const sanitizedTools = toolResults.map(tr => {
    const { redacted, redactionCount } = redactPersonalData(tr.data);
    totalRedactions += redactionCount;
    return {
      toolName: tr.toolName,
      data: redacted
    };
  });

  const { redacted: sanitizedObjective, redactionCount: objRedactions } = redactPersonalData(assignment.objective);
  totalRedactions += objRedactions;

  return {
    objective: sanitizedObjective,
    acceptance: assignment.acceptance,
    expectedDeliverable: assignment.expectedDeliverable || 'Sourced briefing',
    feedback: assignment.feedback || [],
    sources: sanitizedSources,
    toolResults: sanitizedTools,
    redactionCount: totalRedactions
  };
}

export function runExtractiveFallback({ assignment, approvedSources, toolResults = [] }) {
  const query = (assignment.feedback || []).at(-1) || assignment.objective;
  const terms = String(query).toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  const citations = approvedSources.map(s => {
    const passages = s.data.text.match(/[^.!?\n]+[.!?]?/g) || [s.data.text];
    const ranked = passages
      .map((quote, index) => ({
        quote: quote.trim(),
        index,
        score: terms.filter(t => quote.toLowerCase().includes(t)).length
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    return {
      id: s.id,
      version: s.version,
      title: s.data.title,
      quote: ranked[0].quote.slice(0, 1500)
    };
  });

  const toolSections = toolResults.map(
    tr => `## Tool Result: ${tr.toolName}\n\`\`\`json\n${JSON.stringify(tr.data, null, 2)}\n\`\`\``
  );

  const solicitorBanner = assignment.checkWithSolicitor
    ? ['> [CHECK WITH A SOLICITOR] Mandatory legal and owner review required before acting on financial, notice, deposit, eviction, or tenancy items.']
    : [];

  const content = [
    '# ' + (assignment.expectedDeliverable || 'Sourced briefing'),
    ...solicitorBanner,
    'Objective: ' + assignment.objective,
    'Local extractive adapter: quoted evidence, no model-generated claims.',
    ...citations.map((c, i) => `## [${i + 1}] ${c.title}\n${c.quote}`),
    ...toolSections,
    '## Acceptance criteria\n' + assignment.acceptance,
    '## Requested corrections\n' + ((assignment.feedback || []).join('\n') || 'None'),
    '## Reviewer findings\nAll findings are source quotations. Human review is required to judge completeness and resolve contradictions.'
  ].join('\n\n');

  return {
    adapter: 'local-extractive-v1',
    provider: 'local',
    model: 'local-extractive-v1',
    content,
    citations,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costGbp: 0,
    redactionCount: 0,
    fallbackUsed: false
  };
}

async function callProviderEndpoint(config, systemPrompt, userPrompt, fetchImpl = fetch) {
  if (!config.apiKey) {
    throw Object.assign(new Error('LLM API key missing in environment variables'), { code: 'MISSING_API_KEY' });
  }

  if (config.provider === 'anthropic') {
    const url = config.baseUrl || 'https://api.anthropic.com/v1/messages';
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
    const body = await res.json();
    return {
      text: body.content?.[0]?.text || '',
      promptTokens: body.usage?.input_tokens || estimateTokens(systemPrompt + userPrompt),
      completionTokens: body.usage?.output_tokens || 0
    };
  }

  if (config.provider === 'gemini') {
    const url =
      config.baseUrl ||
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': config.apiKey
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          responseMimeType: 'application/json'
        }
      })
    });
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const body = await res.json();
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      text,
      promptTokens: body.usageMetadata?.promptTokenCount || estimateTokens(systemPrompt + userPrompt),
      completionTokens: body.usageMetadata?.candidatesTokenCount || estimateTokens(text)
    };
  }

  // Default: OpenAI / OpenAI-compatible chat completions
  const url = config.baseUrl || 'https://api.openai.com/v1/chat/completions';
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });
  if (!res.ok) throw new Error(`OpenAI-compatible API error: ${res.status}`);
  const body = await res.json();
  const text = body.choices?.[0]?.message?.content || '';
  return {
    text,
    promptTokens: body.usage?.prompt_tokens || estimateTokens(systemPrompt + userPrompt),
    completionTokens: body.usage?.completion_tokens || estimateTokens(text)
  };
}

export function getWorkspaceDailySpendGbp(team, m, datePrefix = new Date().toISOString().slice(0, 10)) {
  return team
    .list(m, 'llm_run')
    .filter(r => String(r.created).startsWith(datePrefix))
    .reduce((sum, r) => sum + Number(r.data.costGbp || 0), 0);
}

export async function executeWithAdapter({
  team,
  member,
  assignmentRecord,
  employeeRecord,
  approvedSources,
  toolResults = [],
  env = process.env,
  fetchImpl = fetch
}) {
  const assignment = assignmentRecord.data;
  const config = resolveLlmConfig(employeeRecord.data, env);

  // Restrict context and redact PII before anything else
  const restricted = buildRestrictedContext({
    assignment,
    approvedSources,
    toolResults
  });

  if (config.adapter !== 'llm-provider-v1') {
    const result = runExtractiveFallback({ assignment, approvedSources, toolResults: restricted.toolResults });
    result.redactionCount = restricted.redactionCount;
    logLlmRun(team, member, assignmentRecord.id, employeeRecord.id, result);
    return result;
  }

  const systemPrompt = [
    'You are an operations AI employee for JM Letvest (UK HMO rent-to-rent management).',
    'STRICT RULES:',
    '1. Use ONLY the approved sources and verified tool results provided in the prompt.',
    '2. Every factual claim must cite an exact quote from an approved source (by id and version) or a verified tool record.',
    '3. If required information, figures, dates, or SOP rules are missing from the provided context, explicitly output "INSUFFICIENT_DATA" and name what is missing. NEVER invent figures, dates, or legal rules.',
    '4. Return valid JSON with keys: {"summary": string, "sections": [{"heading": string, "body": string}], "missingData": string[], "citations": [{"id": string, "version": number, "title": string, "quote": string}]}.'
  ].join('\n');

  const userPrompt = JSON.stringify({
    objective: restricted.objective,
    acceptanceCriteria: restricted.acceptance,
    expectedDeliverable: restricted.expectedDeliverable,
    revisionFeedback: restricted.feedback,
    approvedSources: restricted.sources,
    verifiedToolResults: restricted.toolResults
  });

  const estimatedPromptTokens = estimateTokens(systemPrompt + userPrompt);
  const maxProjectedTokens = estimatedPromptTokens + config.maxTokens;
  if (maxProjectedTokens > (employeeRecord.data.limits?.maxTokensPerRun || Infinity)) {
    throw Object.assign(new Error('Role token or budget cap exceeded'), {
      code: 'BUDGET_CAP_EXCEEDED',
      status: 429
    });
  }

  const projectedCostGbp = estimateCostGbp(config.model, estimatedPromptTokens, config.maxTokens);
  const spentTodayGbp = getWorkspaceDailySpendGbp(team, member);
  if (
    projectedCostGbp > config.maxCostPerRunGbp ||
    spentTodayGbp + projectedCostGbp > config.maxDailySpendGbp
  ) {
    throw Object.assign(new Error('Role token or budget cap exceeded'), {
      code: 'BUDGET_CAP_EXCEEDED',
      status: 429
    });
  }

  try {
    const raw = await callProviderEndpoint(config, systemPrompt, userPrompt, fetchImpl);
    const parsed = JSON.parse(raw.text);

    // Validate citations strictly against approvedSources so hallucinated quotes are rejected
    const validCitations = (parsed.citations || []).filter(c => {
      const source = approvedSources.find(s => s.id === c.id && s.version === c.version);
      return source && typeof c.quote === 'string' && c.quote.trim().length > 0 && source.data.text.includes(c.quote);
    });

    if (validCitations.length === 0) {
      throw new Error('LLM output did not contain verifiable verbatim citations from approved sources');
    }

    const solicitorBanner = assignment.checkWithSolicitor
      ? ['> [CHECK WITH A SOLICITOR] Mandatory legal and owner review required before acting on financial, notice, deposit, eviction, or tenancy items.']
      : [];

    const missingDataSection =
      Array.isArray(parsed.missingData) && parsed.missingData.length > 0
        ? [`## Missing Data (INSUFFICIENT_DATA)\n` + parsed.missingData.map(item => `- INSUFFICIENT_DATA: ${item}`).join('\n')]
        : [];

    const content = [
      '# ' + restricted.expectedDeliverable,
      ...solicitorBanner,
      'Objective: ' + restricted.objective,
      parsed.summary || '',
      ...(parsed.sections || []).map(sec => `## ${sec.heading}\n${sec.body}`),
      ...validCitations.map((c, i) => `## Citation [${i + 1}] ${c.title}\n${c.quote}`),
      ...missingDataSection,
      '## Acceptance criteria\n' + restricted.acceptance
    ]
      .filter(Boolean)
      .join('\n\n');

    const actualCostGbp = estimateCostGbp(config.model, raw.promptTokens, raw.completionTokens);
    const result = {
      adapter: 'llm-provider-v1',
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      content,
      citations: validCitations,
      missingData: parsed.missingData || [],
      promptTokens: raw.promptTokens,
      completionTokens: raw.completionTokens,
      totalTokens: raw.promptTokens + raw.completionTokens,
      costGbp: actualCostGbp,
      redactionCount: restricted.redactionCount,
      fallbackUsed: false
    };

    logLlmRun(team, member, assignmentRecord.id, employeeRecord.id, result);
    return result;
  } catch (err) {
    if (err.code === 'BUDGET_CAP_EXCEEDED') throw err;
    if (!config.fallbackToExtractive) throw err;

    const fallback = runExtractiveFallback({
      assignment,
      approvedSources,
      toolResults: restricted.toolResults
    });
    fallback.redactionCount = restricted.redactionCount;
    fallback.fallbackUsed = true;
    fallback.fallbackReason = err.message;
    logLlmRun(team, member, assignmentRecord.id, employeeRecord.id, fallback);
    return fallback;
  }
}

export function logLlmRun(team, member, assignmentId, employeeId, runSummary) {
  const entry = {
    assignmentId,
    employeeId,
    adapter: runSummary.adapter,
    provider: runSummary.provider,
    model: runSummary.model,
    promptTokens: runSummary.promptTokens || 0,
    completionTokens: runSummary.completionTokens || 0,
    totalTokens: runSummary.totalTokens || 0,
    costGbp: runSummary.costGbp || 0,
    redactionCount: runSummary.redactionCount || 0,
    fallbackUsed: Boolean(runSummary.fallbackUsed),
    fallbackReason: runSummary.fallbackReason || null
  };
  const record = team.create(member, 'llm_run', entry, 'business');
  team.event(member, assignmentId, 'llm_run_logged', { llmRunId: record.id, ...entry });
  return record;
}
