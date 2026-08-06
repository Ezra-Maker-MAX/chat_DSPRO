import { put } from "@vercel/blob";
import { db, schema } from "@/lib/db";
import { generateId, MIME_TO_TYPE } from "./utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function uploadMedia(
  file: File,
  tenantId: string,
  userId: string,
  messageId?: string
) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large. Maximum size is 50MB.");
  }

  const mediaType = MIME_TO_TYPE[file.type];
  if (!mediaType) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }

  const mediaId = `med_${generateId(16)}`;
  const ext = file.name.split(".").pop() || "bin";
  const storagePath = `${tenantId}/${mediaType}/${mediaId}.${ext}`;

  // Upload to Vercel Blob
  const blob = await put(storagePath, file, {
    access: "public",
    contentType: file.type,
  });

  // Store metadata
  await db.insert(schema.media).values({
    id: mediaId,
    tenantId,
    messageId: messageId || null,
    uploaderId: userId,
    fileName: file.name,
    mimeType: file.type,
    mediaType,
    fileSize: file.size,
    storageUrl: blob.url,
  });

  return {
    id: mediaId,
    url: blob.url,
    type: mediaType,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  };
}
