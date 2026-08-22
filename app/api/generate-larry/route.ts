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

const larryRoles = [
  { title: "RAPPER LARRY", prop: "Composite a small red baseball cap between Larry's ears and a thin silver chain below his chin.", backgrounds: ["a bright colorful graffiti wall", "a clean recording studio with warm lights", "a sunny outdoor basketball court", "a colorful city rooftop in daylight"] },
  { title: "SKATER LARRY", prop: "Composite a small blue backward cap between Larry's ears. Keep both ears completely visible.", backgrounds: ["a sunny skatepark", "a colorful skateboard shop", "a clean concrete ramp with stickers", "a bright beach boardwalk"] },
  { title: "CEO LARRY", prop: "Composite one tiny red necktie directly below Larry's chin.", backgrounds: ["a bright modern office", "a clean corporate boardroom", "a desk with a laptop and coffee cup", "a glass office tower in daylight"] },
  { title: "CHEF LARRY", prop: "Composite a small white chef hat centered between Larry's ears. Do not cover or reshape the ears.", backgrounds: ["a bright restaurant kitchen", "a colorful pizza counter", "a cheerful bakery", "a clean food truck window"] },
  { title: "WIZARD LARRY", prop: "Composite a small purple wizard hat between Larry's ears, with both ears fully visible.", backgrounds: ["a colorful library", "a pastel castle room", "a bright shelf of potion bottles", "a blue room with simple golden stars"] },
  { title: "COWBOY LARRY", prop: "Composite a small tan cowboy hat behind and between Larry's ears without covering them.", backgrounds: ["a sunny desert road", "a colorful western saloon", "a bright ranch fence", "a roadside diner in daylight"] },
  { title: "DETECTIVE LARRY", prop: "Composite a small beige detective fedora between Larry's ears. Keep his entire face visible.", backgrounds: ["a tidy detective office", "a simple evidence board with no readable text", "a bright desk with a magnifying glass", "a softly lit window with city rain outside"] },
  { title: "TOURIST LARRY", prop: "Composite a tiny toy camera hanging below Larry's chin. Add nothing over his face.", backgrounds: ["a bright tropical beach", "a colorful postcard-style city square", "a clean airport terminal", "a sunny mountain viewpoint"] },
  { title: "GAMER LARRY", prop: "Composite colorful gaming headphones resting around Larry's neck, not on his ears.", backgrounds: ["a bright RGB gaming room", "a colorful arcade", "a clean esports desk", "a cheerful pixel-art wall"] },
  { title: "DJ LARRY", prop: "Composite silver DJ headphones resting below Larry's chin, leaving his head and ears untouched.", backgrounds: ["a bright colorful DJ booth", "a sunny music festival stage", "a clean radio studio", "a vibrant vinyl record shop"] },
  { title: "KING LARRY", prop: "Composite a small simple gold crown floating just between Larry's ears. Do not cover the ears.", backgrounds: ["a bright red palace curtain", "a clean golden throne-room wall", "a sunny castle courtyard", "a colorful royal portrait gallery"] },
  { title: "PIRATE LARRY", prop: "Composite a small brown pirate hat between Larry's ears. Do not add an eye patch.", backgrounds: ["a sunny wooden ship deck", "a bright table with a treasure map", "a colorful tropical island", "a cheerful harbor"] },
  { title: "FISHERMAN LARRY", prop: "Composite a tiny green fishing hat between Larry's ears while keeping both ears visible.", backgrounds: ["a sunny lake", "a bright wooden pier", "a colorful fishing supply shop", "a small boat deck in daylight"] },
  { title: "MECHANIC LARRY", prop: "Composite a small blue work cap between Larry's ears. Do not add clothing or change his body.", backgrounds: ["a bright auto garage", "a clean workbench", "a colorful gas station", "an organized wall of tools"] },
  { title: "PROFESSOR LARRY", prop: "Composite a small black graduation cap between Larry's ears without covering them.", backgrounds: ["a bright classroom", "a clean university library", "a colorful science lab", "a simple green chalkboard with no text"] },
  { title: "BASKETBALL LARRY", prop: "Composite a small orange basketball cap between Larry's ears. Keep his face unchanged.", backgrounds: ["a sunny basketball court", "a bright locker room", "colorful stadium seats", "a clean street court"] },
  { title: "FOOTBALL LARRY", prop: "Composite a small colorful fan scarf loosely below Larry's chin without changing his body.", backgrounds: ["a sunny football stadium", "a bright locker room", "a clean green field", "a colorful fan wall with no text"] },
  { title: "BIKER LARRY", prop: "Composite a small red bandana loosely below Larry's chin. Do not modify his fur.", backgrounds: ["a bright roadside diner", "a sunny open highway", "a clean motorcycle garage", "a colorful desert gas station"] },
  { title: "GARDENER LARRY", prop: "Composite a small straw garden hat behind Larry's ears, leaving both ears fully visible.", backgrounds: ["a bright greenhouse", "a colorful flower garden", "a clean potting bench", "a sunny vegetable patch"] },
  { title: "PHOTOGRAPHER LARRY", prop: "Composite a tiny camera hanging below Larry's chin, with no strap covering his face.", backgrounds: ["a bright photo studio", "a sunny scenic overlook", "a colorful gallery wall", "a cheerful city street"] },
  { title: "MAILMAN LARRY", prop: "Composite a small blue mail cap between Larry's ears. Do not cover the ears.", backgrounds: ["a bright row of colorful mailboxes", "a clean mail sorting room", "a sunny front porch", "a colorful delivery van"] },
  { title: "PILOT LARRY", prop: "Composite a small pilot cap centered between Larry's ears, preserving their exact shape.", backgrounds: ["a bright airplane cockpit", "a sunny airport window", "a clean aircraft hangar", "a simple blue-sky background with white clouds"] },
  { title: "SAILOR LARRY", prop: "Composite a small white sailor cap between Larry's ears. Keep his face fully unobstructed.", backgrounds: ["a sunny ship deck", "a bright marina", "a colorful seaside town", "a clean blue-and-white striped wall"] },
  { title: "DISCO LARRY", prop: "Composite one small silver bow tie directly below Larry's chin.", backgrounds: ["a bright room with colorful disco balls", "a cheerful retro dance floor", "a vibrant vinyl record shop", "a colorful 1970s living room"] },
  { title: "HOLIDAY LARRY", prop: "Composite a small red holiday hat between Larry's ears, keeping both ears visible and unchanged.", backgrounds: ["a bright cozy room with gifts", "a sunny snowy porch", "a colorful gift-wrap wall", "a cheerful candy-cane backdrop"] },
] as const;

const larryPrompts = larryRoles.flatMap((role) => role.backgrounds.map((background, variant) => ({
  id: `${role.title}-${variant + 1}`,
  title: role.title,
  edit: `${role.prop} Replace only the existing background with ${background}.`,
})));

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

  const sourceUrl = new URL("/assets/larry-meme-original.jpg", request.url);
  const sourceResponse = await fetch(sourceUrl);
  if (!sourceResponse.ok) {
    return NextResponse.json({ error: "Larry reference file is unavailable." }, { status: 500 });
  }

  const referenceImage = toBase64(await sourceResponse.arrayBuffer());
  const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
  const selectedPrompt = larryPrompts[randomValue % larryPrompts.length];
  const prompt = [
    "CRITICAL IDENTITY LOCK: treat Larry in the supplied photo as an immutable photographic foreground cutout.",
    "DO NOT redraw, regenerate, reinterpret, retouch, restore, enhance, sharpen, denoise, relight, recolor, beautify, stylize, or add detail to Larry.",
    "DO NOT change even slightly Larry's face, eyes, eye reflections, nose, mouth, oversized ears, fur, silhouette, body, proportions, pose, expression, camera angle, crop, original softness, or low-resolution photographic texture.",
    "Do not invent paws, legs, clothing, extra fur, another cat, or any person. Preserve the original Larry pixels wherever they are not covered by the requested separate prop overlay.",
    "This must look like a simple funny photo edit: the same exact Larry photo, one small composited accessory, and one replaced background.",
    "Keep Larry's face, eyes, and both ears clearly visible. Use bright, cheerful, even lighting. No black background, darkness, horror, fog, smoke, dramatic shadows, cinematic grading, text, watermark, or logo.",
    "Create one square 1024x1024 avatar and keep Larry at the same central scale as the input.",
    selectedPrompt.edit,
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

  return NextResponse.json({
    image: image.data,
    mimeType: image.mimeType || "image/png",
    presetId: selectedPrompt.id,
    presetName: selectedPrompt.title,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
