let ME = null;

async function api(url, options) {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
  return data;
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function loadMe() {
  try {
    const data = await api("/api/auth/me");
    ME = data.user || null;
  } catch {
    ME = null;
  }
}

function playerRow(p) {
  const div = document.createElement("div");
  div.style.display = "grid";
  div.style.gridTemplateColumns = "2fr 1fr 1fr 1fr 1fr";
  div.style.gap = "10px";
  div.style.padding = "10px 0";
  div.style.borderBottom = "1px solid rgba(255,255,255,0.06)";

  div.innerHTML = `
    <div>
      <b>${esc(p.name)}</b>
      <div style="opacity:.7; font-size:12px;">${esc(p.teamName || "")} • ${esc(p.position || "")}</div>
    </div>
    <div>${esc(p.rating ?? 0)}</div>
    <div>${esc(p.goals ?? 0)}</div>
    <div>${esc(p.assists ?? 0)}</div>
    <div>${esc(p.matches ?? 0)}</div>
  `;
  return div;
}

async function loadPlayers() {
  const sortEl = document.getElementById("playerSort");
  const orderEl = document.getElementById("playerOrder");
  const list = document.getElementById("playersList");

  const sort = sortEl ? sortEl.value : "rating";
  const order = orderEl ? orderEl.value : "desc";

  const players = await api(`/api/stats/players?sort=${encodeURIComponent(sort)}&order=${encodeURIComponent(order)}`);

  list.innerHTML = `
    <div style="display:grid; grid-template-columns:2fr 1fr 1fr 1fr 1fr; gap:10px; padding:8px 0; opacity:.75; font-size:12px;">
      <div>Player</div><div>Rating</div><div>Goals</div><div>Assists</div><div>Matches</div>
    </div>
  `;

  players.forEach(p => list.appendChild(playerRow(p)));
}

function bindUI() {
  const btn = document.getElementById("playerLoadBtn");
  const sort = document.getElementById("playerSort");
  const order = document.getElementById("playerOrder");

  if (btn) btn.addEventListener("click", loadPlayers);
  if (sort) sort.addEventListener("change", loadPlayers);
  if (order) order.addEventListener("change", loadPlayers);
}

(async () => {
  await loadMe();
  bindUI();
  await loadPlayers();
})();