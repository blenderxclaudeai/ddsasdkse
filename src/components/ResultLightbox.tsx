import { useEffect, useCallback } from "react";
import { X, Download, Share2, ExternalLink, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TryonResult {
  id: string;
  title: string | null;
  image_url: string;
  result_image_url: string | null;
  status: string;
  price: string | null;
  page_url: string;
  retailer_domain: string | null;
}

interface ResultLightboxProps {
  result: TryonResult;
  onClose: () => void;
  onDownload: (r: TryonResult) => void;
  onShare: (r: TryonResult) => void;
  onDelete: (r: TryonResult) => void;
  affiliateUrl: string;
  compareMode: boolean;
  onToggleCompare: () => void;
}

export default function ResultLightbox({
  result,
  onClose,
  onDownload,
  onShare,
  onDelete,
  affiliateUrl,
  compareMode,
  onToggleCompare,
}: ResultLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] max-w-4xl flex-col items-center gap-4 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex w-full items-center justify-between">
          <div className="min-w-0">
            {result.title && (
              <p className="truncate text-sm font-medium text-foreground">{result.title}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {result.price && <span>{result.price}</span>}
              {result.retailer_domain && <span>{result.retailer_domain}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Image(s) */}
        <div className="flex gap-4 overflow-hidden rounded-xl">
          {compareMode && (
            <img
              src={result.image_url}
              alt="Original product"
              className="max-h-[65vh] w-auto rounded-xl object-contain border"
            />
          )}
          <img
            src={result.result_image_url!}
            alt={result.title || "Try-on result"}
            className="max-h-[65vh] w-auto rounded-xl object-contain"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onToggleCompare}
          >
            <ArrowLeftRight size={14} />
            {compareMode ? "Hide original" : "Compare"}
          </Button>
          <a href={affiliateUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="gap-1.5">
              <ExternalLink size={14} />
              View Item
            </Button>
          </a>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onDownload(result)}>
            <Download size={14} />
            Download
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onShare(result)}>
            <Share2 size={14} />
            Share
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => {
              onDelete(result);
              onClose();
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
