import type { ProductData } from "@ext/lib/types";

function getMeta(property: string): string | null {
  const el =
    document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`) ??
    document.querySelector<HTMLMetaElement>(`meta[name="${property}"]`);
  return el?.content?.trim() || null;
}

function scrapeImage(): string | null {
  const ogImage = getMeta("og:image");
  if (ogImage) return ogImage;
  const twImage = getMeta("twitter:image");
  if (twImage) return twImage;

  // Fallback: largest visible image on the page
  let largest: HTMLImageElement | null = null;
  let largestArea = 0;
  document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const area = img.naturalWidth * img.naturalHeight;
    if (area > largestArea && img.src && !img.src.startsWith("data:")) {
      largestArea = area;
      largest = img;
    }
  });
  return largest ? (largest as HTMLImageElement).src : null;
}

function scrapeTitle(): string {
  return getMeta("og:title") ?? getMeta("twitter:title") ?? document.title ?? "";
}

export function extractProduct(): ProductData {
  return {
    product_url: location.href,
    product_title: scrapeTitle(),
    product_image: scrapeImage() ?? "",
  };
}
