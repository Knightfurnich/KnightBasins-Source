// น้องไนท์ Prompt Guard & Secret Leakage Prevention: two independent checks
// around the AI support assistant's message flow (routes/support.ts). Both
// are pattern-based, not AI-based, on purpose -- a cheap, deterministic,
// synchronous check that runs before any AI call is what actually stops a
// jailbreak attempt from ever reaching the model, and a filter over the
// model's own output is the last line of defense if it ever gets coaxed
// into repeating something it shouldn't.

export type PromptInjectionResult = {
  isSuspicious: boolean;
  reason?: string;
};

/**
 * Each pattern targets a specific, well-known attack phrasing (instruction
 * override, system-prompt extraction, jailbreak "mode" framing, explicit
 * secret requests) in English and Thai -- deliberately multi-word and
 * specific rather than single generic terms like "bypass" alone, so an
 * ordinary customer question about basins/counters/stone colors can never
 * match one by coincidence (see prompt-guard.test.ts's false-positive
 * coverage for real customer phrasing this must never flag).
 */
const INJECTION_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(?:ignore|disregard|forget)\b[^.!?]{0,30}\b(?:previous|prior|above|all)\b[^.!?]{0,20}\b(?:instructions?|rules?|prompts?)\b/i, reason: "instruction-override" },
  { pattern: /\bsystem\s*prompt\b/i, reason: "system-prompt-extraction" },
  { pattern: /\b(?:reveal|show|print|repeat|leak)\b[^.!?]{0,20}\b(?:your\s+)?(?:instructions?|system\s*prompt|rules?)\b/i, reason: "system-prompt-extraction" },
  { pattern: /\b(?:developer|dev|god|admin|jailbreak|dan)\s*mode\b/i, reason: "jailbreak-mode" },
  { pattern: /\byou\s+are\s+now\s+(?:in\s+)?(?:a\s+)?(?:developer|dev|unrestricted|jailbroken|dan)\b/i, reason: "jailbreak-mode" },
  { pattern: /\bpretend\s+(?:you\s+are|to\s+be)\b[^.!?]{0,40}\b(?:no\s+rules|unrestricted|without\s+restrictions?|no\s+restrictions?)\b/i, reason: "jailbreak-roleplay" },
  { pattern: /\bbypass\b[^.!?]{0,20}\b(?:rules?|restrictions?|filters?|guardrails?|safety|security)\b/i, reason: "bypass-attempt" },
  { pattern: /\b(?:reveal|show|tell|give)\s+(?:me\s+)?(?:the\s+)?(?:server\s+)?(?:password|passwords|api\s*keys?|secrets?|tokens?|database\s+url|connection\s+strings?)\b/i, reason: "secret-extraction" },
  { pattern: /เปิดเผย\s*(?:รหัสผ่าน|ความลับ|ข้อมูลลับ|api\s*key)/i, reason: "secret-extraction-th" },
  { pattern: /ลืม\s*(?:คำสั่ง|กฎ)\s*(?:เดิม|ก่อนหน้า|ทั้งหมด)?/i, reason: "instruction-override-th" },
  { pattern: /(?:เปิด|เข้า)\s*โหมด\s*(?:นักพัฒนา|ดีเวลอปเปอร์|แอดมิน|ผู้ดูแลระบบ)/i, reason: "jailbreak-mode-th" },
  { pattern: /บอก\s*(?:รหัสผ่าน|api\s*key|เซิร์ฟเวอร์|ระบบหลังบ้าน|ความลับ)/i, reason: "secret-extraction-th" },
  { pattern: /ข้าม\s*(?:กฎ|การป้องกัน|ข้อจำกัด|ระบบรักษาความปลอดภัย)/i, reason: "bypass-attempt-th" },
  { pattern: /(?:คำสั่งระบบ|พรอมต์ระบบ|system\s*prompt)/i, reason: "system-prompt-extraction-th" },
];

/**
 * Cheap, synchronous, pattern-based jailbreak/prompt-injection check run on
 * the customer's own message before it's ever forwarded to the AI. Never
 * throws: a non-string or empty input is simply "not suspicious" rather
 * than an error, since callers already normalize the message beforehand
 * (see routes/support.ts's cleanMessage).
 */
export function detectPromptInjection(userMessage: string): PromptInjectionResult {
  if (typeof userMessage !== "string" || !userMessage.trim()) return { isSuspicious: false };
  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(userMessage)) return { isSuspicious: true, reason };
  }
  return { isSuspicious: false };
}

/** Explicit names this system actually uses -- always redacted wherever they appear, even with no "=value" attached, since naming one out loud already reveals internal architecture. */
const KNOWN_SECRET_NAMES = [
  "HERMES_API_KEY",
  "SESSION_SECRET",
  "ADMIN_PASSWORD",
  "DATABASE_URL",
  "GOOGLE_API_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_PLACES_API_KEY",
  "SLIPOK_API_KEY",
  "LINE_CHANNEL_SECRET",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
] as const;
const knownSecretNamePattern = new RegExp(`\\b(?:${KNOWN_SECRET_NAMES.join("|")})\\b`, "gi");

/** Any UPPER_SNAKE_CASE identifier that *looks* like a secret (by naming convention) followed by an assignment -- catches a secret this system hasn't been explicitly told about yet, e.g. a future FOO_API_KEY. */
const genericSecretAssignmentPattern = /\b[A-Z][A-Z0-9_]*(?:_KEY|_SECRET|_PASSWORD|_TOKEN|_URL)\b\s*[:=]\s*\S+/g;

/** Database/cache connection strings, regardless of whether they follow a NAME= prefix. */
const connectionStringPattern = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/\S+/gi;

/** Well-known API key *shapes* (OpenAI-style, Google-style) even with no surrounding variable name at all. */
const apiKeyShapePattern = /\bsk-[A-Za-z0-9]{16,}\b|\bAIza[0-9A-Za-z_-]{20,}\b/g;

const bearerTokenPattern = /\bBearer\s+[A-Za-z0-9._-]{10,}\b/gi;

/** Internal/private IPv4 addresses (RFC1918 + loopback) -- a public IP isn't inherently secret, but these reveal internal network topology. */
const privateIpPattern = /\b(?:127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g;

/**
 * Last line of defense: scans an AI-generated reply for secret-shaped
 * content and replaces it with "[REDACTED]" before it ever reaches a
 * customer. Order matters -- the full "NAME=value" assignment is redacted
 * whole before the bare-name pass runs, so a caught secret never leaves its
 * variable name exposed either. Never throws; a non-string input passes
 * through as an empty string rather than crashing the response pipeline.
 */
export function sanitizeAiResponse(responseContent: string): string {
  if (typeof responseContent !== "string") return "";
  let sanitized = responseContent;
  sanitized = sanitized.replace(genericSecretAssignmentPattern, "[REDACTED]");
  sanitized = sanitized.replace(connectionStringPattern, "[REDACTED]");
  sanitized = sanitized.replace(apiKeyShapePattern, "[REDACTED]");
  sanitized = sanitized.replace(bearerTokenPattern, "[REDACTED]");
  sanitized = sanitized.replace(knownSecretNamePattern, "[REDACTED]");
  sanitized = sanitized.replace(privateIpPattern, "[REDACTED]");
  return sanitized;
}
