import { Router } from "express";
import axios from "axios";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

router.get("/oauth/start", requireAuth, (_req, res) => {
  if (!env.slack.clientId) {
    return res.status(500).json({ error: "Slack integration is not configured on the server" });
  }

  const params = new URLSearchParams({
    client_id: env.slack.clientId,
    scope: "incoming-webhook",
    redirect_uri: env.slack.redirectUri,
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
});

router.get("/oauth/callback", requireAuth, async (req: AuthedRequest, res) => {
  const { code } = req.query;
  if (!code || typeof code !== "string") {
    return res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
  }

  try {
    const response = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      new URLSearchParams({
        client_id: env.slack.clientId,
        client_secret: env.slack.clientSecret,
        code,
        redirect_uri: env.slack.redirectUri,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const data = response.data;
    if (!data.ok || !data.incoming_webhook?.url) {
      console.error("[slack] OAuth exchange failed", data);
      return res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
    }

    await prisma.slackIntegration.upsert({
      where: { userId: req.userId! },
      update: {
        webhookUrl: data.incoming_webhook.url,
        accessToken: data.access_token,
        teamName: data.team?.name,
      },
      create: {
        userId: req.userId!,
        webhookUrl: data.incoming_webhook.url,
        accessToken: data.access_token,
        teamName: data.team?.name,
      },
    });

    res.redirect(`${env.frontendUrl}/dashboard?slack=connected`);
  } catch (err) {
    console.error("[slack] OAuth callback error", err);
    res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
  }
});

router.post("/disconnect", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.slackIntegration.deleteMany({ where: { userId: req.userId! } });
  res.json({ ok: true });
});

export default router;
