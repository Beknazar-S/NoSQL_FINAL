let currentUser = null;
let teamId = null;
let teamData = null;

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function isAdmin() {
  return currentUser && currentUser.role === "admin";
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

async function loadMe() {
  try {
    const data = await api("/api/auth/me");
    currentUser = data.user;
  } catch {
    currentUser = null;
  }

  const adminCard = document.getElementById("adminPlayersCard");
  if (adminCard) adminCard.style.display = isAdmin() ? "block" : "none";
}

function renderTeamInfo(team) {
  const title = document.getElementById("teamTitle");
  if (title) title.textContent = team.name;

  const logo = team.logoUrl
    ? `<img src="${team.logoUrl}" alt="${team.name}" style="width:90px;height:90px;object-fit:contain;background:#fff;border-radius:12px;padding:8px;margin-bottom:12px;">`
    : "";

  const info = `
    ${logo}
    <div style="text-align:left;max-width:600px;margin:0 auto;">
      <p><b>Country:</b> ${team.country}</p>
      <p><b>Coach:</b> ${team.coach}</p>
      <p><b>Founded:</b> ${team.foundedYear}</p>
      <p><b>Stadium:</b> ${team.stadium}</p>
      <p><b>League:</b> ${team.league}</p>
      <p><b>Rating:</b> ${team.rating}</p>
    </div>
  `;

  const box = document.getElementById("teamInfo");
  if (box) box.innerHTML = info;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPlayers(players) {
  const wrap = document.getElementById("playersWrap");
  if (!wrap) return;

  if (!Array.isArray(players) || players.length === 0) {
    wrap.innerHTML = `<p>No players yet.</p>`;
    return;
  }

  // table
  let html = `
    <div class="players-table">
      <div class="players-head">
        <div>Name</div>
        <div>Pos</div>
        <div>M</div>
        <div>G</div>
        <div>A</div>
        <div>Rating</div>
        <div class="players-actions-col">${isAdmin() ? "Actions" : ""}</div>
      </div>
  `;

  players.forEach((p, idx) => {
    html += `
      <div class="player-row ${isAdmin() ? "admin-hover" : ""}">
        <div>${escapeHtml(p.name ?? "")}</div>
        <div>${escapeHtml(p.position ?? "")}</div>
        <div>${Number(p.matches ?? 0)}</div>
        <div>${Number(p.goals ?? 0)}</div>
        <div>${Number(p.assists ?? 0)}</div>
        <div>${Number(p.rating ?? 0)}</div>
        <div class="player-actions">
          ${
            isAdmin()
              ? `
                <button class="mini-btn" onclick="editPlayer(${idx})">Edit</button>
                <button class="mini-btn danger" onclick="deletePlayer(${idx})">Delete</button>
              `
              : ""
          }
        </div>
      </div>
    `;
  });

  html += `</div>`;
  wrap.innerHTML = html;
}

async function loadTeam() {
  teamId = qs("id");
  if (!teamId) {
    document.getElementById("teamInfo").innerHTML = "Missing team id";
    return;
  }

  teamData = await api(`/api/teams/${teamId}`);
  renderTeamInfo(teamData);
  renderPlayers(teamData.players || []);
}

async function savePlayers(newPlayers) {
  const updated = await api(`/api/teams/${teamId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players: newPlayers }),
  });

  teamData = updated;
  renderPlayers(teamData.players || []);
}

async function addPlayer() {
  if (!isAdmin()) return alert("Admin only");

  const name = prompt("Player name:");
  if (!name) return;

  const position = prompt("Position (FW/MID/DEF/GK):", "FW");
  if (!position) return;

  const matches = Number(prompt("Matches:", "0"));
  const goals = Number(prompt("Goals:", "0"));
  const assists = Number(prompt("Assists:", "0"));
  const rating = Number(prompt("Rating (0-100):", "70"));

  const p = {
    name: name.trim(),
    position: position.trim(),
    matches: Number.isNaN(matches) ? 0 : matches,
    goals: Number.isNaN(goals) ? 0 : goals,
    assists: Number.isNaN(assists) ? 0 : assists,
    rating: Number.isNaN(rating) ? 0 : rating,
  };

  const players = Array.isArray(teamData.players) ? [...teamData.players] : [];
  players.push(p);

  try {
    await savePlayers(players);
  } catch (e) {
    alert("Save error: " + e.message);
  }
}

async function editPlayer(index) {
  if (!isAdmin()) return alert("Admin only");

  const players = Array.isArray(teamData.players) ? [...teamData.players] : [];
  const p = players[index];
  if (!p) return;

  const name = prompt("Player name:", p.name ?? "");
  if (!name) return;

  const position = prompt("Position (FW/MID/DEF/GK):", p.position ?? "FW");
  if (!position) return;

  const matches = Number(prompt("Matches:", String(p.matches ?? 0)));
  const goals = Number(prompt("Goals:", String(p.goals ?? 0)));
  const assists = Number(prompt("Assists:", String(p.assists ?? 0)));
  const rating = Number(prompt("Rating (0-100):", String(p.rating ?? 0)));

  players[index] = {
    name: name.trim(),
    position: position.trim(),
    matches: Number.isNaN(matches) ? 0 : matches,
    goals: Number.isNaN(goals) ? 0 : goals,
    assists: Number.isNaN(assists) ? 0 : assists,
    rating: Number.isNaN(rating) ? 0 : rating,
  };

  try {
    await savePlayers(players);
  } catch (e) {
    alert("Save error: " + e.message);
  }
}

async function deletePlayer(index) {
  if (!isAdmin()) return alert("Admin only");

  if (!confirm("Delete this player?")) return;

  const players = Array.isArray(teamData.players) ? [...teamData.players] : [];
  players.splice(index, 1);

  try {
    await savePlayers(players);
  } catch (e) {
    alert("Save error: " + e.message);
  }
}

(async () => {
  await loadMe();
  await loadTeam();
})();