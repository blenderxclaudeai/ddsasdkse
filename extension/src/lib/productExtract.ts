export interface ProductData {
  product_url: string;
  product_title: string | null;
  product_image: string | null;
}

function getMeta(property: string): string | null {
  const el =
    document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`) ??
    document.querySelector<HTMLMetaElement>(`meta[name="${property}"]`);
  return el?.content?.trim() || null;
}

export function extractProduct(): ProductData {
  const product_url = location.href;

  const product_title =
    getMeta("og:title") ?? getMeta("twitter:title") ?? document.title ?? null;

  let product_image =
    getMeta("og:image") ?? getMeta("twitter:image") ?? null;

  if (!product_image) {
    let largest: HTMLImageElement | null = null;
    let largestArea = 0;
    document.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      const area = img.naturalWidth * img.naturalHeight;
      if (area > largestArea && img.src && !img.src.startsWith("data:")) {
        largestArea = area;
        largest = img;
      }
    });
    product_image = largest?.src ?? null;
  }

  return { product_url, product_title, product_image };
}
