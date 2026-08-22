import { NextRequest, NextResponse } from "next/server";

const model = "gemini-3.1-flash-lite-image";
const requestCooldownMs = 20_000;
const defaultGenerationLimit = 1000;

type GeneratorGuard = {
  completed: number;
  nextRequestByClient: Map<string, number>;
};

const generatorGuard = globalThis as typeof globalThis & { __larryGeneratorGuard?: GeneratorGuard };
const guard = generatorGuard.__larryGeneratorGuard ??= {
  completed: 0,
  nextRequestByClient: new Map(),
};
const styles: Record<string, string> = {
  "NIGHT WATCH": "Place Larry in a dim abandoned night-security office. CRT monitors glow faintly behind him, a desk fan turns slowly, and cold blue emergency light cuts through the darkness. Cinematic surveillance-horror photography.",
  "CURSED ID": "Create a haunted analogue identification portrait. Give the scene worn film grain, a black evidence-board background, subtle VHS scan lines, a small red case stamp, and a cold flash-photography look. No readable text.",
  "MEME LORD": "Make a surreal high-end internet meme portrait: Larry sits on an absurdly dramatic tiny throne, wears a small gold crown, and is surrounded by floating snack offerings. Keep the image funny, polished, photographic, and not cartoonish.",
  "VOID ICON": "Place Larry in an elegant cosmic black void with a restrained purple eclipse halo, sparse stars, and dramatic rim light. Make it a clean, iconic profile avatar with photographic fur detail.",
};

function toBase64(bytes: ArrayBuffer) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let index = 0; index < view.length; index += 0x8000) {
    binary += String.fromCharCode(...view.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Generator is not configured yet." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { style?: string } | null;
  const style = body?.style;
  if (!style || !styles[style]) {
    return NextResponse.json({ error: "Unknown summoning profile." }, { status: 400 });
  }

  const configuredLimit = Number.parseInt(process.env.GENERATION_LIMIT || "", 10);
  const generationLimit = Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : defaultGenerationLimit;
  if (guard.completed >= generationLimit) {
    return NextResponse.json({ error: "The summoning quota has been exhausted." }, { status: 429 });
  }

  const clientId = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const now = Date.now();
  const nextAllowedAt = guard.nextRequestByClient.get(clientId) || 0;
  if (now < nextAllowedAt) {
    return NextResponse.json({ error: "The terminal needs a moment before the next summoning." }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil((nextAllowedAt - now) / 1000)) },
    });
  }
  guard.nextRequestByClient.set(clientId, now + requestCooldownMs);

  const sourceUrl = new URL("/assets/larry-meme-original.jpg", request.url);
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) {
    return NextResponse.json({ error: "Larry reference file is unavailable." }, { status: 500 });
  }

  const referenceImage = toBase64(await sourceResponse.arrayBuffer());
  const prompt = [
    "Use the supplied photo as the locked identity reference for Larry.",
    "Preserve Larry exactly: the same black Oriental Shorthair cat, same face, eyes, oversized ears, fur color, body proportions, pose, and expression.",
    "Do not replace, redraw, morph, stylize, crop, or alter Larry himself. Do not add other cats or people.",
    "Only change the environment and add the requested props around him.",
    "Create one square 1024x1024 photographic avatar. Larry must remain clear, centered, recognizable, and dominant in the composition.",
    styles[style],
  ].join(" ");

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: referenceImage } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
        },
      }),
    },
  );

  const payload = await geminiResponse.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
    error?: { message?: string };
  };
  if (!geminiResponse.ok) {
    return NextResponse.json({ error: payload.error?.message || "Gemini did not accept the request." }, { status: 502 });
  }

  const image = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!image?.data) {
    return NextResponse.json({ error: "Gemini returned no image." }, { status: 502 });
  }

  guard.completed += 1;

  return NextResponse.json({ image: image.data, mimeType: image.mimeType || "image/png" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
