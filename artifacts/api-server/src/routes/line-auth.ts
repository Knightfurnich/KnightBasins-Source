import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { customerAccounts, customerSessions, db } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { getLineAuthDiagnostics } from "../lib/line-config";

const router: IRouter = Router();
const STATE_COOKIE = "knight_line_oauth_state";
export const SESSION_COOKIE = "knight_line_session";
const SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type LineUser = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

type LineSessionCookie = {
  token: string;
};

function config() {
  return {
    channelId: process.env["LINE_CHANNEL_ID"],
    channelSecret: process.env["LINE_CHANNEL_SECRET"],
    callbackUrl: process.env["LINE_CALLBACK_URL"],
  };
}

function secret() {
  const value = process.env["SESSION_SECRET"];
  if (!value) throw new Error("SESSION_SECRET is required");
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode<T>(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function signedCookiePayload<T>(value: T) {
  const payload = encode(value);
  return `${payload}.${sign(payload)}`;
}

function verifyCookie<T>(value: string | undefined) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try {
    return decode<T>(payload);
  } catch {
    return null;
  }
}

function returnTo(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function configured() {
  return getLineAuthDiagnostics().ready;
}

export async function findAuthenticatedAccount(cookieValue: string | undefined) {
  const session = verifyCookie<LineSessionCookie>(cookieValue);
  if (!session?.token) return null;

  const [result] = await db
    .select({
      id: customerAccounts.id,
      userId: customerAccounts.lineUserId,
      displayName: customerAccounts.displayName,
      pictureUrl: customerAccounts.pictureUrl,
      fullName: customerAccounts.fullName,
      phone: customerAccounts.phone,
      email: customerAccounts.email,
      company: customerAccounts.company,
      project: customerAccounts.project,
      address: customerAccounts.address,
      taxName: customerAccounts.taxName,
      taxId: customerAccounts.taxId,
      taxBranch: customerAccounts.taxBranch,
      taxAddress: customerAccounts.taxAddress,
      preferredContact: customerAccounts.preferredContact,
      customerRole: customerAccounts.customerRole,
       propertyType: customerAccounts.propertyType,
       condoFloor: customerAccounts.condoFloor,
       expectedInstallationDate: customerAccounts.expectedInstallationDate,
      createdAt: customerAccounts.createdAt,
      updatedAt: customerAccounts.updatedAt,
    })
    .from(customerSessions)
    .innerJoin(customerAccounts, eq(customerSessions.accountId, customerAccounts.id))
    .where(and(
      eq(customerSessions.tokenHash, hashSessionToken(session.token)),
      gt(customerSessions.expiresAt, new Date()),
    ))
    .limit(1);

  return result ?? null;
}

async function findAuthenticatedUser(cookieValue: string | undefined) {
  const account = await findAuthenticatedAccount(cookieValue);
  return account ? { userId: account.userId, displayName: account.displayName, pictureUrl: account.pictureUrl } : null;
}

router.get("/auth/line/login", (req, res) => {
  if (!configured()) {
    res.status(503).json({ message: "LINE Login is not configured. Set LINE_CHANNEL_ID, LINE_CHANNEL_SECRET, and LINE_CALLBACK_URL." });
    return;
  }

  const { channelId, callbackUrl } = config();
  const state = randomBytes(24).toString("hex");
  const statePayload = { state, returnTo: returnTo(req.query.returnTo) };
  res.cookie(STATE_COOKIE, signedCookiePayload(statePayload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: 10 * 60 * 1000,
    path: "/",
  });

  const query = new URLSearchParams({
    response_type: "code",
    client_id: channelId!,
    redirect_uri: callbackUrl!,
    state,
    scope: "profile openid",
  });
  res.redirect(`https://access.line.me/oauth2/v2.1/authorize?${query.toString()}`);
});

router.get("/auth/line/callback", async (req, res, next) => {
  const stateCookie = verifyCookie<{ state: string; returnTo: string }>(req.cookies?.[STATE_COOKIE]);
  res.clearCookie(STATE_COOKIE, { path: "/" });
  if (!stateCookie || stateCookie.state !== req.query.state) {
    res.status(400).json({ message: "LINE Login state verification failed" });
    return;
  }
  if (req.query.error || typeof req.query.code !== "string") {
    res.redirect(stateCookie.returnTo);
    return;
  }

  const { channelId, channelSecret, callbackUrl } = config();
  try {
    const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: callbackUrl!,
        client_id: channelId!,
        client_secret: channelSecret!,
      }),
    });
    if (!tokenResponse.ok) {
      res.status(502).json({ message: "LINE Login token exchange failed" });
      return;
    }
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) {
      res.status(502).json({ message: "LINE Login did not return an access token" });
      return;
    }

    const profileResponse = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) {
      res.status(502).json({ message: "LINE profile lookup failed" });
      return;
    }
    const profile = await profileResponse.json() as LineUser;
    const [account] = await db
      .insert(customerAccounts)
      .values({
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl ?? null,
      })
      .onConflictDoUpdate({
        target: customerAccounts.lineUserId,
        set: {
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl ?? null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: customerAccounts.id });
    if (!account) {
      throw new Error("LINE customer account could not be saved");
    }

    const sessionToken = randomBytes(32).toString("base64url");
    await db.insert(customerSessions).values({
      accountId: account.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt: new Date(Date.now() + SESSION_AGE_MS),
    });

    res.cookie(SESSION_COOKIE, signedCookiePayload({ token: sessionToken }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      maxAge: SESSION_AGE_MS,
      path: "/",
    });
    res.redirect(stateCookie.returnTo);
  } catch (error) {
    next(error);
  }
});

router.get("/auth/line/status", async (req, res, next) => {
  try {
    const user = await findAuthenticatedUser(req.cookies?.[SESSION_COOKIE]);
    res.json({ configured: configured(), authenticated: Boolean(user), user: user ?? null });
  } catch (error) {
    next(error);
  }
});

router.delete("/auth/line/session", async (req, res, next) => {
  try {
    const session = verifyCookie<LineSessionCookie>(req.cookies?.[SESSION_COOKIE]);
    if (session?.token) {
      await db.delete(customerSessions).where(eq(customerSessions.tokenHash, hashSessionToken(session.token)));
    }
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.clearCookie("knight_line_user", { path: "/" });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
