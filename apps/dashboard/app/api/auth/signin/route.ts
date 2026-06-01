import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { verifyPassword, setSessionCookie } from '../../../lib/auth';

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Email and password are required fields', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { email, password } = parsed.data;

    // Fetch user record
    const matchedUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = matchedUsers[0];
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password credentials', code: 'INVALID_CREDENTIALS' }, { status: 401 });
    }

    // Validate password hash
    const isCorrect = verifyPassword(password, user.passwordHash);
    if (!isCorrect) {
      return NextResponse.json({ error: 'Invalid email or password credentials', code: 'INVALID_CREDENTIALS' }, { status: 401 });
    }

    // Set active session cookie
    setSessionCookie({ id: user.id, email: user.email });

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        createdAt: user.createdAt,
      },
    });

  } catch (error: any) {
    console.error('Signin endpoint failed:', error);
    if (error.code === 'ECONNREFUSED' || error.message?.includes('connect') || error.message?.includes('database')) {
      return NextResponse.json({
        error: 'Database connection failed. Please ensure PostgreSQL is running locally or verify your DATABASE_URL key inside apps/dashboard/.env.local.',
        code: 'DATABASE_CONNECTION_ERROR'
      }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
