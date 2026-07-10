import Stripe from "stripe";

declare global {
  // eslint-disable-next-line no-var
  var stripeClient: Stripe | undefined;
}

function readEnv(name: string) {
  return String(process.env[name] || "").trim();
}

function requireEnv(name: string, label: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${label} is not configured.`);
  }
  return value;
}

export function getAppUrl() {
  const explicitUrl = readEnv("NEXT_PUBLIC_APP_URL");
  if (explicitUrl) {
    return explicitUrl.replace(/\/+$/, "");
  }

  const vercelUrl = readEnv("VERCEL_URL");
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }

  return "http://localhost:3000";
}

export function isStripeCheckoutConfigured() {
  return Boolean(readEnv("STRIPE_SECRET_KEY") && readEnv("STRIPE_PREMIUM_PRICE_ID"));
}

export function isStripeBillingConfigured() {
  return isStripeCheckoutConfigured() && Boolean(readEnv("STRIPE_WEBHOOK_SECRET"));
}

export function getStripePremiumPriceId() {
  return requireEnv("STRIPE_PREMIUM_PRICE_ID", "Stripe Premium price");
}

export function getStripeWebhookSecret() {
  return requireEnv("STRIPE_WEBHOOK_SECRET", "Stripe webhook secret");
}

export function getStripe() {
  if (!global.stripeClient) {
    global.stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY", "Stripe secret key"));
  }

  return global.stripeClient;
}
