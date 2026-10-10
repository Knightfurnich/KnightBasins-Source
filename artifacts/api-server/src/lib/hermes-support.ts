// Bridges KnightSupport (the in-app chat widget) to the Hermes agent that
// already serves Knight Furnich's LINE customer-service bot. Calling with the
// same `user` identifier (the customer's LINE user id) as the LINE platform
// uses keeps the conversation continuous across the website and LINE DMs --
// that continuity is the whole point of this integration, so `user` must
// always come from the authenticated session, never from client input.
//
// `user` alone does NOT join the LINE conversation: Hermes resolves "which
// transcript?" from the declared session key (header `X-Hermes-Session-Key`),
// and the Knight patch KNIGHT_SHARED_SESSION_CHAT makes /v1/chat/completions
// continue the newest existing transcript stored under that key, whatever
// channel created it. A LINE DM is stored under
// `agent:main:line:dm:<LINE user id>` -- the format the ops repo's own decisive
// test (bin/_test_shared_transcript.py) sends and finds the LINE transcript with.
// Without the header the web chat gets a transcript derived from the prompt, so
// the customer meets a bot that "has never spoken to them".

const REQUEST_TIMEOUT_MS = 45_000;

const LINE_DM_SESSION_KEY_PREFIX = "agent:main:line:dm:";
// A LINE user id is "U" + 32 hex characters. Anything else is not put into a header.
const LINE_USER_ID_PATTERN = /^U[0-9a-f]{32}$/;

/**
 * The Hermes session key of this customer's LINE DM, or null when `userId` is not a
 * LINE user id. `userId` must come from the verified session (see top of file); the
 * pattern check additionally keeps a malformed value out of an HTTP header.
 */
export function lineConversationSessionKey(userId: string): string | null {
  return LINE_USER_ID_PATTERN.test(userId) ? `${LINE_DM_SESSION_KEY_PREFIX}${userId}` : null;
}

export type HermesSupportResult =
  | { ok: true; reply: string }
  | { ok: false; message: string };

function hermesConfig() {
  const apiUrl = process.env["HERMES_API_URL"];
  const apiKey = process.env["HERMES_API_KEY"];
  if (!apiUrl || !apiKey) return null;
  return {
    apiUrl: apiUrl.replace(/\/$/, ""),
    apiKey,
    model: process.env["HERMES_API_MODEL"] || "hermes-agent",
  };
}

export function hermesSupportConfigured() {
  return hermesConfig() !== null;
}

export async function askHermesSupport(options: {
  message: string;
  userId: string;
  contextSummary?: string;
}): Promise<HermesSupportResult> {
  const config = hermesConfig();
  if (!config) return { ok: false, message: "Hermes support is not configured" };

  const messages = [
    ...(options.contextSummary
      ? [{ role: "system" as const, content: options.contextSummary }]
      : []),
    { role: "user" as const, content: options.message },
  ];

  const sessionKey = lineConversationSessionKey(options.userId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.apiUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...(sessionKey ? { "X-Hermes-Session-Key": sessionKey } : {}),
      },
      body: JSON.stringify({ model: config.model, messages, user: options.userId }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    } | null;

    const reply = payload?.choices?.[0]?.message?.content;
    if (!response.ok || typeof reply !== "string" || !reply.trim()) {
      return { ok: false, message: payload?.error?.message ?? `Hermes returned ${response.status}` };
    }
    return { ok: true, reply: reply.trim() };
  } catch (error) {
    const message = error instanceof Error
      ? (error.name === "AbortError" ? "Hermes support request timed out" : error.message)
      : "Hermes support request failed";
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}
