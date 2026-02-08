let ME = null;
let TEAMS_CACHE = [];

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

function isAdmin() {
  return ME && ME.role === "admin";
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
      <div class="team-card__meta">Coach: <b>${esc(team.coach || "")}</b></div>
      <div class="team-card__meta">Rating: <b>${esc(team.rating ?? "")}</b></div>
      <div class="team-card__meta">Players: <b>${(team.players || []).length}</b></div>
    </div>
  `;
  return a;
}

function getTeamById(id) {
  return TEAMS_CACHE.find(t => String(t._id) === String(id)) || null;
}

function matchCard(m) {
  const div = document.createElement("div");
  div.style.padding = "12px";
  div.style.border = "1px solid rgba(255,255,255,0.08)";
  div.style.borderRadius = "12px";
  div.style.marginBottom = "12px";

  const home = getTeamById(m.homeTeamId) || {};
  const away = getTeamById(m.awayTeamId) || {};
  const score = `${m.scoreHome ?? 0} - ${m.scoreAway ?? 0}`;
  const when = m.date ? new Date(m.date).toLocaleString() : "";
  const status = m.status || "scheduled";

  const goals = Array.isArray(m.events) ? m.events.filter(e => e && e.type === "goal") : [];
  const goalsHtml = goals.length
    ? goals
        .slice()
        .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
        .map(g => {
          const teamName =
            String(g.teamId) === String(home._id) ? home.name :
            String(g.teamId) === String(away._id) ? away.name : "";
          const assist = g.assistName ? ` (A: ${esc(g.assistName)})` : "";
          const delBtn = isAdmin()
            ? `<button type="button" data-del-event="1" data-mid="${esc(m._id)}" data-eid="${esc(g._id)}" style="margin-left:8px;">x</button>`
            : "";
          return `<div style="opacity:.92; font-size:14px; margin-top:4px;">
            ${esc(g.minute)}' <b>${esc(g.playerName || "")}</b>${assist} <span style="opacity:.75;">(${esc(teamName || "")})</span>
            ${delBtn}
          </div>`;
        })
        .join("")
    : `<div style="opacity:.7; font-size:14px;">No goals yet</div>`;

  const adminControls = isAdmin()
    ? `
      <div style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08);">
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <select data-status="${esc(m._id)}">
            <option value="scheduled" ${status === "scheduled" ? "selected" : ""}>scheduled</option>
            <option value="live" ${status === "live" ? "selected" : ""}>live</option>
            <option value="finished" ${status === "finished" ? "selected" : ""}>finished</option>
          </select>
          <button type="button" data-save-status="1" data-mid="${esc(m._id)}">Save status</button>
          <button type="button" data-del-match="1" data-mid="${esc(m._id)}">Delete match</button>
        </div>

        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <select data-goal-team="${esc(m._id)}">
            <option value="${esc(m.homeTeamId)}">${esc(home.name || "Home")}</option>
            <option value="${esc(m.awayTeamId)}">${esc(away.name || "Away")}</option>
          </select>

          <select data-goal-player="${esc(m._id)}"></select>
          <select data-goal-assist="${esc(m._id)}"></select>

          <input data-goal-minute="${esc(m._id)}" type="number" min="0" max="130" placeholder="minute" style="width:110px;" />
          <button type="button" data-add-goal="1" data-mid="${esc(m._id)}">Add goal</button>
        </div>

        <div style="opacity:.7; font-size:12px; margin-top:6px;">Admin only</div>
      </div>
    `
    : "";

  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap;">
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <b>${esc(home.name || "Home")}</b>
        <span style="opacity:.7;">vs</span>
        <b>${esc(away.name || "Away")}</b>
        <span style="opacity:.7;">(${esc(status)})</span>
        <span style="opacity:.6; font-size:12px;">${esc(when)}</span>
      </div>
      <div style="font-size:18px;"><b>${esc(score)}</b></div>
    </div>
    <div style="margin-top:10px;">${goalsHtml}</div>
    ${adminControls}
  `;

  if (isAdmin()) {
    setTimeout(() => {
      const teamSel = div.querySelector(`select[data-goal-team="${m._id}"]`);
      const pSel = div.querySelector(`select[data-goal-player="${m._id}"]`);
      const aSel = div.querySelector(`select[data-goal-assist="${m._id}"]`);

      const fillPlayers = () => {
        const tid = teamSel.value;
        const t = getTeamById(tid) || {};
        const players = Array.isArray(t.players) ? t.players : [];

        pSel.innerHTML = players
          .map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`)
          .join("") || `<option value="">No players</option>`;

        aSel.innerHTML =
          `<option value="">(no assist)</option>` +
          players.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("");
      };

      teamSel.addEventListener("change", fillPlayers);
      fillPlayers();
    }, 0);
  }

  return div;
}

async function loadMe() {
  try {
    const data = await api("/api/auth/me");
    ME = data.user || null;

    const el = document.getElementById("homeAuthText");
    if (el) {
      if (ME) el.innerHTML = `Logged in as <b>${esc(ME.username)}</b> (${esc(ME.role)})`;
      else el.innerHTML = `Guest mode: you can only view data. <a href="/admin">Login</a>`;
    }

    const addBtn = document.getElementById("addMatchBtn");
    if (addBtn) addBtn.style.display = isAdmin() ? "inline-block" : "none";
  } catch {
    ME = null;
  }
}

async function loadTeams() {
  TEAMS_CACHE = await api("/api/teams");
  const grid = document.getElementById("teamsGrid");
  grid.innerHTML = "";
  TEAMS_CACHE.forEach(t => grid.appendChild(teamCard(t)));
}

function fillMatchTeamSelects() {
  const home = document.getElementById("matchHomeTeam");
  const away = document.getElementById("matchAwayTeam");
  if (!home || !away) return;

  home.innerHTML = TEAMS_CACHE.map(t => `<option value="${esc(t._id)}">${esc(t.name)}</option>`).join("");
  away.innerHTML = TEAMS_CACHE.map(t => `<option value="${esc(t._id)}">${esc(t.name)}</option>`).join("");
}

async function loadMatches() {
  const list = document.getElementById("matchesList");
  let matches = [];
  try {
    matches = await api("/api/matches");
  } catch {
    matches = [];
  }

  matches = (matches || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

  list.innerHTML = "";
  if (!matches.length) {
    list.innerHTML = `<div style="opacity:.7;">No matches yet</div>`;
    return;
  }
  matches.forEach(m => list.appendChild(matchCard(m)));
}

function bindUI() {
  const reload = document.getElementById("reloadMatchesBtn");
  if (reload) reload.addEventListener("click", loadMatches);

  const addBtn = document.getElementById("addMatchBtn");
  const form = document.getElementById("adminMatchForm");
  const cancelBtn = document.getElementById("cancelMatchBtn");
  const createBtn = document.getElementById("createMatchBtn");

  if (addBtn && form) {
    addBtn.addEventListener("click", () => {
      form.style.display = form.style.display === "none" ? "block" : "none";
      if (form.style.display !== "none") fillMatchTeamSelects();
    });
  }

  if (cancelBtn && form) {
    cancelBtn.addEventListener("click", () => {
      form.style.display = "none";
    });
  }

  if (createBtn) {
    createBtn.addEventListener("click", async () => {
      if (!isAdmin()) return;

      const homeTeamId = document.getElementById("matchHomeTeam").value;
      const awayTeamId = document.getElementById("matchAwayTeam").value;
      const dateVal = document.getElementById("matchDate").value;
      const status = document.getElementById("matchStatus").value;

      if (!homeTeamId || !awayTeamId || !dateVal) return alert("Select teams and date");
      if (homeTeamId === awayTeamId) return alert("Teams must be different");

      try {
        await api("/api/matches", {
          method: "POST",
          body: JSON.stringify({ homeTeamId, awayTeamId, date: new Date(dateVal).toISOString(), status })
        });
        document.getElementById("adminMatchForm").style.display = "none";
        await loadMatches();
      } catch (e) {
        alert(e.message);
      }
    });
  }

  const list = document.getElementById("matchesList");
  list.addEventListener("click", async (e) => {
    if (!isAdmin()) return;

    const addGoalBtn = e.target.closest("button[data-add-goal]");
    if (addGoalBtn) {
      const mid = addGoalBtn.getAttribute("data-mid");
      const teamSel = document.querySelector(`select[data-goal-team="${mid}"]`);
      const pSel = document.querySelector(`select[data-goal-player="${mid}"]`);
      const aSel = document.querySelector(`select[data-goal-assist="${mid}"]`);
      const minEl = document.querySelector(`input[data-goal-minute="${mid}"]`);

      const teamId = teamSel.value;
      const playerName = pSel.value || "";
      const assistName = aSel.value || "";
      const minute = Number(minEl.value || 0);

      if (!teamId || !playerName) return alert("Choose team and scorer");
      if (Number.isNaN(minute) || minute < 0 || minute > 130) return alert("Invalid minute");

      try {
        await api(`/api/matches/${mid}/events`, {
          method: "POST",
          body: JSON.stringify({ type: "goal", minute, teamId, playerName, assistName })
        });
        await loadTeams();
        await loadMatches();
      } catch (err) {
        alert(err.message);
      }
      return;
    }

    const saveStatusBtn = e.target.closest("button[data-save-status]");
    if (saveStatusBtn) {
      const mid = saveStatusBtn.getAttribute("data-mid");
      const sel = document.querySelector(`select[data-status="${mid}"]`);
      const status = sel.value;

      try {
        await api(`/api/matches/${mid}`, {
          method: "PUT",
          body: JSON.stringify({ status })
        });
        await loadMatches();
      } catch (err) {
        alert(err.message);
      }
      return;
    }

    const delMatchBtn = e.target.closest("button[data-del-match]");
    if (delMatchBtn) {
      const mid = delMatchBtn.getAttribute("data-mid");
      if (!confirm("Delete match?")) return;

      try {
        await api(`/api/matches/${mid}`, { method: "DELETE" });
        await loadMatches();
      } catch (err) {
        alert(err.message);
      }
      return;
    }

    const delEventBtn = e.target.closest("button[data-del-event]");
    if (delEventBtn) {
      const mid = delEventBtn.getAttribute("data-mid");
      const eid = delEventBtn.getAttribute("data-eid");
      if (!confirm("Delete goal event?")) return;

      try {
        await api(`/api/matches/${mid}/events/${eid}`, { method: "DELETE" });
        await loadTeams();
        await loadMatches();
      } catch (err) {
        alert(err.message);
      }
      return;
    }
  });
}

(async () => {
  await loadMe();
  await loadTeams();
  bindUI();
  fillMatchTeamSelects();
  await loadMatches();
})();