import { useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";

function QrCodeDialog({ link, onClose }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function downloadQrCode() {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) {
      return;
    }

    const downloadLink = document.createElement("a");
    downloadLink.download = `shortly-${link.code}-qr.png`;
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.click();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="qr-dialog-title"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-ink dark:text-white" id="qr-dialog-title">QR code</h2>
            <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{link.shortUrl}</p>
          </div>
          <button
            aria-label="Close QR code dialog"
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>
        <div className="my-6 flex justify-center rounded-xl bg-white p-4" ref={canvasRef}>
          <QRCodeCanvas
            aria-label={`QR code for ${link.shortUrl}`}
            includeMargin
            size={224}
            value={link.shortUrl}
          />
        </div>
        <button
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-600 focus:outline-none focus:ring-4 focus:ring-accent/20"
          onClick={downloadQrCode}
          type="button"
        >
          Download PNG
        </button>
      </section>
    </div>
  );
}

export default QrCodeDialog;
