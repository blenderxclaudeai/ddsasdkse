import type { TryOnResponse } from "@ext/lib/types";

const BUTTON_ID = "cartify-tryon-btn";
const PILL_ID = "cartify-login-pill";
const MODAL_ID = "cartify-modal-overlay";

export function injectButton(onClick: () => void): HTMLButtonElement {
  const existing = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (existing) return existing;

  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.textContent = "Try On";
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    padding: "10px 20px",
    border: "none",
    borderRadius: "12px",
    background: "#171717",
    color: "#fff",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  });

  btn.addEventListener("mouseenter", () => { btn.style.transform = "scale(1.05)"; });
  btn.addEventListener("mouseleave", () => { btn.style.transform = "scale(1)"; });
  btn.addEventListener("click", onClick);
  document.body.appendChild(btn);
  return btn;
}

export function injectLoginPill(): void {
  if (document.getElementById(PILL_ID)) return;
  const pill = document.createElement("div");
  pill.id = PILL_ID;
  pill.textContent = "Log in";
  Object.assign(pill.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    padding: "8px 16px",
    borderRadius: "20px",
    background: "#f5f5f5",
    color: "#737373",
    fontSize: "12px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    cursor: "pointer",
  });
  pill.addEventListener("click", () => {
    pill.textContent = "Click the Cartify icon in toolbar";
    setTimeout(() => { pill.textContent = "Log in"; }, 3000);
  });
  document.body.appendChild(pill);
}

export function removeLoginPill(): void {
  document.getElementById(PILL_ID)?.remove();
}

export function showModal() {
  removeModal();
  const overlay = document.createElement("div");
  overlay.id = MODAL_ID;
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "2147483647",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.6)",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#fff", borderRadius: "16px", padding: "24px",
    width: "380px", maxHeight: "80vh", overflow: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)", textAlign: "center", color: "#171717",
  });

  const title = document.createElement("h2");
  Object.assign(title.style, { margin: "0 0 4px", fontSize: "18px", fontWeight: "700" });
  title.textContent = "Cartify Preview";
  card.appendChild(title);

  const subtitle = document.createElement("p");
  Object.assign(subtitle.style, { margin: "0 0 16px", fontSize: "13px", color: "#737373" });
  subtitle.textContent = "Generating your try-on...";
  card.appendChild(subtitle);

  const body = document.createElement("div");
  body.id = "cartify-modal-body";
  Object.assign(body.style, {
    minHeight: "200px", display: "flex", alignItems: "center", justifyContent: "center",
  });

  const spinner = document.createElement("div");
  Object.assign(spinner.style, {
    width: "32px", height: "32px",
    border: "3px solid #e5e5e5", borderTopColor: "#171717",
    borderRadius: "50%", animation: "cartify-spin 0.8s linear infinite",
  });
  body.appendChild(spinner);
  card.appendChild(body);

  const style = document.createElement("style");
  style.textContent = `@keyframes cartify-spin{to{transform:rotate(360deg)}}`;
  card.appendChild(style);

  overlay.addEventListener("click", (e) => { if (e.target === overlay) removeModal(); });
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

export function updateModalSuccess(result: TryOnResponse) {
  const body = document.getElementById("cartify-modal-body");
  if (!body) return;

  body.textContent = "";

  const wrapper = document.createElement("div");
  wrapper.style.width = "100%";

  if (result.resultImageUrl) {
    const img = document.createElement("img");
    img.src = result.resultImageUrl;
    img.alt = "Try-on result";
    Object.assign(img.style, {
      width: "100%", maxHeight: "400px", objectFit: "contain",
      borderRadius: "8px", marginBottom: "12px",
    });
    wrapper.appendChild(img);
  } else {
    const msg = document.createElement("p");
    Object.assign(msg.style, { fontSize: "14px", color: "#171717", margin: "0 0 12px" });
    msg.textContent = "Try-on request submitted!";
    wrapper.appendChild(msg);
  }

  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, {
    display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
  });

  const closeBtn = document.createElement("button");
  closeBtn.id = "cartify-modal-close";
  closeBtn.textContent = "Close";
  Object.assign(closeBtn.style, {
    padding: "8px 24px", border: "none", borderRadius: "8px",
    background: "#171717", color: "#fff", fontSize: "13px",
    fontWeight: "600", cursor: "pointer",
  });
  closeBtn.addEventListener("click", () => removeModal());
  btnRow.appendChild(closeBtn);
  wrapper.appendChild(btnRow);
  body.appendChild(wrapper);
}

export function updateModalError(errorMsg: string, missingPhoto?: string) {
  const body = document.getElementById("cartify-modal-body");
  if (!body) return;

  body.textContent = "";

  const wrapper = document.createElement("div");

  const errorTitle = document.createElement("p");
  Object.assign(errorTitle.style, { fontSize: "14px", color: "#dc2626", margin: "0 0 8px" });
  errorTitle.textContent = "Something went wrong";
  wrapper.appendChild(errorTitle);

  const errorDetail = document.createElement("p");
  Object.assign(errorDetail.style, { fontSize: "12px", color: "#737373", margin: "0 0 8px" });
  errorDetail.textContent = errorMsg;
  wrapper.appendChild(errorDetail);

  if (missingPhoto) {
    const hint = document.createElement("p");
    Object.assign(hint.style, { fontSize: "12px", color: "#737373", margin: "8px 0 0" });
    hint.textContent = `Open the Cartify extension and upload a photo of your ${missingPhoto} in your profile to try on this product.`;
    wrapper.appendChild(hint);
  }

  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, {
    display: "flex", gap: "8px", justifyContent: "center", marginTop: "16px",
  });

  const retryBtn = document.createElement("button");
  retryBtn.id = "cartify-modal-retry";
  retryBtn.textContent = "Retry";
  Object.assign(retryBtn.style, {
    padding: "8px 20px", border: "1px solid #e5e5e5", borderRadius: "8px",
    background: "#fff", color: "#171717", fontSize: "13px",
    fontWeight: "500", cursor: "pointer",
  });
  btnRow.appendChild(retryBtn);

  const closeBtn = document.createElement("button");
  closeBtn.id = "cartify-modal-close";
  closeBtn.textContent = "Close";
  Object.assign(closeBtn.style, {
    padding: "8px 20px", border: "none", borderRadius: "8px",
    background: "#171717", color: "#fff", fontSize: "13px",
    fontWeight: "600", cursor: "pointer",
  });
  closeBtn.addEventListener("click", () => removeModal());
  btnRow.appendChild(closeBtn);

  wrapper.appendChild(btnRow);
  body.appendChild(wrapper);
}

export function getRetryButton(): HTMLElement | null {
  return document.getElementById("cartify-modal-retry");
}

function removeModal() {
  document.getElementById(MODAL_ID)?.remove();
}

// ── Inline card buttons for listing pages (try-on only) ──

const CARD_BTN_ATTR = "data-cartify-card-btn";
const HOVER_ATTR = "data-cartify-hover";

const HANGER_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7l7.4 6.16a1 1 0 0 1-.74 1.84H4.34a1 1 0 0 1-.74-1.84L11 7V5.73A2 2 0 0 1 12 2z"/><path d="M2 20h20"/></svg>`;
const CHECK_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const X_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

export type CardButtonState = "default" | "loading" | "done" | "error";

function ensureHoverListeners(container: HTMLElement) {
  if (container.hasAttribute(HOVER_ATTR)) return;
  container.setAttribute(HOVER_ATTR, "true");

  container.addEventListener("mouseenter", () => {
    container.querySelectorAll<HTMLElement>(`[${CARD_BTN_ATTR}]`).forEach((btn) => {
      btn.style.opacity = btn.dataset.state === "loading" ? "1" : "0.85";
      btn.style.pointerEvents = "auto";
    });
  });
  container.addEventListener("mouseleave", () => {
    container.querySelectorAll<HTMLElement>(`[${CARD_BTN_ATTR}]`).forEach((btn) => {
      if (btn.dataset.state === "loading") return;
      btn.style.opacity = "0";
      btn.style.pointerEvents = "none";
    });
  });
}

export function injectCardButton(
  container: HTMLElement,
  onClick: () => void
): HTMLElement {
  const existing = container.querySelector(`[${CARD_BTN_ATTR}]`);
  if (existing) return existing as HTMLElement;

  const pos = getComputedStyle(container).position;
  if (pos === "static" || pos === "") {
    container.style.position = "relative";
  }

  ensureHoverListeners(container);

  const btn = document.createElement("button");
  btn.setAttribute(CARD_BTN_ATTR, "true");
  btn.innerHTML = HANGER_SVG;
  Object.assign(btn.style, {
    position: "absolute",
    top: "8px",
    right: "8px",
    zIndex: "999",
    width: "30px",
    height: "30px",
    padding: "0",
    border: "none",
    borderRadius: "50%",
    background: "rgba(23,23,23,0.7)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    opacity: "0",
    pointerEvents: "none",
    transition: "opacity 0.2s ease, transform 0.15s ease, background 0.15s ease",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    fontFamily: "inherit",
    lineHeight: "1",
  });

  btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; btn.style.transform = "scale(1.1)"; });
  btn.addEventListener("mouseleave", () => {
    if (btn.dataset.state !== "loading") {
      btn.style.opacity = "0.85";
      btn.style.transform = "scale(1)";
    }
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  container.appendChild(btn);
  return btn;
}

export function setCardButtonState(btn: HTMLElement, state: CardButtonState) {
  btn.dataset.state = state;

  switch (state) {
    case "loading":
      btn.innerHTML = "";
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
      btn.style.background = "rgba(23,23,23,0.85)";
      btn.style.animation = "cartify-spin 0.8s linear infinite";
      btn.style.border = "2px solid rgba(255,255,255,0.3)";
      btn.style.borderTopColor = "#fff";
      break;
    case "done":
      btn.innerHTML = CHECK_SVG;
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
      btn.style.background = "#16a34a";
      btn.style.animation = "none";
      btn.style.border = "none";
      setTimeout(() => {
        if (btn.dataset.state === "done") setCardButtonState(btn, "default");
      }, 2000);
      break;
    case "error":
      btn.innerHTML = X_SVG;
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
      btn.style.background = "#dc2626";
      btn.style.animation = "none";
      btn.style.border = "none";
      setTimeout(() => {
        if (btn.dataset.state === "error") setCardButtonState(btn, "default");
      }, 2000);
      break;
    default:
      btn.innerHTML = HANGER_SVG;
      btn.style.opacity = "0";
      btn.style.pointerEvents = "none";
      btn.style.background = "rgba(23,23,23,0.7)";
      btn.style.animation = "none";
      btn.style.border = "none";
      break;
  }
}

export function removeAllCardButtons(): void {
  document.querySelectorAll(`[${CARD_BTN_ATTR}]`).forEach((el) => el.remove());
}

// ── Toast notification ──

const TOAST_ID = "cartify-toast";

export function showToastNotification(message: string, type: "success" | "error" = "success"): void {
  document.getElementById(TOAST_ID)?.remove();

  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "24px",
    left: "24px",
    zIndex: "2147483647",
    padding: "10px 18px",
    borderRadius: "10px",
    background: type === "success" ? "#171717" : "#dc2626",
    color: "#fff",
    fontSize: "13px",
    fontWeight: "500",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    opacity: "0",
    transform: "translateY(10px)",
    transition: "opacity 0.2s ease, transform 0.2s ease",
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}
