import { extractProduct } from "./productExtract";
import { injectButton, showModal, updateModalSuccess, updateModalError, getRetryButton } from "./ui";

(() => {
  if (document.getElementById("vto-tryon-btn")) return;

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

  injectButton(doTryOn);

  // SPA navigation watcher — reset button state on URL change
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
