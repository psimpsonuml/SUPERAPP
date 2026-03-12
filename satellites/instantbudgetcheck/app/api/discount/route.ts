import { NextResponse } from "next/server";

export async function POST() {
  // Generate a random discount code in BB-XXXXXX format
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const code = `BB-${suffix}`;

  // Placeholder — no actual Stripe call
  // In production, this would create a Stripe coupon using STRIPE_SECRET_KEY_BB

  return NextResponse.json({
    code,
    discount: "20% off",
    url: `https://budgetingbeacon.com/signup?code=${code}`,
  });
}
