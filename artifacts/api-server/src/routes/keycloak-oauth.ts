import { Router, type IRouter, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getKeycloakClient, generators } from "../lib/keycloak";
import { signToken } from "../middlewares/auth";

const router: IRouter = Router();

const ALLOWED_EMAIL_DOMAIN = "@scopicsoftware.com";
const ADMIN_EMAIL = "ervis.q@scopicsoftware.com";
const STATE_COOKIE = "kc_oidc_state";
const STATE_TTL_SEC = 10 * 60;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required for Keycloak OIDC flow");
}

function getAppDomain(): string {
  return process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() || process.env.REPLIT_DEV_DOMAIN || "localhost";
}

function getRedirectUri(): string {
  return `https://${getAppDomain()}/api/auth/keycloak/callback`;
}

function getFrontendRoot(): string {
  return `https://${getAppDomain()}`;
}

interface OidcStateCookie {
  state: string;
  codeVerifier: string;
  nonce: string;
}

function signStateCookie(payload: OidcStateCookie): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: STATE_TTL_SEC });
}

function verifyStateCookie(raw: string): OidcStateCookie | null {
  try {
    const decoded = jwt.verify(raw, JWT_SECRET!) as OidcStateCookie & { iat?: number; exp?: number };
    if (!decoded.state || !decoded.codeVerifier || !decoded.nonce) return null;
    return { state: decoded.state, codeVerifier: decoded.codeVerifier, nonce: decoded.nonce };
  } catch {
    return null;
  }
}

function redirectWithError(res: Response, code: string): void {
  res.redirect(`${getFrontendRoot()}/?error=${encodeURIComponent(code)}`);
}

router.get("/auth/keycloak/login", async (_req: Request, res: Response) => {
  try {
    const client = await getKeycloakClient();
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);

    const cookieValue = signStateCookie({ state, codeVerifier, nonce });
    res.cookie(STATE_COOKIE, cookieValue, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: STATE_TTL_SEC * 1000,
      path: "/api/auth/keycloak",
    });

    const authUrl = client.authorizationUrl({
      scope: "openid profile email",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      redirect_uri: getRedirectUri(),
    });

    res.redirect(authUrl);
  } catch (err) {
    console.error("[keycloak/login] failed:", err);
    redirectWithError(res, "sso_unavailable");
  }
});

router.get("/auth/keycloak/callback", async (req: Request, res: Response) => {
  const cookieRaw = (req.cookies && req.cookies[STATE_COOKIE]) as string | undefined;
  res.clearCookie(STATE_COOKIE, { path: "/api/auth/keycloak" });

  if (!cookieRaw) {
    console.warn("[keycloak/callback] missing state cookie");
    redirectWithError(res, "sso_state_missing");
    return;
  }
  const cookieState = verifyStateCookie(cookieRaw);
  if (!cookieState) {
    console.warn("[keycloak/callback] invalid/expired state cookie");
    redirectWithError(res, "sso_state_invalid");
    return;
  }

  try {
    const client = await getKeycloakClient();
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(getRedirectUri(), params, {
      state: cookieState.state,
      nonce: cookieState.nonce,
      code_verifier: cookieState.codeVerifier,
    });

    const claims = tokenSet.claims();
    const sub = claims.sub;
    const emailRaw = typeof claims.email === "string" ? claims.email : "";
    const emailVerified = claims.email_verified === true;
    const fullName =
      (typeof claims.name === "string" && claims.name) ||
      [claims.given_name, claims.family_name].filter(Boolean).join(" ").trim() ||
      emailRaw.split("@")[0] ||
      "Scopic User";

    if (!sub || !emailRaw) {
      console.warn("[keycloak/callback] token missing sub/email");
      redirectWithError(res, "sso_missing_claims");
      return;
    }
    const email = emailRaw.trim().toLowerCase();
    if (!emailVerified) {
      console.warn(`[keycloak/callback] email_verified=false for ${email}`);
      redirectWithError(res, "email_not_verified");
      return;
    }
    if (!email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
      console.warn(`[keycloak/callback] disallowed email domain: ${email}`);
      redirectWithError(res, "wrong_domain");
      return;
    }

    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      const desiredRole = email === ADMIN_EMAIL ? "admin" : "user";
      [user] = await db
        .insert(users)
        .values({
          email,
          name: fullName,
          passwordHash: null,
          keycloakSub: sub,
          role: desiredRole,
        })
        .returning();
      console.info(`[keycloak/callback] provisioned new SSO user ${email} (role=${desiredRole})`);
    } else {
      // Preserve admin role; never downgrade an existing admin row.
      const updates: Partial<typeof users.$inferInsert> = {};
      if (user.keycloakSub !== sub) updates.keycloakSub = sub;
      if (user.name !== fullName) updates.name = fullName;
      if (email === ADMIN_EMAIL && user.role !== "admin") updates.role = "admin";
      if (Object.keys(updates).length > 0) {
        const [updated] = await db.update(users).set(updates).where(eq(users.id, user.id)).returning();
        user = updated;
      }
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });

    res.redirect(`${getFrontendRoot()}/auth/sso-callback#token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("[keycloak/callback] failed:", err);
    redirectWithError(res, "sso_failed");
  }
});

export default router;
