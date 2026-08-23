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

const cosplayPrompt = {
  id: "COSPLAY-LARRY",
  title: "COSPLAY LARRY",
  edit: [
    "Edit the uploaded Larry photo into a cosplay while using the original photograph as the unchanged base image, not as inspiration for a new image.",
    "ABSOLUTE FACE LOCK: preserve Larry's complete original face pixel-for-pixel, including both eyes and their reflections, forehead, cheeks, nose, muzzle, mouth, ears, facial fur, proportions, expression, and identity.",
    "The entire face and both eyes must remain fully visible and completely unobstructed.",
    "Do not redraw, regenerate, retouch, enhance, sharpen, stylize, relight, recolor, or replace any part of Larry's face or head.",
    "At your discretion, add an open-face cosplay using armor or clothing below the neck, a weapon beside the body, and accessories positioned only around, above, or below the face without overlapping it.",
    "Do not add a mask, visor, eyewear, face paint, makeup, facial jewelry, or hair over the face.",
    "Preserve the original pose, camera angle, crop, and lighting. Adjust only the colors and shadows of the added costume elements for a realistic, seamless blend.",
    "High quality costume details, square 1:1 aspect ratio.",
    "Negative: changed face, covered face, obscured eyes, altered eyes, altered ears, altered fur, new facial details, distortions, face blurring, artifacts, duplicate subject, extra limbs, text, logo, watermark.",
  ].join(" "),
} as const;

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

  const sourceUrl = new URL("/assets/larry-cosplay-reference.png", request.url);
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) {
    return NextResponse.json({ error: "Larry reference file is unavailable." }, { status: 500 });
  }

  const referenceImage = toBase64(await sourceResponse.arrayBuffer());
  const prompt = cosplayPrompt.edit;

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
            { inlineData: { mimeType: "image/png", data: referenceImage } },
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

  return NextResponse.json({
    image: image.data,
    mimeType: image.mimeType || "image/png",
    presetId: cosplayPrompt.id,
    presetName: cosplayPrompt.title,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
