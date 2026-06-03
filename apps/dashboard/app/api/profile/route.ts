import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users } from '@framevid/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '../../lib/auth';

const profileSchema = z.object({
  name: z.string().min(1).max(255),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Validation error', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { name } = parsed.data;

    const [updated] = await db
      .update(users)
      .set({
        name,
      })
      .where(eq(users.id, user.id))
      .returning();

    return NextResponse.json({
      data: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
      },
    });
  } catch (error: unknown) {
    console.error('PATCH profile failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
