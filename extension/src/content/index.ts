import { extractProduct } from "./productExtract";
import { injectButton, injectLoginPill, removeLoginPill, showModal, updateModalSuccess, updateModalError, getRetryButton } from "./ui";

(() => {
  if (document.getElementById("vto-tryon-btn") || document.getElementById("vto-login-pill")) return;

  // Check auth state from background before showing button
  chrome.runtime.sendMessage({ type: "VTO_GET_AUTH" }, (response) => {
    if (chrome.runtime.lastError) {
      console.log("[VTO] Extension context error:", chrome.runtime.lastError.message);
      return;
    }

    if (response?.loggedIn) {
      removeLoginPill();
      injectButton(doTryOn);
    } else {
      injectLoginPill();
    }
  });

  function doTryOn() {
    const product = extractProduct();
    if (!product.product_image) {
      alert("VTO: No product image found on this page.");
      return;
    }

    showModal();

    chrome.runtime.sendMessage(
      { type: "VTO_TRYON_REQUEST", payload: product },
      (response) => {
        if (chrome.runtime.lastError) {
          updateModalError(chrome.runtime.lastError.message || "Extension error");
          bindRetry();
          return;
        }
        if (response?.ok) {
          updateModalSuccess(response);
        } else {
          updateModalError(response?.error || "Request failed");
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

  // SPA navigation watcher
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
