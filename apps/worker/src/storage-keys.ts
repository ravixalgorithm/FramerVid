export function audioStorageKey(workspaceId: string, videoId: string) {
  return `${workspaceId}/${videoId}/audio.mp3`;
}
