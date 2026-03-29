import { extractProduct, extractVariants, waitForVariantElements, type ProductVariants } from "./productExtract";
import { isListingPage, findCardContainers, extractFromCard, extractFallbackFromLink } from "./productGrid";
import {
  injectButton,
  injectLoginPill,
  removeLoginPill,
  showModal,
  updateModalSuccess,
  updateModalError,
  getRetryButton,
  injectCardButton,
  setCardButtonState,
  removeAllCardButtons,
  showToastNotification,
  injectCartButton,
  setCartButtonDone,
} from "./ui";

/** Check if the current page looks like a product/shopping page */
function isProductPage(): boolean {
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent || "");
      const check = (obj: any): boolean => {
        if (!obj) return false;
        if (obj["@type"] === "Product" || obj["@type"] === "ProductGroup") return true;
        if (Array.isArray(obj["@graph"])) return obj["@graph"].some(check);
        if (Array.isArray(obj)) return obj.some(check);
        return false;
      };
      if (check(data)) return true;
    } catch { /* ignore */ }
  }

  const ogType = document.querySelector<HTMLMetaElement>('meta[property="og:type"]')?.content?.toLowerCase();
  if (ogType && (ogType === "product" || ogType.startsWith("og:product") || ogType.startsWith("product"))) return true;

  if (document.querySelector('[itemprop="price"], [itemprop="priceCurrency"], [data-price], [class*="product-price"], [class*="productPrice"]')) return true;

  const buttons = document.querySelectorAll("button, [role='button'], a.btn, a.button, input[type='submit']");
  for (const btn of buttons) {
    const text = (btn.textContent || "").trim().toLowerCase();
    if (/add to (cart|bag|basket)|buy now|in den warenkorb|ajouter au panier|zum warenkorb|comprar/i.test(text)) return true;
  }

  const path = location.pathname.toLowerCase();
  if (/\/(product|products|item|dp|p|pd|shop)\/[^/]+/i.test(path)) return true;
  if (/\/[a-z0-9-]+-[a-z0-9]{6,}\.(html|htm)$/i.test(path)) return true;

  if (document.querySelector('[itemtype*="schema.org/Product"], [itemtype*="schema.org/Offer"]')) return true;

  return false;
}

function removeCartifyElements() {
  document.getElementById("cartify-tryon-btn")?.remove();
  removeLoginPill();
  removeAllCardButtons();
}

/** Store detected product data for side panel / popup */
function storeDetectedProduct() {
  const product = extractProduct();
  if (product.product_image) {
    chrome.runtime.sendMessage(
      { type: "PRODUCT_DETECTED", payload: product },
      () => { /* stored */ }
    );
  }
}

// ── Listing page: card button handling ──

const injectedCards = new WeakSet<HTMLElement>();
let listingObserver: IntersectionObserver | null = null;

function setupListingButtons() {
  const cards = findCardContainers();

  if (!listingObserver) {
    listingObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const card = entry.target as HTMLElement;
            listingObserver?.unobserve(card);
            injectCardButtonOnCard(card);
          }
        }
      },
      { rootMargin: "200px" }
    );
  }

  for (const card of cards) {
    if (injectedCards.has(card)) continue;
    injectedCards.add(card);
    listingObserver.observe(card);
  }
}

function injectCardButtonOnCard(card: HTMLElement) {
  const btn = injectCardButton(card, () => handleCardClick(card, btn));
  // Also inject cart button
  const cartBtn = injectCartButton(card, () => handleCartClick(card, cartBtn));
}

function handleCartClick(card: HTMLElement, btn: HTMLElement) {
  const product = extractFromCard(card);
  const payload = product || {
    product_url: extractFallbackFromLink(card) || "",
    product_title: "",
    product_image: "",
  };
  if (!payload.product_url) {
    showToastNotification("Could not identify product", "error");
    return;
  }
  chrome.runtime.sendMessage(
    { type: "CARTIFY_ADD_TO_CART", payload },
    (response) => {
      if (chrome.runtime.lastError) {
        showToastNotification("Extension error", "error");
        return;
      }
      if (response?.ok) {
        setCartButtonDone(btn);
        showToastNotification("Added to cart!");
      } else {
        showToastNotification(response?.error || "Sign in to add to cart", "error");
      }
    }
  );
}

function handleCardClick(card: HTMLElement, btn: HTMLElement) {
  // Prevent double-click while loading
  if (btn.dataset.state === "loading") return;

  setCardButtonState(btn, "loading");

  // Extract product data on click only
  const product = extractFromCard(card);

  if (product) {
    chrome.runtime.sendMessage(
      { type: "CARTIFY_TRYON_REQUEST", payload: product, background: true },
      (response) => {
        if (chrome.runtime.lastError) {
          setCardButtonState(btn, "error");
          showToastNotification("Extension error", "error");
          return;
        }
        if (response?.ok) {
          if (response.duplicate) {
            setCardButtonState(btn, "done");
            showToastNotification("Already queued!");
          } else {
            setCardButtonState(btn, "done");
            showToastNotification("Try-on queued!");
          }
        } else {
          setCardButtonState(btn, "error");
          showToastNotification(response?.error || "Request failed", "error");
        }
      }
    );
  } else {
    // Fallback: try to get product page URL
    const fallbackUrl = extractFallbackFromLink(card);
    if (fallbackUrl) {
      chrome.runtime.sendMessage(
        {
          type: "CARTIFY_TRYON_REQUEST",
          payload: {
            product_url: fallbackUrl,
            product_title: "",
            product_image: "",
          },
          background: true,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            setCardButtonState(btn, "error");
            showToastNotification("Extension error", "error");
            return;
          }
          if (response?.ok) {
            setCardButtonState(btn, "done");
            showToastNotification("Try-on queued!");
          } else {
            setCardButtonState(btn, "error");
            showToastNotification(response?.error || "Could not extract product", "error");
          }
        }
      );
    } else {
      setCardButtonState(btn, "error");
      showToastNotification("Could not identify product", "error");
    }
  }
}

// ── Infinite scroll: debounced re-scan ──

let scrollScanTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleListingRescan() {
  if (scrollScanTimer) clearTimeout(scrollScanTimer);
  scrollScanTimer = setTimeout(() => {
    setupListingButtons();
  }, 500);
}

// ── Page evaluation ──

function evaluatePage() {
  const productPage = isProductPage();
  const listingPage = isListingPage();

  if (!productPage && !listingPage) {
    removeCartifyElements();
    chrome.storage.local.remove("cartify_pending_product");
    return;
  }

  chrome.runtime.sendMessage({ type: "AUTH_GET_USER" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("[Cartify] Extension context error:", chrome.runtime.lastError.message);
      return;
    }

    const loggedIn = response?.loggedIn;

    // Check coupons after auth is resolved (prevents racing with token refresh)
    const domain = location.hostname.replace(/^www\./, "");
    chrome.runtime.sendMessage({ type: "CARTIFY_CHECK_COUPONS", domain }, () => {});

    // Product page: detect product for side panel, no floating button
    if (productPage && !listingPage) {
      if (loggedIn) {
        removeLoginPill();
        removeAllCardButtons();
        storeDetectedProduct();
        // No floating "Try On" button — side panel handles it
      } else {
        injectLoginPill();
      }
      return;
    }

    // Listing page: inline card buttons
    if (listingPage && !productPage) {
      document.getElementById("cartify-tryon-btn")?.remove();
      if (loggedIn) {
        removeLoginPill();
        setupListingButtons();
      } else {
        removeAllCardButtons();
        injectLoginPill();
      }
      return;
    }

    // Mixed: product page is primary, also inject card buttons on grids
    if (productPage && listingPage) {
      if (loggedIn) {
        removeLoginPill();
        storeDetectedProduct();
        // No floating "Try On" button — side panel handles it
        // Also inject card buttons on any product grids (e.g. "related products")
        setupListingButtons();
      } else {
        document.getElementById("cartify-tryon-btn")?.remove();
        injectLoginPill();
      }
    }
  });
}

(() => {
  // Coupon check moved inside evaluatePage() to avoid racing with auth state
  setTimeout(evaluatePage, 500);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.cartify_auth_token) return;

    if (changes.cartify_auth_token.newValue) {
      evaluatePage();
    } else {
      removeCartifyElements();
    }
  });

  let lastUrl = location.href;
  let lastRescanTime = 0;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      removeCartifyElements();
      if (listingObserver) {
        listingObserver.disconnect();
        listingObserver = null;
      }
      setTimeout(evaluatePage, 800);
    } else {
      // Throttle rescan to max once per second
      const now = Date.now();
      if (now - lastRescanTime > 1000) {
        lastRescanTime = now;
        scheduleListingRescan();
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
})();

const RETAILER_CART_SELECTORS = [
  "button[data-testid*='add-to-cart' i]",
  "button[name*='add'][name*='cart' i]",
  "button[id*='add'][id*='cart' i]",
  "button[class*='add'][class*='cart' i]",
  "button[aria-label*='add to cart' i]",
  "button[aria-label*='add to bag' i]",
  "button[aria-label*='add to basket' i]",
  "form[action*='/cart' i] button[type='submit']",
  "form[action*='/bag' i] button[type='submit']",
  "input[type='submit']",
  "button[type='submit']",
  "button",
  "a[role='button']",
];

const RETAILER_CART_TEXT_RE = /add to (cart|bag|basket)|lägg i varukorg|in den warenkorb|ajouter au panier|zum warenkorb|añadir al carrito/i;

function isEligibleCartButton(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled) return false;
  if (el.getAttribute("aria-disabled") === "true") return false;

  const rect = el.getBoundingClientRect();
  if (rect.width < 24 || rect.height < 24) return false;

  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;

  return true;
}

function looksLikeCartAction(el: HTMLElement): boolean {
  const text = [el.textContent || "", el.getAttribute("aria-label") || "", el.getAttribute("title") || ""]
    .join(" ")
    .trim()
    .toLowerCase();
  return RETAILER_CART_TEXT_RE.test(text);
}

function findRetailerCartAction(): HTMLElement | null {
  for (const selector of RETAILER_CART_SELECTORS) {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    for (const el of elements) {
      if (!isEligibleCartButton(el)) continue;
      if (looksLikeCartAction(el)) return el;
    }
  }
  return null;
}

function trySelectVariant(variant: { size?: string; color?: string }): void {
  if (!variant) return;

  const tryMatch = (value: string) => {
    if (!value) return;
    const lower = value.trim().toLowerCase();

    // Try select dropdowns
    const selects = document.querySelectorAll<HTMLSelectElement>("select");
    for (const sel of selects) {
      for (const opt of sel.options) {
        if (opt.text.trim().toLowerCase().includes(lower) || opt.value.toLowerCase().includes(lower)) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return;
        }
      }
    }

    // Try buttons / radio labels
    const buttons = document.querySelectorAll<HTMLElement>("button, [role='radio'], [role='option'], label, a[data-value]");
    for (const btn of buttons) {
      const text = (btn.textContent || "").trim().toLowerCase();
      const ariaLabel = (btn.getAttribute("aria-label") || "").toLowerCase();
      const dataValue = (btn.getAttribute("data-value") || "").toLowerCase();
      if (text === lower || ariaLabel.includes(lower) || dataValue === lower) {
        btn.click();
        return;
      }
    }
  };

  if (variant.size) tryMatch(variant.size);
  if (variant.color) tryMatch(variant.color);
}

function tryAddToRetailerCart(targetUrl?: string, variant?: { size?: string; color?: string }): { ok: boolean; error?: string } {
  if (targetUrl) {
    try {
      const target = new URL(targetUrl);
      if (target.hostname.replace(/^www\./, "") !== location.hostname.replace(/^www\./, "")) {
        return { ok: false, error: "Opened page doesn't match retailer" };
      }
    } catch {
      // Ignore malformed target URL and attempt on current page anyway.
    }
  }

  // Attempt to select variant before clicking add to cart
  if (variant) {
    trySelectVariant(variant);
  }

  const action = findRetailerCartAction();
  if (!action) {
    return { ok: false, error: "No add-to-cart action found on this page" };
  }

  action.click();
  showToastNotification("Added to retailer cart!");
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "CARTIFY_ADD_TO_RETAILER_CART") {
    const result = tryAddToRetailerCart(msg?.payload?.target_url, msg?.payload?.variant);
    sendResponse(result);
    return true;
  }

  if (msg?.type === "CARTIFY_EXTRACT_VARIANTS") {
    // Wait for SPA hydration before extracting variants
    waitForVariantElements(3000).then(() => {
      const variants = extractVariants();
      sendResponse({ ok: true, variants });
    });
    return true;
  }
});

function doTryOn() {
  const product = extractProduct();
  if (!product.product_image) {
    showModal();
    updateModalError("No product image found on this page.");
    return;
  }

  showModal();

  chrome.runtime.sendMessage(
    { type: "CARTIFY_TRYON_REQUEST", payload: product },
    (response) => {
      if (chrome.runtime.lastError) {
        updateModalError(chrome.runtime.lastError.message || "Extension error");
        bindRetry();
        return;
      }
      if (response?.ok) {
        updateModalSuccess(response);
      } else {
        updateModalError(
          response?.error || "Request failed",
          response?.missingPhoto
        );
        bindRetry();
      }
    }
  );
}

function bindRetry() {
  const retryBtn = getRetryButton();
  if (retryBtn) {
    retryBtn.addEventListener("click", doTryOn);
  }
}
