const conceptOwner = location.hostname.split(".")[0];
const conceptRepository = location.pathname.split("/").filter(Boolean)[0] || `${conceptOwner}.github.io`;
const conceptLocal = ["127.0.0.1", "localhost"].includes(location.hostname);
const conceptStatusUrl = conceptLocal
  ? "status.json"
  : `https://raw.githubusercontent.com/${conceptOwner}/${conceptRepository}/data/status.json`;

const $ = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const tidy = value => {
  const parsed = finite(value);
  return Number.isInteger(parsed) ? `${parsed}` : parsed.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};
const elapsed = seconds => {
  let remaining = Math.max(0, finite(seconds));
  const days = Math.floor(remaining / 86400);
  remaining %= 86400;
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor(remaining % 3600 / 60);
  return [days && `${days}d`, (days || hours) && `${hours}h`, `${minutes}m`].filter(Boolean).join(" ");
};
const seenAgo = value => {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

function fill(name, value) {
  for (const node of all(`[data-field="${name}"]`)) node.textContent = value ?? "—";
}

function worldHighlights(data) {
  const config = data.configuration || {};
  const items = [];
  const add = (value, label, note) => items.push({value, label, note});
  if (config.ExpRate != null) add(`${tidy(config.ExpRate)}×`, "XP", "Faster leveling");
  if (config.PalCaptureRate != null) add(`${tidy(config.PalCaptureRate)}×`, "Capture", "Friendlier catches");
  if (config.CollectionDropRate != null) add(`${tidy(config.CollectionDropRate)}×`, "Resources", "Bigger gathering haul");
  if (config.WorkSpeedRate != null) add(`${tidy(config.WorkSpeedRate)}×`, "Work speed", "Quicker base projects");
  if (config.BaseCampWorkerMaxNum != null) add(tidy(config.BaseCampWorkerMaxNum), "Pals per base", "A proper workforce");
  if (config.BaseCampMaxNumInGuild != null) add(tidy(config.BaseCampMaxNumInGuild), "Guild bases", "Room to expand");
  if (finite(config.EquipmentDurabilityDamageRate) === 0) add("None", "Equipment wear", "No repair chores");
  if (config.BuildObjectDamageRate != null && finite(config.BuildObjectDamageRate) < 1) {
    add(`${Math.round((1 - finite(config.BuildObjectDamageRate)) * 100)}%`, "Less base damage", "Built to last");
  }
  for (const feature of Array.isArray(data.features) ? data.features : []) {
    if (feature?.title) add("2×", "Base radius", feature.title);
  }
  return items.slice(0, 8);
}

function achievementFor(guild) {
  const bases = finite(guild.bases);
  const workers = finite(guild.workers);
  const maximum = finite(guild.worker_levels?.maximum);
  if (maximum >= 50) return {mark: "★", title: "Veteran crew", note: `Level ${maximum} worker`};
  if (workers >= 30) return {mark: "⚙", title: "Powerhouse", note: `${workers} working Pals`};
  if (bases >= 3) return {mark: "◆", title: "Island network", note: `${bases} active bases`};
  if (workers >= 10) return {mark: "●", title: "Crew assembled", note: `${workers} working Pals`};
  return {mark: "△", title: "Camp established", note: `${bases} active base${bases === 1 ? "" : "s"}`};
}

function renderHighlights(data) {
  const host = $("#concept-highlights");
  if (!host) return;
  host.replaceChildren();
  for (const item of worldHighlights(data)) {
    const article = document.createElement("article");
    article.className = "concept-highlight";
    article.innerHTML = `<strong></strong><span></span><small></small>`;
    article.querySelector("strong").textContent = item.value;
    article.querySelector("span").textContent = item.label;
    article.querySelector("small").textContent = item.note;
    host.append(article);
  }
}

function renderOnline(data) {
  const host = $("#concept-online");
  if (!host) return;
  host.replaceChildren();
  const names = Array.isArray(data.player_names) ? data.player_names : [];
  for (const name of names.length ? names : ["The islands are quiet"]) {
    const item = document.createElement("li");
    const avatar = document.createElement("span");
    avatar.textContent = names.length ? name.slice(0, 1).toUpperCase() : "—";
    const label = document.createElement("strong");
    label.textContent = name;
    item.append(avatar, label);
    host.append(item);
  }
}

function renderRecent(data) {
  const host = $("#concept-recent");
  if (!host) return;
  host.replaceChildren();
  const recent = Array.isArray(data.recent_players) ? data.recent_players.slice(0, 5) : [];
  for (const player of recent) {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = player.name;
    const time = document.createElement("span");
    time.textContent = `${seenAgo(player.last_seen)} ago`;
    item.append(name, time);
    host.append(item);
  }
  if (!recent.length) {
    const item = document.createElement("li");
    item.textContent = "No recent visitors";
    host.append(item);
  }
}

function renderGuilds(data) {
  const host = $("#concept-guilds");
  if (!host) return;
  host.replaceChildren();
  for (const guild of Array.isArray(data.guilds) ? data.guilds : []) {
    const achievement = achievementFor(guild);
    const article = document.createElement("article");
    article.className = "concept-guild";
    const name = document.createElement("h3");
    name.textContent = guild.name;
    const seal = document.createElement("div");
    seal.className = "concept-seal";
    const mark = document.createElement("b");
    mark.textContent = achievement.mark;
    const copy = document.createElement("span");
    copy.innerHTML = `<strong></strong><small></small>`;
    copy.querySelector("strong").textContent = achievement.title;
    copy.querySelector("small").textContent = achievement.note;
    seal.append(mark, copy);
    const totals = document.createElement("p");
    totals.textContent = `${finite(guild.bases)} bases · ${finite(guild.workers)} workers`;
    article.append(name, seal, totals);
    host.append(article);
  }
  if (!host.children.length) host.textContent = "Guild records are waiting for the next active snapshot.";
}

async function loadConcept() {
  try {
    const response = await fetch(`${conceptStatusUrl}?t=${Date.now()}`, {cache: "no-store"});
    if (!response.ok) throw new Error("Status unavailable");
    const data = await response.json();
    const online = Boolean(data.online) && Date.now() - Date.parse(data.updated_at) < 30 * 60 * 1000;
    fill("server-name", data.server_name || "Batty Mac");
    fill("description", data.description || "Palworld dedicated server");
    fill("version", data.version || "Unavailable");
    fill("status", online ? "Online" : "Offline");
    fill("players", finite(data.players));
    fill("max-players", finite(data.max_players));
    fill("fps", Math.round(finite(data.fps)));
    fill("day", finite(data.world_day));
    fill("bases", finite(data.base_camps));
    fill("uptime", elapsed(data.uptime));
    fill("updated", new Date(data.updated_at).toLocaleString());
    for (const node of all("[data-status-dot]")) node.classList.toggle("is-online", online);
    renderHighlights(data);
    renderOnline(data);
    renderRecent(data);
    renderGuilds(data);
  } catch (_) {
    fill("status", "Signal lost");
    for (const node of all("[data-status-dot]")) node.classList.remove("is-online");
  }
}

loadConcept();
