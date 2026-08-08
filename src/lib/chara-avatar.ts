// ============================================================
// Build a SillyTavern-importable avatar PNG (image bytes + embedded
// chara_card_v2 metadata) and upload it to Vercel Blob.
// Shared by the "generate" and "upload" avatar routes.
// ============================================================
import { put } from "@vercel/blob";
import { generateId } from "@/lib/utils";
import { embedCharaChunk, buildCharaCardV2 } from "@/lib/chara-card";
import { getWorldBookWithEntries } from "@/lib/roleplay";

export interface AvatarCardInput {
  name: string;
  description?: string;
  personality?: string;
  scenario?: string;
  firstMes?: string;
  mesExample?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
}

/**
 * Embed chara_card_v2 metadata into the given image bytes and upload.
 * Returns the public Blob URL (this URL is itself importable by SillyTavern).
 */
export async function buildAndUploadAvatar(
  tenantId: string,
  card: AvatarCardInput,
  worldBookId: string | null | undefined,
  imageBytes: Buffer,
  cardId?: string
): Promise<string> {
  let worldBook: { book: any; entries: any[] } | null = null;
  if (worldBookId) {
    worldBook = await getWorldBookWithEntries(tenantId, worldBookId);
  }

  const chara = buildCharaCardV2(card, worldBook);
  const png = embedCharaChunk(imageBytes, chara);

  const path = `${tenantId}/char/${cardId || `tmp_${generateId(8)}`}.png`;
  const blob = await put(path, png, {
    access: "public",
    contentType: "image/png",
    allowOverwrite: true,
  });
  return blob.url;
}
