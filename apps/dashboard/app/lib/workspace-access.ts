import { db, workspaceMembers } from '@framevid/db';
import { and, eq } from 'drizzle-orm';

export async function assertWorkspaceAccess(userId: string, workspaceId: string, allowedRoles?: string[]) {
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
    
  if (!membership) return null;
  if (allowedRoles && !allowedRoles.includes(membership.role)) return null;
  
  return membership;
}
