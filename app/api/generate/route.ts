import { fal } from "@fal-ai/client";
import { NextResponse } from "next/server";

const MODEL_ID = "fal-ai/nano-banana-pro/edit";
const DEFAULT_PROMPT =
  "Interpret this rough sketch as a real-world scene and render a photorealistic image. Infer the subject from the drawing semantics (e.g. flower sketch -> real flower photo, stick figure -> real person), keep the same subject layout and pose, and add natural textures, realistic lighting, and camera-like detail. Do not output line-art, anime, cartoon, or illustration style.";
const DEFAULT_ASPECT_RATIO = "1:1";
const DEFAULT_RESOLUTION = "1K";
const DEFAULT_OUTPUT_FORMAT = "jpeg";

type GenerateRequestBody = {
  image_url?: string;
};

let falConfigured = false;

const ensureFalConfigured = (): boolean => {
  if (falConfigured) {
    return true;
  }

  const falKey = process.env.FAL_KEY;

  if (!falKey) {
    return false;
  }

  fal.config({ credentials: falKey });
  falConfigured = true;
  return true;
};

export async function POST(request: Request) {
  if (!ensureFalConfigured()) {
    return NextResponse.json(
      { error: "FAL_KEY .env.local icinde tanimli degil." },
      { status: 500 },
    );
  }

  let body: GenerateRequestBody;

  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Gecersiz JSON istegi." },
      { status: 400 },
    );
  }

  if (!body.image_url || typeof body.image_url !== "string") {
    return NextResponse.json(
      { error: "image_url alani zorunludur." },
      { status: 400 },
    );
  }

  try {
    const result = await fal.run(MODEL_ID, {
      input: {
        prompt: DEFAULT_PROMPT,
        image_urls: [body.image_url],
        aspect_ratio: DEFAULT_ASPECT_RATIO,
        resolution: DEFAULT_RESOLUTION,
        output_format: DEFAULT_OUTPUT_FORMAT,
        sync_mode: false,
        limit_generations: true,
        enable_web_search: false,
        num_images: 1,
      },
    });

    const imageUrl = result.data.images?.[0]?.url;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Fal yanitinda images[0].url bulunamadi." },
        { status: 502 },
      );
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fal istegi basarisiz oldu.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
