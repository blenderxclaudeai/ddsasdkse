// VTO Content Script — injected on all pages
(function () {
  if (document.getElementById("vto-tryon-btn")) return;
  console.log("[VTO content] Content script running on", location.href);

  // --- Floating button ---
  var btn = document.createElement("button");
  btn.id = "vto-tryon-btn";
  btn.textContent = "\u2728 Try On";
  btn.style.cssText =
    "position:fixed;bottom:24px;right:24px;z-index:2147483647;padding:10px 20px;" +
    "border:none;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#6d28d9);" +
    "color:#fff;font-size:14px;font-weight:600;cursor:pointer;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
    "box-shadow:0 4px 20px rgba(124,58,237,0.4);transition:transform .15s ease,box-shadow .15s ease;";

  btn.addEventListener("mouseenter", function () { btn.style.transform = "scale(1.05)"; });
  btn.addEventListener("mouseleave", function () { btn.style.transform = "scale(1)"; });

  btn.addEventListener("click", function () {
    var product_url = location.href;
    var product_title = document.title;

    // Try og:image first
    var product_image = null;
    var ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) product_image = ogImg.getAttribute("content");
    if (!product_image) {
      var twImg = document.querySelector('meta[name="twitter:image"]');
      if (twImg) product_image = twImg.getAttribute("content");
    }
    if (!product_image) {
      // Fallback: largest visible img
      var imgs = document.querySelectorAll("img");
      var best = null, bestArea = 0;
      imgs.forEach(function (img) {
        var a = img.naturalWidth * img.naturalHeight;
        if (a > bestArea && img.src && img.src.indexOf("data:") !== 0) { bestArea = a; best = img; }
      });
      if (best) product_image = best.src;
    }

    btn.textContent = "\u23F3 Sending\u2026";
    btn.style.pointerEvents = "none";

    chrome.runtime.sendMessage(
      { type: "TRYON_REQUEST", payload: { product_url: product_url, product_title: product_title, product_image: product_image } },
      function (response) {
        if (response && response.ok) {
          btn.textContent = "\u2713 Done";
          btn.style.background = "#16a34a";
        } else {
          btn.textContent = "\u2718 Error";
          btn.style.background = "#dc2626";
        }
        btn.style.pointerEvents = "auto";
        setTimeout(function () {
          btn.textContent = "\u2728 Try On";
          btn.style.background = "linear-gradient(135deg,#7c3aed,#6d28d9)";
        }, 2000);
      }
    );
  });

  document.body.appendChild(btn);
})();
