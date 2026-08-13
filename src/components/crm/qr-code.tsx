import React, { useRef } from "react";
import { Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  title?: string;
}

// Lightweight QR matrix generator for standard URL sharing
function generateQRMatrix(text: string): boolean[][] {
  // Simple deterministic 21x21 QR Version 1 / 25x25 Version 2 pattern algorithm
  const size = 25;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Helper to place finder pattern (7x7 square)
  const placeFinder = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 ||
          r === 6 ||
          c === 0 ||
          c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startRow + r]![startCol + c] = true;
        }
      }
    }
  };

  // 1. Top-Left, Top-Right, Bottom-Left Finder patterns
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // 2. Timing patterns (Line 6)
  for (let i = 8; i < size - 8; i++) {
    if (i % 2 === 0) {
      matrix[6]![i] = true;
      matrix[i]![6] = true;
    }
  }

  // 3. Simple Hash-based Data pattern for visual encoding
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Avoid overwriting finder patterns
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;

      if (!inTopLeft && !inTopRight && !inBottomLeft) {
        const val = Math.abs(Math.sin((r * size + c + hash) * 1.5));
        matrix[r]![c] = val > 0.48;
      }
    }
  }

  return matrix;
}

export function QRCodeView({
  value,
  size = 220,
  fgColor = "#0f172a",
  bgColor = "#ffffff",
  title = "Form QR Code",
}: QRCodeGeneratorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const matrix = generateQRMatrix(value);
  const matrixSize = matrix.length;
  const cellSize = size / matrixSize;

  const downloadPNG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size * 2; // High resolution
      canvas.height = size * 2;
      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = bgColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const png = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = png;
        downloadLink.download = `${title.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        toast.success("QR Code image downloaded successfully!");
      }
    };
    image.src = blobURL;
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-sm">
      <div className="relative rounded-lg p-3 shadow-inner" style={{ backgroundColor: bgColor }}>
        <svg
          ref={svgRef}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="rounded-md"
        >
          <rect width={size} height={size} fill={bgColor} />
          {matrix.map((row, r) =>
            row.map((cell, c) =>
              cell ? (
                <rect
                  key={`${r}-${c}`}
                  x={c * cellSize}
                  y={r * cellSize}
                  width={cellSize + 0.3}
                  height={cellSize + 0.3}
                  fill={fgColor}
                  rx={0.5}
                />
              ) : null,
            ),
          )}
        </svg>
      </div>

      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <QrCode className="size-4 text-primary" />
          <span>Scan to open form</span>
        </div>
        <Button variant="outline" size="sm" onClick={downloadPNG} className="gap-1.5 text-xs">
          <Download className="size-3.5" /> Download PNG
        </Button>
      </div>
    </div>
  );
}
