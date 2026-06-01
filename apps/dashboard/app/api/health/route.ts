import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    database: Boolean(process.env.DATABASE_URL),
    redis: Boolean(process.env.REDIS_URL),
    r2: Boolean(process.env.CLOUDFLARE_R2_ACCOUNT_ID),
    jwt: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32),
  };

  const ok = checks.database && checks.redis && checks.jwt;

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      service: 'framevid-dashboard',
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
