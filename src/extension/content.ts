// Content script — plain TS, no React/JSX, no imports from the app.
// Injected on every page; uses heuristics to detect product pages before showing the "Try On" button.

(() => {
  // Avoid double-injection
  if (document.getElementById("vto-tryon-btn")) return;

  // --------------- Product page detection ---------------

  function isProductPage(): boolean {
    // 1. Structured data (JSON-LD) with @type Product
    const jsonLdScripts = document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent || "");
        const types = Array.isArray(data) ? data : [data];
        for (const item of types) {
          if (item["@type"] === "Product" || item["@type"]?.includes?.("Product")) return true;
          // Check @graph
          if (Array.isArray(item["@graph"])) {
            for (const g of item["@graph"]) {
              if (g["@type"] === "Product" || g["@type"]?.includes?.("Product")) return true;
            }
          }
        }
      } catch { /* ignore malformed JSON-LD */ }
    }

    // 2. OpenGraph product meta tags
    if (
      document.querySelector('meta[property="og:type"][content="product"]') ||
      document.querySelector('meta[property="product:price:amount"]') ||
      document.querySelector('meta[property="og:price:amount"]')
    ) return true;

    // 3. Microdata product
    if (document.querySelector('[itemtype*="schema.org/Product"]')) return true;

    // 4. Common e-commerce signals in the DOM
    const bodyText = document.body?.innerText?.slice(0, 5000)?.toLowerCase() || "";
    const hasAddToCart = !!document.querySelector(
      'button[name*="add"], button[class*="add-to-cart"], button[class*="addToCart"], [data-testid*="add-to-cart"], [data-testid*="addToCart"], form[action*="cart"]'
    ) || bodyText.includes("add to cart") || bodyText.includes("add to bag");

    const hasPriceElement = !!document.querySelector(
      '[class*="price"], [data-testid*="price"], [itemprop="price"], .product-price'
    );

    // Need BOTH add-to-cart AND price to consider it a product page
    if (hasAddToCart && hasPriceElement) return true;

    // 5. Known retailer URL patterns
    const path = window.location.pathname.toLowerCase();
    const host = window.location.hostname.toLowerCase();
    const productUrlPatterns = [
      /\/product\//i, /\/products\//i, /\/item\//i, /\/p\//i,
      /\/dp\//i, // Amazon
      /\/-p-/i, // Trendyol
    ];
    if (productUrlPatterns.some(p => p.test(path))) return true;

    // Known fashion/retail domains
    const retailDomains = [
      "zalando", "asos", "zara", "hm", "mango", "uniqlo", "nordstrom",
      "farfetch", "net-a-porter", "ssense", "mytheresa", "shopbop",
      "revolve", "amazon", "ebay", "etsy", "shein", "boohoo",
      "prettylittlething", "nike", "adidas", "puma",
    ];
    if (retailDomains.some(d => host.includes(d)) && hasPriceElement) return true;

    return false;
  }

  if (!isProductPage()) return;

  // --------------- Scraping helpers ---------------

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

    // Largest visible image on the page (likely the product hero)
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

  function scrapeTitle(): string | null {
    return getMeta("og:title") ?? getMeta("twitter:title") ?? document.title ?? null;
  }

  function scrapePrice(): string | null {
    return getMeta("product:price:amount") ?? getMeta("og:price:amount") ?? null;
  }

  // --------------- Floating button ---------------

  const imageUrl = scrapeImage();
  if (!imageUrl) return;

  const btn = document.createElement("button");
  btn.id = "vto-tryon-btn";
  btn.textContent = "✨ Try On";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    padding: "10px 20px",
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(124, 58, 237, 0.4)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  } as CSSStyleDeclaration);

  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.05)";
    btn.style.boxShadow = "0 6px 28px rgba(124, 58, 237, 0.5)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1)";
    btn.style.boxShadow = "0 4px 20px rgba(124, 58, 237, 0.4)";
  });

  btn.addEventListener("click", () => {
    const productData = {
      type: "VTO_TRYON_REQUEST",
      payload: {
        pageUrl: window.location.href,
        imageUrl,
        title: scrapeTitle(),
        price: scrapePrice(),
        retailerDomain: window.location.hostname,
      },
    };
    chrome.runtime.sendMessage(productData);
    btn.textContent = "✓ Sent!";
    btn.style.background = "#16a34a";
    setTimeout(() => {
      btn.textContent = "✨ Try On";
      btn.style.background = "linear-gradient(135deg, #7c3aed, #6d28d9)";
    }, 1500);
  });

  document.body.appendChild(btn);
})();
