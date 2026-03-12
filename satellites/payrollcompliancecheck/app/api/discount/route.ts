import { NextResponse } from "next/server";

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "PB-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST() {
  // In production, this would create a Stripe coupon via:
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY_PB!)
  // const coupon = await stripe.coupons.create({ percent_off: 20, duration: 'once' })

  const code = generateCode();

  return NextResponse.json({
    code,
    discount: "20% off",
    url: `https://payrollbeacon.com/signup?code=${code}`,
  });
}
