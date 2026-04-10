"use client";

import { useEffect, useRef, useState } from "react";

const CANVAS_SIZE = 512;
const DRAWING_SYNC_DEBOUNCE_MS = 120;
const AUTO_UPDATE_INTERVAL_MS = 500;
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
  const isGeneratingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const drawingSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const autoUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoUpdateAtRef = useRef(0);
  const hasPendingAutoUpdateRef = useRef(false);
  const [drawingData, setDrawingData] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [isAutoUpdateEnabled, setIsAutoUpdateEnabled] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");

  useEffect(() => {
    isGeneratingRef.current = isGenerating;

    if (
      !isGenerating &&
      isAutoUpdateEnabled &&
      isDrawingRef.current &&
      hasPendingAutoUpdateRef.current
    ) {
      hasPendingAutoUpdateRef.current = false;

      const elapsed = Date.now() - lastAutoUpdateAtRef.current;
      const waitTime = Math.max(AUTO_UPDATE_INTERVAL_MS - elapsed, 0);

      if (autoUpdateTimerRef.current) {
        clearTimeout(autoUpdateTimerRef.current);
      }

      autoUpdateTimerRef.current = setTimeout(() => {
        autoUpdateTimerRef.current = null;

        if (!isAutoUpdateEnabled || !isDrawingRef.current) {
          return;
        }

        const nextDrawingData = syncDrawingData();

        if (!nextDrawingData || isGeneratingRef.current) {
          return;
        }

        lastAutoUpdateAtRef.current = Date.now();
        void generateImageFromCanvas(nextDrawingData, {
          showValidationError: false,
        });
      }, waitTime);
    }
  }, [isGenerating, isAutoUpdateEnabled]);

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

      if (autoUpdateTimerRef.current) {
        clearTimeout(autoUpdateTimerRef.current);
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

    const nextDrawingData = canvas.toDataURL("image/png");
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

  const queueAutoUpdate = () => {
    if (!isAutoUpdateEnabled || !isDrawingRef.current) {
      return;
    }

    const elapsed = Date.now() - lastAutoUpdateAtRef.current;
    const shouldRunNow = elapsed >= AUTO_UPDATE_INTERVAL_MS;

    if (shouldRunNow) {
      if (isGeneratingRef.current) {
        hasPendingAutoUpdateRef.current = true;
        return;
      }

      const nextDrawingData = syncDrawingData();

      if (!nextDrawingData) {
        return;
      }

      lastAutoUpdateAtRef.current = Date.now();
      void generateImageFromCanvas(nextDrawingData, {
        showValidationError: false,
      });
      return;
    }

    if (autoUpdateTimerRef.current) {
      return;
    }

    autoUpdateTimerRef.current = setTimeout(() => {
      autoUpdateTimerRef.current = null;

      if (!isAutoUpdateEnabled || !isDrawingRef.current) {
        return;
      }

      if (isGeneratingRef.current) {
        hasPendingAutoUpdateRef.current = true;
        return;
      }

      const nextDrawingData = syncDrawingData();

      if (!nextDrawingData) {
        return;
      }

      lastAutoUpdateAtRef.current = Date.now();
      void generateImageFromCanvas(nextDrawingData, {
        showValidationError: false,
      });
    }, AUTO_UPDATE_INTERVAL_MS - elapsed);
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

    setIsGenerating(true);
    setGenerationError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_url }),
      });

      const payload = (await response.json()) as GenerateApiResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "API istegi basarisiz oldu.");
      }

      const imageUrl = payload.imageUrl;

      if (!imageUrl) {
        throw new Error("API yanitinda imageUrl bulunamadi.");
      }

      setGeneratedImageUrl(imageUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Fal istegi basarisiz oldu.";
      setGenerationError(message);
    } finally {
      setIsGenerating(false);
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
    lastAutoUpdateAtRef.current = Date.now();
    hasPendingAutoUpdateRef.current = false;

    ctx.beginPath();
    ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
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

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(nextPoint.x, nextPoint.y);
    ctx.stroke();

    lastPointRef.current = nextPoint;
    syncDrawingDataDebounced();
    queueAutoUpdate();
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

    if (autoUpdateTimerRef.current) {
      clearTimeout(autoUpdateTimerRef.current);
      autoUpdateTimerRef.current = null;
    }

    hasPendingAutoUpdateRef.current = false;

    const nextDrawingData = syncDrawingData();

    if (nextDrawingData) {
      void generateImageFromCanvas(nextDrawingData, {
        showValidationError: false,
      });
    }
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

    if (autoUpdateTimerRef.current) {
      clearTimeout(autoUpdateTimerRef.current);
      autoUpdateTimerRef.current = null;
    }

    hasPendingAutoUpdateRef.current = false;

    setDrawingData("");
    setGeneratedImageUrl("");
    setGenerationError("");
  };

  return (
    <main className="pageShell">
      <div className="workspace">
        <section className="panel">
          <h2 className="panelTitle">Canvas Cizim Alani</h2>
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="drawingCanvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
          <button type="button" className="clearButton" onClick={handleClear}>
            Temizle
          </button>
          <label className="autoUpdateToggle">
            <input
              type="checkbox"
              checked={isAutoUpdateEnabled}
              onChange={(event) => setIsAutoUpdateEnabled(event.target.checked)}
            />
            Auto-Update (mousemove sirasinda her 500ms)
          </label>
          {generationError ? (
            <p className="errorText">{generationError}</p>
          ) : null}
        </section>

        <section className="panel">
          <h2 className="panelTitle">AI Gorsel Ciktisi</h2>
          <div className="imageFrame">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={generatedImageUrl || drawingData || AI_PLACEHOLDER}
              alt="Uretilen AI gorseli"
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className={`resultImage${isGenerating ? " resultImageLoading" : ""}`}
            />
          </div>
          {isGenerating ? <p className="statusText">Uretiliyor...</p> : null}
        </section>
      </div>
    </main>
  );
}
