import fs from "fs";
import path from "path";
import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";

const CACHE_PATH = path.resolve(__dirname, "../../.ethereal-account.json");

interface EtherealAccount {
  user: string;
  pass: string;
}

async function resolveEtherealAccount(): Promise<EtherealAccount> {
  if (env.ethereal.user && env.ethereal.pass) {
    return { user: env.ethereal.user, pass: env.ethereal.pass };
  }

  if (fs.existsSync(CACHE_PATH)) {
    const cached = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
    console.log(`[mailer] Reusing cached Ethereal test account: ${cached.user}`);
    return cached;
  }

  console.log("[mailer] No Ethereal credentials found, generating a test account...");
  const testAccount = await nodemailer.createTestAccount();
  const account: EtherealAccount = { user: testAccount.user, pass: testAccount.pass };
  fs.writeFileSync(CACHE_PATH, JSON.stringify(account, null, 2));
  console.log(`[mailer] Created Ethereal account: ${account.user}`);
  console.log("[mailer] Add ETHEREAL_USER/ETHEREAL_PASS to backend/.env to pin this account.");
  return account;
}

let transporterPromise: Promise<Transporter> | null = null;

export function getTransporter(): Promise<Transporter> {
  if (!transporterPromise) {
    transporterPromise = resolveEtherealAccount().then((account) =>
      nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass },
      })
    );
  }
  return transporterPromise;
}
