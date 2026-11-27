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

const PROMPT = `You are reading a restaurant receipt photo. Return ONLY a JSON object — no markdown, no code fences, no explanation — in exactly this shape:
{"items":[{"name":"string","price":number,"qty":number}],"subtotal":number,"tax":number,"service":number,"total":number,"currency":"string"}
Rules:
- price is the UNIT price of one item, in the receipt's currency (e.g. 85000 for 85.000đ).
- qty is how many of that item were ordered; use 1 when the receipt doesn't say.
- subtotal, tax, service, total are the amounts printed on the receipt (0 if absent).
- currency is the ISO code shown on the receipt, e.g. "VND", "USD", "EUR".
- If the photo is unreadable, return {"items":[],"subtotal":0,"tax":0,"service":0,"total":0,"currency":"VND"}.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "GEMINI_API_KEY is not set on the server (.env.local)." },
      { status: 500 }
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

  // Try the flash model first; on 503/429 (overload/rate limit) fall back to
  // other flash variants so a busy moment doesn't break scanning.
  const modelsToTry = [MODEL, ...FALLBACK_MODELS];
  let geminiRes: Response | null = null;
  let lastStatus = 0;
  let lastDetail = "";
  for (const model of modelsToTry) {
    try {
      geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: mimeType, data: base64 } },
                  { text: PROMPT },
                ],
              },
            ],
            generationConfig: {
              response_mime_type: "application/json", // ask Gemini for raw JSON
              temperature: 0, // deterministic reading
            },
          }),
        }
      );
    } catch {
      return NextResponse.json(
        { ok: false, error: "Could not reach the Gemini API. Check the server internet connection." },
        { status: 502 }
      );
    }
    lastStatus = geminiRes.status;
    if (geminiRes.ok) break;
    lastDetail = await geminiRes.text().catch(() => "");
    console.error(`Gemini ${model} error`, lastStatus, lastDetail.slice(0, 300));
    if (lastStatus !== 503 && lastStatus !== 429) break; // real errors (bad key etc.) — don't retry
  }

  if (!geminiRes || !geminiRes.ok) {
    const hint =
      lastStatus === 400 || lastStatus === 403
        ? "Check that the API key in .env.local is correct and has the Gemini API enabled."
        : "Gemini is busy or the quota is exhausted. Try again in a moment.";
    return NextResponse.json(
      { ok: false, error: `Gemini API error (${lastStatus}). ${hint}` },
      { status: 502 }
    );
  }

  const payload = await geminiRes.json();
  // The model's text answer is in candidates[0].content.parts[0].text
  const text: unknown = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    return NextResponse.json(
      { ok: false, error: "Gemini returned no text." },
      { status: 502 }
    );
  }

  // Parse defensively: strip any ```json fences just in case.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/```(?:json)?/gi, "").trim());
  } catch {
    return NextResponse.json(
      { ok: false, error: "Gemini's answer was not valid JSON." },
      { status: 502 }
    );
  }

  const receipt: ScannedReceipt | null = validateScannedReceipt(parsed);
  if (!receipt) {
    return NextResponse.json(
      { ok: false, error: "Gemini's answer had an unexpected shape." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, receipt });
}
