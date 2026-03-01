import { extractProduct } from "./lib/productExtract";

(() => {
  if (document.getElementById("vto-tryon-btn")) return;

  // ---- Product-page detection ----

  function isLikelyProductPage(): boolean {
    // JSON-LD @type Product
    for (const s of document.querySelectorAll<HTMLScriptElement>(
      'script[type="application/ld+json"]'
    )) {
      try {
        const d = JSON.parse(s.textContent || "");
        const items = Array.isArray(d) ? d : [d];
        for (const item of items) {
          if (item["@type"] === "Product") return true;
          if (
            Array.isArray(item["@graph"]) &&
            item["@graph"].some((g: any) => g["@type"] === "Product")
          )
            return true;
        }
      } catch {
        /* ignore */
      }
    }

    // OG / meta product signals
    if (
      document.querySelector('meta[property="og:type"][content="product"]') ||
      document.querySelector('meta[property="product:price:amount"]')
    )
      return true;

    // Microdata
    if (document.querySelector('[itemtype*="schema.org/Product"]')) return true;

    // Add-to-cart + price heuristic
    const hasCart = !!document.querySelector(
      'button[class*="add-to-cart"], button[class*="addToCart"], [data-testid*="add-to-cart"], form[action*="cart"]'
    );
    const hasPrice = !!document.querySelector(
      '[class*="price"], [itemprop="price"], .product-price'
    );
    if (hasCart && hasPrice) return true;

    // URL patterns common to e-commerce
    if (/\/(product|products|item|dp|p)\//i.test(location.pathname))
      return true;

    return false;
  }

  if (!isLikelyProductPage()) return;

  // ---- Floating button ----

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
    cursor: "pointer",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  });

  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.05)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1)";
  });

  btn.addEventListener("click", () => {
    const product = extractProduct();
    if (!product.product_image) {
      showToast("No product image found", true);
      return;
    }

    btn.textContent = "⏳ Sending…";
    btn.style.pointerEvents = "none";

    chrome.runtime.sendMessage(
      { type: "TRYON_REQUEST", payload: product },
      (response) => {
        if (response?.ok) {
          showToast("✓ Try-on sent!");
          btn.textContent = "✓ Done";
          btn.style.background = "#16a34a";
        } else {
          showToast(response?.error || "Something went wrong", true);
          btn.textContent = "✨ Try On";
          btn.style.background = "linear-gradient(135deg, #7c3aed, #6d28d9)";
        }
        btn.style.pointerEvents = "auto";
        setTimeout(() => {
          btn.textContent = "✨ Try On";
          btn.style.background = "linear-gradient(135deg, #7c3aed, #6d28d9)";
        }, 2000);
      }
    );
  });

  document.body.appendChild(btn);

  // ---- Toast helper ----

  function showToast(msg: string, isError = false) {
    const toast = document.createElement("div");
    toast.textContent = msg;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "72px",
      right: "24px",
      zIndex: "2147483647",
      padding: "8px 16px",
      borderRadius: "8px",
      fontSize: "13px",
      fontWeight: "500",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: isError ? "#dc2626" : "#16a34a",
      color: "#fff",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      transition: "opacity 0.3s",
    });
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ---- SPA navigation watcher ----

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      btn.textContent = "✨ Try On";
      btn.style.background = "linear-gradient(135deg, #7c3aed, #6d28d9)";
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
