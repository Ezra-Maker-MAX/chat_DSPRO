// ============================================================
// SillyTavern character card (chara_card_v2) export + PNG embed
// ------------------------------------------------------------
// A tavern-importable card is a PNG whose tEXt chunk "chara"
// holds base64(JSON of a chara_card_v2 object). This module
// builds that object, maps our world-book into the tavern
// character_book schema, and embeds it into a PNG buffer so the
// exported image can be dropped straight into SillyTavern.
// ============================================================
import { Buffer } from "buffer";

/** CRC-32 (ISO-HDLC, same polynomial as zlib/PNG). */
function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
    }
  }
  return (~c) >>> 0;
}

function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Map a chatmosphere world book + its entries to the tavern character_book shape. */
export function buildCharacterBook(book: any, entries: any[]): any {
  const scanDepthChars: number = book?.scanDepth ?? 6000;
  // chatmosphere measures scan depth in characters; tavern uses recent-message count.
  const scanDepthMsgs = Math.min(50, Math.max(1, Math.round(scanDepthChars / 500)));

  return {
    name: book?.name || "",
    description: book?.description || "",
    scan_depth: scanDepthMsgs,
    token_budget: 0,
    recursive_scanning: false,
    extensions: {},
    entries: (entries || []).map((e, i) => {
      const logic = (e.selectiveLogic || "").toUpperCase();
      return {
        id: i + 1,
        keys: parseJsonArray(e.keys),
        secondary_keys: parseJsonArray(e.secondaryKeys),
        comment: (e.content || "").slice(0, 50),
        content: e.content || "",
        constant: Boolean(e.constant),
        enabled: e.enabled !== false,
        insertion_order: e.insertionOrder ?? i,
        position: e.position === "after_char" ? 1 : 0,
        use_regex: false,
        case_sensitive: Boolean(e.caseSensitive),
        selective_logic: logic === "AND" ? 1 : logic === "NOT" ? 2 : 0,
        selective_recursive: false,
        extensions: {},
      };
    }),
  };
}

/** Build a full chara_card_v2 object from a chatmosphere card (+ optional world book). */
export function buildCharaCardV2(card: any, worldBook?: { book: any; entries: any[] } | null): any {
  const data: any = {
    name: card?.name || "Character",
    description: card?.description || "",
    personality: card?.personality || "",
    scenario: card?.scenario || "",
    first_mes: card?.firstMes || "",
    mes_example: card?.mesExample || "",
    creator_notes: "",
    system_prompt: card?.systemPrompt || "",
    post_history_instructions: card?.postHistoryInstructions || "",
    alternate_greetings: [],
    tags: [],
    creator: "chatmosphere",
    character_version: "1.0",
    extensions: {},
  };
  if (worldBook?.book) {
    data.character_book = buildCharacterBook(worldBook.book, worldBook.entries || []);
  }
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data,
  };
}

/**
 * Insert a tEXt chunk with keyword "chara" (base64 JSON) into a PNG buffer,
 * just before IEND. Returns a new buffer (original is untouched).
 */
export function embedCharaChunk(png: Buffer, charaJson: unknown): Buffer {
  if (png.length < 8 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Not a valid PNG file");
  }

  const keyword = "chara";
  const text = Buffer.from(JSON.stringify(charaJson), "utf8").toString("base64");
  const data = Buffer.concat([
    Buffer.from(keyword, "latin1"),
    Buffer.from([0x00]),
    Buffer.from(text, "latin1"),
  ]);
  const type = Buffer.from("tEXt", "ascii");
  const typeAndData = Buffer.concat([type, data]);
  const crc = crc32(typeAndData);

  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  const charaChunk = Buffer.concat([lenBuf, typeAndData, crcBuf]);

  const out: Buffer[] = [png.subarray(0, 8)];
  let pos = 8;
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const chunkEnd = pos + 12 + len;
    if (chunkEnd > png.length) throw new Error("Truncated PNG chunk");
    const typeStr = png.subarray(pos + 4, pos + 8).toString("ascii");
    const chunk = png.subarray(pos, chunkEnd);
    if (typeStr === "IEND") {
      // Insert our chunk immediately before IEND.
      out.push(charaChunk);
      out.push(chunk);
      break;
    }
    // Drop any pre-existing "chara" tEXt chunk so we never embed a stale duplicate.
    if (typeStr === "tEXt") {
      const zeroIdx = chunk.indexOf(0x00, 8);
      const keyword = zeroIdx >= 0 ? chunk.subarray(8, zeroIdx).toString("latin1") : "";
      if (keyword === "chara") {
        pos = chunkEnd;
        continue;
      }
    }
    out.push(chunk);
    pos = chunkEnd;
  }
  return Buffer.concat(out);
}

/** A minimal valid 1x1 transparent PNG, used as the base when a card has no avatar image. */
export const FALLBACK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC";
