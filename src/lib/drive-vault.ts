import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(secret: string) {
  if (secret.length < 32) throw new Error("Drive credential encryption is not configured.");
  return createHash("sha256").update(`orbit:google-drive:v1:${secret}`).digest();
}
export function sealDriveToken(token: string, secret: string, identity: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(identity));
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString("base64url")).join(".");
}
export function openDriveToken(value: string, secret: string, identity: string) {
  const [iv, tag, data] = value.split(".").map(s => Buffer.from(s, "base64url"));
  if (!iv || iv.length !== 12 || !tag || tag.length !== 16 || !data) throw new Error("Invalid credential envelope.");
  const cipher = createDecipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from(identity)); cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
