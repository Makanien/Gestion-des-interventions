/* =========================================================
   Climat Elec — Signature électronique tactile (V2)
   Capture d'une signature au doigt sur un canvas, export PNG,
   upload Storage Supabase, affichage dans la fiche et le PDF.
   ========================================================= */

function signatureModal({ title, onSubmit }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "sig-overlay";
    overlay.innerHTML = `
      <div class="sig-modal">
        <div class="sig-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn sig-close" type="button">${ICONS.close}</button>
        </div>
        <div class="sig-canvas-wrap">
          <canvas id="sig-canvas" width="600" height="220"></canvas>
          <div class="sig-hint">Signez dans le cadre ci-dessus</div>
        </div>
        <div class="sig-actions">
          <button class="btn btn-ghost sig-clear" type="button">Effacer</button>
          <button class="btn btn-accent sig-save" type="button">${ICONS.check} Valider</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const canvas = overlay.querySelector("#sig-canvas");
    const ctx = canvas.getContext("2d");
    let drawing = false;
    let lastX = 0, lastY = 0;
    let hasStroke = false;

    // fond blanc
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#16303f";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
      };
    }

    function start(e) {
      e.preventDefault();
      drawing = true;
      const p = getPos(e);
      lastX = p.x; lastY = p.y;
    }
    function move(e) {
      e.preventDefault();
      if (!drawing) return;
      const p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      lastX = p.x; lastY = p.y;
      hasStroke = true;
    }
    function end() { drawing = false; }

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    overlay.querySelector(".sig-clear").addEventListener("click", () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      hasStroke = false;
    });

    function cleanup() { overlay.remove(); }

    overlay.querySelector(".sig-close").addEventListener("click", () => { cleanup(); resolve(null); });
    overlay.querySelector(".sig-save").addEventListener("click", async () => {
      if (!hasStroke) { cleanup(); resolve(null); return; }
      try {
        const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
        cleanup();
        resolve(blob);
      } catch (e) {
        cleanup();
        resolve(null);
      }
    });
  });
}

// Convertit un blob PNG en dataURL (pour un affichage immédiat).
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

window.signatureModal = signatureModal;
window.blobToDataURL = blobToDataURL;
