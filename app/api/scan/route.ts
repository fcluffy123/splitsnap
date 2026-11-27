// app/api/scan/route.ts
// POST /api/scan  — receives the (already compressed) receipt image as
// multipart form field "image", sends it to Google Gemini, and returns the
// parsed receipt JSON. The GEMINI_API_KEY never leaves the server.
import { NextRequest, NextResponse } from "next/server";
import { validateScannedReceipt, type ScannedReceipt } from "@/lib/scan";

export const runtime = "nodejs"; // we need Buffer + fetch to the Gemini API

const MODEL = "gemini-flash-latest"; // the "gemini-flash" model family
const FALLBACK_MODELS = ["gemini-flash-lite-latest", "gemini-3.5-flash"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // client compresses to <1MB; this is a safety cap

// Simple in-memory rate limit: at most 10 scans per IP per hour. State lives
// only in this server instance, so a restart (or a new serverless instance)
// resets it — that's fine, this just stops casual overuse of the API key.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const scanCounts = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  // Occasionally drop expired entries so the map can't grow forever.
  if (scanCounts.size > 500) {
    for (const [k, v] of scanCounts) {
      if (now - v.windowStart >= RATE_WINDOW_MS) scanCounts.delete(k);
    }
  }
  const entry = scanCounts.get(ip);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    scanCounts.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

const PROMPT = `You are reading a restaurant receipt photo. Return ONLY a JSON object — no markdown, no code fences, no explanation — in exactly this shape:
{"items":[{"name":"string","price":number,"qty":number}],"subtotal":number,"discount":number,"tax":number,"service":number,"total":number,"currency":"string"}
Rules:
- price is the UNIT price of one item, in the receipt's currency (e.g. 85000 for 85.000đ).
- qty is how many of that item were ordered; use 1 when the receipt doesn't say.
- subtotal, tax, service, total are the amounts printed on the receipt (0 if absent).
- discount is the total discount amount printed on the receipt, as a POSITIVE number (0 if there is none).
- currency is the ISO code shown on the receipt, e.g. "VND", "USD", "EUR".
- The photo may be rotated, tilted, shadowed or low-quality: rotate it mentally and read carefully, line by line.
- Do NOT list discount lines, taxes, service charges, payments or totals as items — items are the food/drinks only.
- If the receipt has discount lines (e.g. "Open Discount -74,001"), do not include them in items; add their amount into discount as a positive number. Keep the printed subtotal/total as-is (if only a net "TOTAL AMOUNT" is printed, use it as total and leave subtotal 0).
- Many receipts (e.g. Vietnamese) use dots or commas as thousands separators: "140,000" and "140.000" both mean 140000.
- If the photo is truly unreadable, return {"items":[],"subtotal":0,"discount":0,"tax":0,"service":0,"total":0,"currency":"VND"}.`;

// A second, more insistent pass used only when the first read came back empty.
const RETRY_HINT = `The previous read found nothing. Look VERY carefully: the text may be rotated up to 180 degrees, in shadow, or small. Try reading it upside down or sideways. Extract any item lines you can find.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "GEMINI_API_KEY is not set on the server (.env.local)." },
      { status: 500 }
    );
  }

  // Rate limit: 10 scans per IP per hour.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        ok: false,
        error: "You've scanned 10 receipts this hour — that's the limit for now. Please try again a bit later. 🙏",
      },
      { status: 429 }
    );
  }

  let form;
  try {
    form = await req.formData();
  } catch (e) {
    console.error("formData parse error:", e);
    return NextResponse.json(
      { ok: false, error: "Could not read the uploaded image." },
      { status: 400 }
    );
  }

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { ok: false, error: "No image received." },
      { status: 400 }
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Image too large (over 5 MB)." },
      { status: 413 }
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mimeType = file.type || "image/jpeg";

  // One Gemini call: tries the flash model first, then fallbacks on
  // 503/429 (overload/rate limit). thinkingBudget 0 skips the model's
  // internal reasoning so scans come back faster.
  const callGemini = async (
    promptText: string
  ): Promise<{ text: string } | { error: NextResponse }> => {
    const modelsToTry = [MODEL, ...FALLBACK_MODELS];
    let lastStatus = 0;
    let lastDetail = "";
    for (const model of modelsToTry) {
      let geminiRes: Response;
      try {
        geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Key goes in a header, never in the URL (URLs can end up in logs).
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { inline_data: { mime_type: mimeType, data: base64 } },
                    { text: promptText },
                  ],
                },
              ],
              generationConfig: {
                response_mime_type: "application/json", // ask Gemini for raw JSON
                temperature: 0, // deterministic reading
                thinkingConfig: { thinkingBudget: 0 }, // no extra reasoning — faster scans
              },
            }),
          }
        );
      } catch {
        return {
          error: NextResponse.json(
            { ok: false, error: "Could not reach the Gemini API. Check the server internet connection." },
            { status: 502 }
          ),
        };
      }
      if (geminiRes.ok) {
        const payload = await geminiRes.json();
        const text: unknown = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text === "string") return { text };
        // Shape problem — no point trying other models, they read the same image.
        return {
          error: NextResponse.json(
            { ok: false, error: "Gemini returned no text." },
            { status: 502 }
          ),
        };
      }
      lastStatus = geminiRes.status;
      lastDetail = await geminiRes.text().catch(() => "");
      console.error(`Gemini ${model} error`, lastStatus, lastDetail.slice(0, 300));
      if (lastStatus !== 503 && lastStatus !== 429) break; // real errors (bad key etc.) — don't retry
    }

    const hint =
      lastStatus === 400 || lastStatus === 403
        ? "Check that the API key in .env.local is correct and has the Gemini API enabled."
        : "Gemini is busy or the quota is exhausted. Try again in a moment.";
    return {
      error: NextResponse.json(
        { ok: false, error: `Gemini API error (${lastStatus}). ${hint}` },
        { status: 502 }
      ),
    };
  };

  // Parse a Gemini answer defensively into a receipt, or null if unusable.
  const parseReceipt = (text: string): ScannedReceipt | null => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.replace(/```(?:json)?/gi, "").trim());
    } catch {
      return null;
    }
    return validateScannedReceipt(parsed);
  };

  // First pass.
  const first = await callGemini(PROMPT);
  if ("error" in first) return first.error;
  let receipt = parseReceipt(first.text);

  // Second chance: a completely empty read (no items at all) usually means
  // a hard photo — rotated, shadowed, blurry. One insistent retry, then give up.
  if (!receipt || receipt.items.length === 0) {
    const second = await callGemini(`${PROMPT}\n${RETRY_HINT}`);
    if ("error" in second) return second.error;
    receipt = parseReceipt(second.text);
  }

  if (!receipt) {
    return NextResponse.json(
      { ok: false, error: "Couldn't read that receipt clearly enough. Try a brighter, straighter photo." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, receipt });
}
