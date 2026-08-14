import React, { useState, useEffect } from "react";
import { Download, QrCode, Copy, Check } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  title?: string;
}

export function QRCodeView({
  value,
  size = 240,
  fgColor = "#0f172a",
  bgColor = "#ffffff",
  title = "Form QR Code",
}: QRCodeGeneratorProps) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    async function generateQR() {
      try {
        setLoading(true);
        // Generate high-resolution Data URL (PNG) with Error Correction Level H
        const url = await QRCode.toDataURL(value, {
          width: size * 3, // High DPI resolution for crisp printing & camera scanning
          margin: 1.5,
          color: {
            dark: fgColor,
            light: bgColor,
          },
          errorCorrectionLevel: "H", // High error correction level for 100% reliable camera scanning
        });

        if (isMounted) {
          setDataUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.error("QR Code generation error", err);
        if (isMounted) setLoading(false);
      }
    }

    if (value) {
      generateQR();
    }
  }, [value, size, fgColor, bgColor]);

  const downloadPNG = () => {
    if (!dataUrl) return;
    const downloadLink = document.createElement("a");
    downloadLink.href = dataUrl;
    downloadLink.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success("High-resolution QR Code downloaded!");
  };

  const copyImageToClipboard = async () => {
    if (!dataUrl) return;
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      setCopied(true);
      toast.success("QR Code image copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info("Image copy not supported in browser. Use download instead!");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-5 text-card-foreground shadow-sm">
      {/* QR Code Container */}
      <div
        className="relative rounded-xl p-3 shadow-inner flex items-center justify-center border transition-transform hover:scale-[1.02]"
        style={{ backgroundColor: bgColor }}
      >
        {loading ? (
          <div
            className="flex items-center justify-center animate-pulse text-xs text-muted-foreground font-mono"
            style={{ width: size, height: size }}
          >
            Generating QR...
          </div>
        ) : (
          <img
            src={dataUrl}
            alt={title}
            width={size}
            height={size}
            className="rounded-lg object-contain shadow-xs"
          />
        )}
      </div>

      <div className="flex w-full items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <QrCode className="size-4 text-primary shrink-0" />
          <span>Point camera to scan form</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={copyImageToClipboard}
            disabled={loading || !dataUrl}
            className="h-8 text-xs gap-1"
            title="Copy QR Image to Clipboard"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </Button>

          <Button
            size="sm"
            onClick={downloadPNG}
            disabled={loading || !dataUrl}
            className="h-8 text-xs gap-1.5 font-semibold"
          >
            <Download className="size-3.5" />
            <span>Download PNG</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
