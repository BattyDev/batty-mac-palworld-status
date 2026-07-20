const owner = location.hostname.split(".")[0];
const repository = location.pathname.split("/").filter(Boolean)[0] || `${owner}.github.io`;
const statusUrl = `https://raw.githubusercontent.com/${owner}/${repository}/data/status.json`;

const text = (id, value) => { document.getElementById(id).textContent = value ?? "—"; };
const duration = seconds => {
  seconds = Math.max(0, Number(seconds || 0));
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60);
  return [days && `${days}d`, (days || hours) && `${hours}h`, `${minutes}m`].filter(Boolean).join(" ");
};

async function refresh() {
  try {
    const response = await fetch(`${statusUrl}?t=${Date.now()}`, {cache: "no-store"});
    if (!response.ok) throw new Error("snapshot unavailable");
    const data = await response.json();
    const age = Date.now() - Date.parse(data.updated_at);
    const stale = age > 10 * 60 * 1000;
    const unavailable = age > 30 * 60 * 1000;
    const online = Boolean(data.online) && !unavailable;
    const state = document.getElementById("state");
    state.textContent = online ? "● Online" : unavailable ? "● Status unavailable" : "● Offline";
    state.className = `status ${online ? "online" : "offline"}`;
    document.getElementById("stale").hidden = !stale;
    text("server-name", data.server_name); text("description", data.description);
    text("version", data.version); text("players", data.players);
    text("players-max", `of ${data.max_players} players`); text("fps", data.fps);
    text("day", data.world_day); text("bases", data.base_camps); text("uptime", duration(data.uptime));
    const updated = document.getElementById("updated");
    updated.dateTime = data.updated_at; updated.textContent = new Date(data.updated_at).toLocaleString();
    const settings = document.getElementById("settings"); settings.replaceChildren();
    for (const [label, value] of Object.entries(data.settings || {})) {
      const term = document.createElement("dt"); term.textContent = label;
      const detail = document.createElement("dd"); detail.textContent = typeof value === "boolean" ? (value ? "Enabled" : "Disabled") : value;
      settings.append(term, detail);
    }
  } catch (_) {
    document.getElementById("stale").hidden = false;
    text("state", "● Status unavailable");
    document.getElementById("state").className = "status offline";
  }
}

refresh();
setInterval(refresh, 5 * 60 * 1000);
