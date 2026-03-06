import { extractProduct } from "./productExtract";
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

    // Product page: primary experience (single "Try On" button + modal)
    if (productPage && !listingPage) {
      if (loggedIn) {
        removeLoginPill();
        removeAllCardButtons();
        storeDetectedProduct();
        if (!document.getElementById("cartify-tryon-btn")) {
          injectButton(doTryOn);
        }
      } else {
        document.getElementById("cartify-tryon-btn")?.remove();
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
        if (!document.getElementById("cartify-tryon-btn")) {
          injectButton(doTryOn);
        }
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
      // Same URL but DOM changed — possibly infinite scroll
      scheduleListingRescan();
    }
  }).observe(document.body, { childList: true, subtree: true });
})();

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
