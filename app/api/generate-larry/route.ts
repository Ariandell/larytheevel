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
    "Transform the uploaded photo into a cosplay: add hair, a mask, armor, makeup, a weapon, and/or accessories at your discretion.",
    "Choose a coherent cosplay concept yourself and make it visually fun and distinctive.",
    "Preserve Larry's original pose, facial identity, proportions, camera angle, and the original lighting direction.",
    "Adjust the colors, reflections, contact shadows, and material shadows of every added element for a realistic, seamless blend with the original photograph.",
    "Keep Larry clearly recognizable as the same cat from the uploaded photo.",
    "High quality, square 1:1 aspect ratio.",
    "Negative: no distortions, no face blurring, no artifacts, no duplicate subject, no extra limbs, no malformed accessories, no text, no logo, and no watermark.",
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
