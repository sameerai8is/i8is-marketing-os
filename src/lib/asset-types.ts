export interface LibraryAsset {
  id: string; name: string; filename: string; folder: string; tags: string[]; altText: string;
  kind: "image" | "video" | "document" | "source" | "link"; source: "upload" | "google_drive";
  sourceUrl?: string; driveFolder?: boolean; driveNative?: boolean; status: "uploading" | "ready"; approval: "pending" | "approved";
  createdBy: string; size: number; mime: string; width?: number; height?: number; updatedAt: string; createdAt: string;
  previewUrl?: string; fileUrl?: string;
}
export const formatBytes = (value: number) => value < 1024 ? `${value} B` : value < 1024 * 1024 ? `${(value / 1024).toFixed(0)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`;
export const attachableAsset = (asset: LibraryAsset) => ["image", "video", "document"].includes(asset.kind) && asset.status === "ready";
