import { Router } from "express";
import jwt from "jsonwebtoken";
import passport from "../config/passport";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${env.frontendUrl}/login?error=1` }),
  (req, res) => {
    const user = req.user as { id: string };
    const token = jwt.sign({ userId: user.id }, env.jwtSecret, { expiresIn: "7d" });

    res.cookie(env.sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.nodeEnv === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${env.frontendUrl}/dashboard`);
  }
);

router.post("/logout", (_req, res) => {
  res.clearCookie(env.sessionCookieName);
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      slackIntegration: { select: { teamName: true } },
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    ...user,
    slackConnected: !!user.slackIntegration,
  });
});

export default router;
