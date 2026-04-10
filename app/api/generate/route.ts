import { fal } from "@fal-ai/client";
import { NextResponse } from "next/server";

const MODEL_ID = "fal-ai/lcm-sd15-i2i";
const DEFAULT_PROMPT =
  "masterpiece, detailed, vibrant, high quality image, preserve the sketch composition";
const DEFAULT_NEGATIVE_PROMPT =
  "black image, blank image, low contrast, underexposed, very dark, blurry, noisy";
const DEFAULT_STRENGTH = 0.6;
const DEFAULT_NUM_INFERENCE_STEPS = 4;

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
    const result = await fal.subscribe(MODEL_ID, {
      input: {
        prompt: DEFAULT_PROMPT,
        image_url: body.image_url,
        negative_prompt: DEFAULT_NEGATIVE_PROMPT,
        sync_mode: true,
        strength: DEFAULT_STRENGTH,
        num_inference_steps: DEFAULT_NUM_INFERENCE_STEPS,
        enable_safety_checks: false,
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
