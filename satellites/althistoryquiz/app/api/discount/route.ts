import { NextResponse } from 'next/server';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'CS-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST() {
  const code = generateCode();
  return NextResponse.json({
    code,
    discount: '20% off',
    url: `https://chronostates.io/signup?code=${code}`,
  });
}
