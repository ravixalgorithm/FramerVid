import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users, workspaces, workspaceMembers } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { hashPassword, setSessionCookie } from '../../../lib/auth';

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(255).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { email, password, name } = parsed.data;

    // Check if email already registered
    const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUsers.length > 0) {
      return NextResponse.json({ error: 'Email address already registered.', code: 'EMAIL_ALREADY_EXISTS' }, { status: 400 });
    }

    // Hash password and store user record
    const passwordHash = hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name: name || null,
        passwordHash,
      })
      .returning();

    if (!newUser) {
      throw new Error('User creation returned empty.');
    }

    // Auto-create initial default workspace for the user
    const workspaceSlug = `${name ? name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'default'}-workspace-${Math.random().toString(36).substring(2, 6)}`;
    const [newWorkspace] = await db
      .insert(workspaces)
      .values({
        name: `${name || email.split('@')[0]}'s Workspace`,
        slug: workspaceSlug,
        ownerId: newUser.id,
        plan: 'free',
      })
      .returning();

    if (newWorkspace) {
      // Create creator membership
      await db.insert(workspaceMembers).values({
        workspaceId: newWorkspace.id,
        userId: newUser.id,
        role: 'admin',
      });
    }

    // Set secure cookie session
    setSessionCookie({ id: newUser.id, email: newUser.email });

    return NextResponse.json({
      data: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name || undefined,
        createdAt: newUser.createdAt,
      },
    });

  } catch (error: any) {
    console.error('Signup endpoint failed:', error);
    if (error.code === 'ECONNREFUSED' || error.message?.includes('connect') || error.message?.includes('database')) {
      return NextResponse.json({
        error: 'Database connection failed. Please ensure PostgreSQL is running locally or verify your DATABASE_URL key inside apps/dashboard/.env.local.',
        code: 'DATABASE_CONNECTION_ERROR'
      }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
