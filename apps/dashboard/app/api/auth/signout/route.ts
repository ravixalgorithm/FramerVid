import { NextResponse } from 'next/server';
import { clearSessionCookie } from '../../../lib/auth';

export async function POST() {
  try {
    clearSessionCookie();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Signout endpoint failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
