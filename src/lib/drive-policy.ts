export const DRIVE_READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_SCOPES = `openid email profile ${DRIVE_READ_SCOPE} ${DRIVE_FILE_SCOPE}`;
export function hasDriveScopes(scope: string) {
  const granted = new Set(scope.split(/\s+/));
  return granted.has(DRIVE_READ_SCOPE) && granted.has(DRIVE_FILE_SCOPE);
}
export function driveFileId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{10,200}$/.test(value)) throw new Error("Choose a valid Google Drive file.");
  return value;
}
export function driveQuery(parent: string, search: string) {
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `trashed = false and ${search.trim() ? `name contains '${escape(search.trim().slice(0, 100))}'` : `'${escape(parent)}' in parents`}`;
}
