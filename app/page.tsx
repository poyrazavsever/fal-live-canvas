"use client";

import { useEffect, useRef, useState } from "react";

const CANVAS_SIZE = 512;
const DRAWING_SYNC_DEBOUNCE_MS = 120;
const CANVAS_EXPORT_QUALITY = 0.82;
const AI_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#f3f4f6"/><path d="M56 392l112-128 80 96 64-72 144 104" fill="none" stroke="#9ca3af" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><circle cx="188" cy="164" r="38" fill="#d1d5db"/><text x="50%" y="470" font-size="28" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif">AI Gorsel Alani</text></svg>',
)}`;

type Point = {
  x: number;
  y: number;
};

type GenerateApiResponse = {
  imageUrl?: string;
  error?: string;
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const drawingSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const activeRequestControllerRef = useRef<AbortController | null>(null);
  const generationRequestIdRef = useRef(0);
  const [drawingData, setDrawingData] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [brushColor, setBrushColor] = useState("#000000");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#000000";
  }, []);

  useEffect(() => {
    return () => {
      if (drawingSyncTimerRef.current) {
        clearTimeout(drawingSyncTimerRef.current);
      }

      if (activeRequestControllerRef.current) {
        activeRequestControllerRef.current.abort();
      }
    };
  }, []);

  const getPointerPosition = (
    event: React.MouseEvent<HTMLCanvasElement>,
  ): Point | null => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const syncDrawingData = (): string => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return "";
    }

    const nextDrawingData = canvas.toDataURL(
      "image/jpeg",
      CANVAS_EXPORT_QUALITY,
    );
    setDrawingData(nextDrawingData);
    return nextDrawingData;
  };

  const syncDrawingDataDebounced = () => {
    if (drawingSyncTimerRef.current) {
      clearTimeout(drawingSyncTimerRef.current);
    }

    drawingSyncTimerRef.current = setTimeout(() => {
      syncDrawingData();
      drawingSyncTimerRef.current = null;
    }, DRAWING_SYNC_DEBOUNCE_MS);
  };

  const generateImageFromCanvas = async (
    image_url: string,
    options?: { showValidationError?: boolean },
  ) => {
    const showValidationError = options?.showValidationError ?? true;

    if (!image_url) {
      if (showValidationError) {
        setGenerationError("Lutfen once canvas uzerine bir cizim yap.");
      }

      return;
    }

    if (activeRequestControllerRef.current) {
      activeRequestControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeRequestControllerRef.current = controller;
    const requestId = ++generationRequestIdRef.current;

    setIsGenerating(true);
    setGenerationError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_url }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as GenerateApiResponse;

      if (requestId !== generationRequestIdRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "API istegi basarisiz oldu.");
      }

      const imageUrl = payload.imageUrl;

      if (!imageUrl) {
        throw new Error("API yanitinda imageUrl bulunamadi.");
      }

      setGeneratedImageUrl(imageUrl);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (requestId !== generationRequestIdRef.current) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "Fal istegi basarisiz oldu.";
      setGenerationError(message);
    } finally {
      if (requestId === generationRequestIdRef.current) {
        activeRequestControllerRef.current = null;
        setIsGenerating(false);
      }
    }
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    const point = getPointerPosition(event);

    if (!ctx || !point) {
      return;
    }

    isDrawingRef.current = true;
    lastPointRef.current = point;

    ctx.beginPath();
    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = brushColor;
    ctx.fill();
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    const nextPoint = getPointerPosition(event);

    if (!ctx || !nextPoint || !lastPointRef.current) {
      return;
    }

    ctx.strokeStyle = brushColor;
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(nextPoint.x, nextPoint.y);
    ctx.stroke();

    lastPointRef.current = nextPoint;
    syncDrawingDataDebounced();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) {
      return;
    }

    isDrawingRef.current = false;
    lastPointRef.current = null;

    if (drawingSyncTimerRef.current) {
      clearTimeout(drawingSyncTimerRef.current);
      drawingSyncTimerRef.current = null;
    }

    syncDrawingData();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (drawingSyncTimerRef.current) {
      clearTimeout(drawingSyncTimerRef.current);
      drawingSyncTimerRef.current = null;
    }

    if (activeRequestControllerRef.current) {
      activeRequestControllerRef.current.abort();
      activeRequestControllerRef.current = null;
      generationRequestIdRef.current += 1;
    }

    setDrawingData("");
    setGeneratedImageUrl("");
    setGenerationError("");
    setIsGenerating(false);
  };

  const handleGenerateClick = () => {
    const latestDrawingData = syncDrawingData();
    void generateImageFromCanvas(latestDrawingData);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_20%,#fff7ed_0%,#f5f3ff_32%,#eef2ff_100%)]">
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-amber-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-16 h-80 w-80 rounded-full bg-cyan-300/40 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <header className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur md:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Live Sketch to Image
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-4xl">
            Cizimini AI ile Aninda Sahneye Donustur
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
            Solda renkli cizimini yap, sonra Olustur butonuna bas. Fal modeli,
            cizimini referans alarak yeni bir gorsele cevirir.
          </p>
        </header>

        <div className="grid min-h-[70vh] gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.09)] backdrop-blur md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
                Canvas Cizim Alani
              </h2>
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                512 x 512
              </span>
            </div>

            <div className="grid place-items-center rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="aspect-square w-full max-w-[512px] cursor-crosshair rounded-xl border border-slate-300 bg-white shadow-inner"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="brushColor"
                className="text-sm font-medium text-slate-700"
              >
                Kalem Rengi
              </label>
              <input
                id="brushColor"
                type="color"
                className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-transparent p-1"
                value={brushColor}
                onChange={(event) => setBrushColor(event.target.value)}
              />
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Temizle
              </button>
              <button
                type="button"
                onClick={handleGenerateClick}
                disabled={isGenerating}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? "Uretiliyor..." : "Olustur"}
              </button>
            </div>

            {generationError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {generationError}
              </p>
            ) : null}
          </section>

          <section className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.09)] backdrop-blur md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
                AI Gorsel Ciktisi
              </h2>
              {isGenerating ? (
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                  Isleniyor
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Hazir
                </span>
              )}
            </div>

            <div className="grid flex-1 place-items-center rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedImageUrl || drawingData || AI_PLACEHOLDER}
                alt="Uretilen AI gorseli"
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className={`aspect-square w-full max-w-[512px] rounded-xl border border-slate-300 bg-white shadow-sm transition ${
                  isGenerating ? "animate-pulse opacity-55" : "opacity-100"
                }`}
              />
            </div>

            <p className="text-sm text-slate-500">
              Ipucu: Daha net cizgiler ve belirgin sekiller, modelin daha
              anlamli sonuc uretmesini saglar.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
