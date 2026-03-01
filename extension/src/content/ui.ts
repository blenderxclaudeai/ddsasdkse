// UI injection: floating button + preview modal
import type { TryOnResponse } from "@ext/lib/types";

const BUTTON_ID = "vto-tryon-btn";
const MODAL_ID = "vto-modal-overlay";

// ── Floating Button ──

export function injectButton(onClick: () => void): HTMLButtonElement {
  const existing = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (existing) return existing;

  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.textContent = "✨ Try On";
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

  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.05)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1)";
  });
  btn.addEventListener("click", onClick);
  document.body.appendChild(btn);
  return btn;
}

// ── Modal ──

export function showModal() {
  removeModal();

  const overlay = document.createElement("div");
  overlay.id = MODAL_ID;
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.6)",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    width: "380px",
    maxHeight: "80vh",
    overflow: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    textAlign: "center",
    color: "#171717",
  });
  card.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;">VTO Preview</h2>
    <p style="margin:0 0 16px;font-size:13px;color:#737373;">Generating your try-on…</p>
    <div id="vto-modal-body" style="min-height:200px;display:flex;align-items:center;justify-content:center;">
      <div style="width:32px;height:32px;border:3px solid #e5e5e5;border-top-color:#171717;border-radius:50%;animation:vto-spin 0.8s linear infinite;"></div>
    </div>
  `;

  // Add spinner keyframes
  const style = document.createElement("style");
  style.textContent = `@keyframes vto-spin{to{transform:rotate(360deg)}}`;
  card.appendChild(style);

  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) removeModal();
  });

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

export function updateModalSuccess(result: TryOnResponse) {
  const body = document.getElementById("vto-modal-body");
  if (!body) return;

  if (result.resultImageUrl) {
    body.innerHTML = `
      <div style="width:100%;">
        <img src="${result.resultImageUrl}" alt="Try-on result" style="width:100%;max-height:400px;object-fit:contain;border-radius:8px;margin-bottom:12px;" />
        <button id="vto-modal-close" style="padding:8px 24px;border:none;border-radius:8px;background:#171717;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Close</button>
      </div>
    `;
  } else {
    body.innerHTML = `
      <div>
        <p style="font-size:14px;color:#171717;margin:0 0 12px;">Try-on request submitted!</p>
        <button id="vto-modal-close" style="padding:8px 24px;border:none;border-radius:8px;background:#171717;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Close</button>
      </div>
    `;
  }
  document.getElementById("vto-modal-close")?.addEventListener("click", removeModal);
}

export function updateModalError(errorMsg: string) {
  const body = document.getElementById("vto-modal-body");
  if (!body) return;

  body.innerHTML = `
    <div>
      <p style="font-size:14px;color:#dc2626;margin:0 0 8px;">Something went wrong</p>
      <p style="font-size:12px;color:#737373;margin:0 0 16px;">${errorMsg}</p>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button id="vto-modal-retry" style="padding:8px 20px;border:1px solid #e5e5e5;border-radius:8px;background:#fff;color:#171717;font-size:13px;font-weight:500;cursor:pointer;">Retry</button>
        <button id="vto-modal-close" style="padding:8px 20px;border:none;border-radius:8px;background:#171717;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Close</button>
      </div>
    </div>
  `;
  document.getElementById("vto-modal-close")?.addEventListener("click", removeModal);
}

export function getRetryButton(): HTMLElement | null {
  return document.getElementById("vto-modal-retry");
}

function removeModal() {
  document.getElementById(MODAL_ID)?.remove();
}
