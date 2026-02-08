async function api(url) {
  const res = await fetch(url, { credentials: "same-origin" });
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

function teamCard(team) {
  const a = document.createElement("a");
  a.href = `/team?id=${team._id}`;
  a.className = "team-card";

  const img = team.logoUrl
    ? `<img src="${esc(team.logoUrl)}" alt="${esc(team.name)}">`
    : `<div class="team-card__placeholder">⚽</div>`;

  a.innerHTML = `
    <div class="team-card__img">${img}</div>
    <div class="team-card__body">
      <div class="team-card__name">${esc(team.name)}</div>
      <div class="team-card__meta">${esc(team.league || "")} • ${esc(team.country || "")}</div>
      <div class="team-card__meta">Rating: <b>${esc(team.rating ?? "")}</b></div>
      <div class="team-card__meta">Players: <b>${(team.players || []).length}</b></div>
    </div>
  `;
  return a;
}

async function loadTeams() {
  const sort = document.getElementById("teamSort").value;
  const order = document.getElementById("teamOrder").value;
  const teams = await api("/api/teams");

  teams.sort((a, b) => {
    const dir = order === "asc" ? 1 : -1;
    if (sort === "name") return String(a.name).localeCompare(String(b.name)) * dir;
    return ((a.rating ?? 0) - (b.rating ?? 0)) * dir;
  });

  const grid = document.getElementById("allTeamsGrid");
  grid.innerHTML = "";
  teams.forEach(t => grid.appendChild(teamCard(t)));
}

document.getElementById("teamLoadBtn").addEventListener("click", loadTeams);
loadTeams();