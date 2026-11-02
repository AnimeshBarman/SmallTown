"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";

type PropertyPhotoViewerProps = {
  images: string[];
  title: string;
  initialIndex: number;
  onClose: () => void;
};

type Point = { x: number; y: number };
type Gesture = {
  mode: "pinch" | "pan" | "swipe";
  pointerId: number;
  startX: number;
  startY: number;
  startDistance: number;
  startScale: number;
  startPanX: number;
  startPanY: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export default function PropertyPhotoViewer({
  images,
  title,
  initialIndex,
  onClose,
}: PropertyPhotoViewerProps) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(MIN_SCALE);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);

  const changePhoto = (nextIndex: number) => {
    setIndex((nextIndex + images.length) % images.length);
    setScale(MIN_SCALE);
    setPan({ x: 0, y: 0 });
    pointers.current.clear();
    gesture.current = null;
  };

  const changeScale = (nextScale: number) => {
    const boundedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    setScale(boundedScale);
    if (boundedScale === MIN_SCALE) setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && images.length > 1) {
        event.preventDefault();
        setIndex((current) => (current - 1 + images.length) % images.length);
        setScale(MIN_SCALE);
        setPan({ x: 0, y: 0 });
        pointers.current.clear();
        gesture.current = null;
      } else if (event.key === "ArrowRight" && images.length > 1) {
        event.preventDefault();
        setIndex((current) => (current + 1) % images.length);
        setScale(MIN_SCALE);
        setPan({ x: 0, y: 0 });
        pointers.current.clear();
        gesture.current = null;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [images.length]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const activePoints = Array.from(pointers.current.values());
    if (activePoints.length >= 2) {
      const [first, second] = activePoints;
      gesture.current = {
        mode: "pinch",
        pointerId: event.pointerId,
        startX: 0,
        startY: 0,
        startDistance: Math.hypot(first.x - second.x, first.y - second.y),
        startScale: scale,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      return;
    }

    gesture.current = {
      mode: scale > MIN_SCALE ? "pan" : "swipe",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startDistance: 0,
      startScale: scale,
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const activeGesture = gesture.current;
    if (!activeGesture) return;

    const activePoints = Array.from(pointers.current.values());
    if (activeGesture.mode === "pinch" && activePoints.length >= 2) {
      const [first, second] = activePoints;
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (activeGesture.startDistance > 0) {
        changeScale(activeGesture.startScale * distance / activeGesture.startDistance);
      }
      return;
    }

    if (activeGesture.mode === "pan" && event.pointerId === activeGesture.pointerId) {
      const stage = stageRef.current;
      const maxX = stage ? stage.clientWidth * (scale - 1) / 2 : 400;
      const maxY = stage ? stage.clientHeight * (scale - 1) / 2 : 400;
      setPan({
        x: Math.max(-maxX, Math.min(maxX, activeGesture.startPanX + event.clientX - activeGesture.startX)),
        y: Math.max(-maxY, Math.min(maxY, activeGesture.startPanY + event.clientY - activeGesture.startY)),
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const activeGesture = gesture.current;
    const point = pointers.current.get(event.pointerId);
    pointers.current.delete(event.pointerId);

    if (activeGesture?.mode === "swipe" && point && images.length > 1) {
      const deltaX = point.x - activeGesture.startX;
      const deltaY = point.y - activeGesture.startY;
      if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
        changePhoto(index + (deltaX < 0 ? 1 : -1));
        return;
      }
    }

    const remaining = Array.from(pointers.current.entries());
    if (remaining.length === 1) {
      const [pointerId, remainingPoint] = remaining[0];
      gesture.current = {
        mode: scale > MIN_SCALE ? "pan" : "swipe",
        pointerId,
        startX: remainingPoint.x,
        startY: remainingPoint.y,
        startDistance: 0,
        startScale: scale,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    } else {
      gesture.current = null;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} photos`}
      className="fixed inset-0 z-70 flex h-dvh flex-col bg-stone-950 text-white"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="rounded-full p-2.5 transition hover:bg-white/15"
        >
          <X size={23} />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium">{title}</p>
        <span className="min-w-16 text-right text-sm tabular-nums text-white/75">
          {index + 1} / {images.length}
        </span>
      </header>

      <div
        ref={stageRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        style={{ touchAction: "none", userSelect: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <Image
          src={images[index]}
          alt={`${title}, photo ${index + 1}`}
          draggable={false}
          fill
          sizes="100vw"
          unoptimized
          className="object-contain"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            transformOrigin: "center",
          }}
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => changePhoto(index - 1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 transition hover:bg-black/75 sm:left-6"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              onClick={() => changePhoto(index + 1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-3 transition hover:bg-black/75 sm:right-6"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      <footer className="flex h-16 shrink-0 items-center justify-center gap-3 px-4">
        <button
          type="button"
          onClick={() => changeScale(scale - 0.5)}
          disabled={scale <= MIN_SCALE}
          aria-label="Zoom out"
          className="rounded-full bg-white/10 p-2.5 transition hover:bg-white/20 disabled:opacity-40"
        >
          <ZoomOut size={20} />
        </button>
        <span className="min-w-14 text-center text-sm tabular-nums">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => changeScale(scale + 0.5)}
          disabled={scale >= MAX_SCALE}
          aria-label="Zoom in"
          className="rounded-full bg-white/10 p-2.5 transition hover:bg-white/20 disabled:opacity-40"
        >
          <ZoomIn size={20} />
        </button>
        <span className="ml-2 hidden text-xs text-white/60 sm:inline">Pinch to zoom · swipe to change photos</span>
      </footer>
    </div>
  );
}
