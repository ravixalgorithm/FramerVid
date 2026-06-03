export const WORKSPACE_COOKIE = 'framevid_workspace_id';

export function setActiveWorkspaceCookie(workspaceId: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${WORKSPACE_COOKIE}=${workspaceId}; path=/; max-age=${maxAge}; SameSite=Lax`;
}
