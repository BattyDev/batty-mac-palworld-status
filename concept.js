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

function iconForHighlight(label) {
  const icons = {
    "XP": "bi-lightning-charge-fill",
    "Capture": "bi-bullseye",
    "Resources": "bi-box-seam-fill",
    "Work speed": "bi-gear-wide-connected",
    "Pals per base": "bi-people-fill",
    "Guild bases": "bi-houses-fill",
    "Equipment wear": "bi-shield-check",
    "Less base damage": "bi-bricks",
    "Base radius": "bi-bounding-box-circles"
  };
  return icons[label] || "bi-stars";
}

function themeForHighlight(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function renderHighlights(data) {
  const host = $("#concept-highlights");
  if (!host) return;
  host.replaceChildren();
  for (const item of worldHighlights(data)) {
    const article = document.createElement("article");
    article.className = `concept-highlight setting-${themeForHighlight(item.label)}`;
    article.innerHTML = `<i class="setting-art bi ${iconForHighlight(item.label)}" aria-hidden="true"></i><strong></strong><span></span><small></small>`;
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
  const onlineNames = new Set(Array.isArray(data.player_names) ? data.player_names : []);
  const recent = Array.isArray(data.recent_players)
    ? data.recent_players.filter(player => !onlineNames.has(player.name)).slice(0, 10)
    : [];
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
    item.textContent = "Everyone recently seen is currently online.";
    host.append(item);
  }
}

function achievementsForGuild(guild) {
  const achievements = [];
  const bases = finite(guild.bases);
  const workers = finite(guild.workers);
  const levels = guild.worker_levels || {};
  const health = finite(guild.worker_health_average);
  const working = finite(guild.top_worker_actions?.find(action => action.name === "Working")?.count);
  const add = (icon, title, detail, rank) => achievements.push({icon, title, detail, rank});

  if (bases >= 1) add("bi-house-heart-fill", "Camp Established", `${bases === 1 ? "First base is online" : `${bases} active bases across the islands`}.`, 1);
  if (bases >= 3) add("bi-map-fill", "Island Network", `A network of ${bases} working bases.`, 3);
  if (workers >= 10) add("bi-people-fill", "Crew Assembled", `${workers} working Pals keep the guild moving.`, 2);
  if (workers >= 30) add("bi-gear-wide-connected", "Industrial Powerhouse", `A workforce ${workers} Pals strong.`, 4);
  if (finite(levels.maximum) >= 50) add("bi-star-fill", "Veteran Workforce", `Raised a base worker to level ${levels.maximum}.`, 5);
  if (health >= 95 && workers >= 5) add("bi-heart-pulse-fill", "Well-Kept Crew", `${tidy(health)}% average worker health.`, 3);
  if (working >= 20) add("bi-hammer", "Always Building", `${working} Pals working in the latest snapshot.`, 3);
  return achievements;
}

function renderAchievements(data) {
  const host = $("#concept-achievements");
  if (!host) return;
  host.replaceChildren();
  const guilds = Array.isArray(data.guilds) ? data.guilds : [];

  for (const guild of guilds) {
    for (const achievement of achievementsForGuild(guild)) {
      const card = document.createElement("article");
      card.className = `achievement-card rank-${achievement.rank}`;
      const icon = document.createElement("i");
      icon.className = `bi ${achievement.icon}`;
      const copy = document.createElement("div");
      const guildName = document.createElement("small");
      guildName.textContent = guild.name;
      const title = document.createElement("h3");
      title.textContent = achievement.title;
      const detail = document.createElement("p");
      detail.textContent = achievement.detail;
      copy.append(guildName, title, detail);
      card.append(icon, copy);
      host.append(card);
    }
  }

  if (!host.children.length) host.textContent = "The current snapshot has not unlocked any guild accomplishments yet.";
}

function displayData(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (value == null || value === "") return "—";
  return typeof value === "number" ? tidy(value) : String(value);
}

function addDataRow(host, label, value) {
  const row = document.createElement("div");
  const term = document.createElement("span");
  const detail = document.createElement("strong");
  term.textContent = label;
  detail.textContent = displayData(value);
  row.append(term, detail);
  host.append(row);
}

function renderOverkill(data, online) {
  const summary = $("#concept-overkill-summary");
  const censusHost = $("#concept-census");
  const playerHost = $("#concept-player-detail");
  const configHost = $("#concept-configuration");
  if (!summary || !censusHost || !playerHost || !configHost) return;
  summary.replaceChildren();
  censusHost.replaceChildren();
  playerHost.replaceChildren();
  configHost.replaceChildren();

  const performance = data.performance || {};
  const system = data.system || {};
  const census = data.pal_census || {};
  const summaryItems = [
    ["bi-activity", "Server status", online ? "Online" : "Offline"],
    ["bi-speedometer2", "Average FPS", performance.average_fps ?? data.fps],
    ["bi-hourglass-split", "Frame time", performance.frame_time_ms == null ? "—" : `${tidy(performance.frame_time_ms)} ms`],
    ["bi-memory", "Palworld memory", system.palworld_memory_gib == null ? "—" : `${tidy(system.palworld_memory_gib)} GiB`],
    ["bi-thermometer-half", "Host temperature", system.temperature_c == null ? "—" : `${tidy(system.temperature_c)} °C`],
    ["bi-database-fill", "Disk free", system.disk_free_gib == null ? "—" : `${tidy(system.disk_free_gib)} GiB`]
  ];
  for (const [iconName, label, value] of summaryItems) {
    const card = document.createElement("article");
    const icon = document.createElement("i");
    icon.className = `bi ${iconName}`;
    const small = document.createElement("small");
    small.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = displayData(value);
    card.append(icon, small, strong);
    summary.append(card);
  }

  addDataRow(censusHost, "Total actors", census.total_actors);
  for (const [label, value] of Object.entries(census.counts || {})) addDataRow(censusHost, label, value);
  for (const [label, value] of Object.entries(census.health_average || {})) addDataRow(censusHost, `${label} health`, `${tidy(value)}%`);
  for (const player of Array.isArray(data.online_players) ? data.online_players : []) {
    addDataRow(playerHost, player.name, `Lv ${displayData(player.level)} · ${tidy(player.ping)} ms · ${player.guild || "No guild"}`);
  }
  if (!playerHost.children.length) addDataRow(playerHost, "Players", "Nobody online");
  for (const [label, value] of Object.entries(data.configuration || {}).sort(([a], [b]) => a.localeCompare(b))) {
    addDataRow(configHost, label, value);
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

function bossCountdown(value) {
  const remaining = Math.max(0, Math.floor((Date.parse(value) - Date.now()) / 1000));
  if (!remaining) return "Checking…";
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  return hours
    ? `${hours}h ${String(minutes).padStart(2, "0")}m`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function updateBossCountdowns() {
  for (const node of all("[data-respawn-at]")) {
    node.textContent = bossCountdown(node.dataset.respawnAt);
  }
}

function selectBoss(key) {
  for (const node of all("[data-boss-key]")) {
    node.classList.toggle("is-selected", node.dataset.bossKey === key);
  }
}

function bossStatusCopy(boss) {
  if (boss.status === "alive") {
    return boss.health_percent == null ? "Alive now" : `${tidy(boss.health_percent)}% health`;
  }
  if (boss.status === "down") return boss.estimate_source === "measured" ? "Measured respawn" : "Estimated respawn";
  return boss.last_seen_at ? `Last seen ${seenAgo(boss.last_seen_at)} ago` : "Waiting for first sighting";
}

function renderBossRadar(data) {
  const tracker = data.boss_tracker || {};
  const bosses = Array.isArray(tracker.bosses) ? tracker.bosses : [];
  const markers = $("#boss-markers");
  const list = $("#boss-list");
  const summary = $("#boss-summary");
  const empty = $("#boss-map-empty");
  const coverage = $("[data-boss-coverage]");
  if (!markers || !list || !summary || !empty || !coverage) return;

  markers.replaceChildren();
  list.replaceChildren();
  summary.replaceChildren();
  empty.hidden = bosses.length > 0;
  const trackerFresh = tracker.updated_at && Date.now() - Date.parse(tracker.updated_at) < 2 * 60 * 1000;
  for (const node of all("[data-boss-signal]")) node.classList.toggle("is-live", Boolean(trackerFresh));
  coverage.textContent = bosses.length
    ? `${bosses.length} alpha${bosses.length === 1 ? "" : "s"} learned · regions load near players`
    : "Waiting for alpha sightings";

  const counts = tracker.summary || {};
  const summaryItems = [
    ["alive", counts.alive ?? bosses.filter(item => item.status === "alive").length, "Alive now"],
    ["down", counts.down ?? bosses.filter(item => item.status === "down").length, "Respawning"],
    ["unknown", counts.unknown ?? bosses.filter(item => item.status === "unknown").length, "Not observed"]
  ];
  for (const [state, value, label] of summaryItems) {
    const card = document.createElement("article");
    card.className = state;
    const strong = document.createElement("strong");
    strong.textContent = finite(value);
    const span = document.createElement("span");
    span.textContent = label;
    card.append(strong, span);
    summary.append(card);
  }
  fill("bosses-up", finite(counts.alive));

  for (const boss of bosses) {
    const key = String(boss.key || boss.name || "boss");
    const status = ["alive", "down", "unknown"].includes(boss.status) ? boss.status : "unknown";
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `boss-marker status-${status}`;
    marker.dataset.bossKey = key;
    marker.style.left = `${Math.max(2, Math.min(98, finite(boss.map_x)))}%`;
    marker.style.top = `${100 - Math.max(2, Math.min(98, finite(boss.map_y)))}%`;
    marker.title = `${boss.name} · ${bossStatusCopy(boss)}`;
    marker.setAttribute("aria-label", marker.title);
    const markerIcon = document.createElement("i");
    markerIcon.className = status === "alive" ? "bi bi-crosshair" : status === "down" ? "bi bi-hourglass-split" : "bi bi-question-lg";
    marker.append(markerIcon);
    marker.addEventListener("click", () => selectBoss(key));
    markers.append(marker);

    const card = document.createElement("button");
    card.type = "button";
    card.className = `boss-card status-${status}`;
    card.dataset.bossKey = key;
    const icon = document.createElement("span");
    icon.className = "boss-state-icon";
    const iconGlyph = document.createElement("i");
    iconGlyph.className = status === "alive" ? "bi bi-lightning-charge-fill" : status === "down" ? "bi bi-hourglass-split" : "bi bi-eye-slash-fill";
    icon.append(iconGlyph);
    const copy = document.createElement("span");
    copy.className = "boss-card-copy";
    const name = document.createElement("strong");
    name.textContent = boss.name || "Unknown Alpha";
    const meta = document.createElement("small");
    meta.textContent = `${boss.level ? `Lv ${boss.level} · ` : ""}${bossStatusCopy(boss)}`;
    copy.append(name, meta);
    const time = document.createElement("span");
    time.className = "boss-card-time";
    const timeValue = document.createElement("strong");
    const timeLabel = document.createElement("small");
    if (status === "down" && boss.estimated_respawn_at) {
      timeValue.dataset.respawnAt = boss.estimated_respawn_at;
      timeValue.textContent = bossCountdown(boss.estimated_respawn_at);
      timeLabel.textContent = "until check";
    } else {
      timeValue.textContent = status === "alive" ? "UP" : "—";
      timeLabel.textContent = status === "alive" ? "loaded now" : "no claim";
    }
    time.append(timeValue, timeLabel);
    card.append(icon, copy, time);
    card.addEventListener("click", () => selectBoss(key));
    list.append(card);
  }

  if (!bosses.length) {
    const note = document.createElement("p");
    note.className = "boss-list-empty";
    note.textContent = "The tracker learns an Alpha the first time somebody visits it. No player positions or IDs are needed.";
    list.append(note);
  }
  updateBossCountdowns();
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
    renderAchievements(data);
    renderOverkill(data, online);
    renderBossRadar(data);
  } catch (_) {
    fill("status", "Signal lost");
    for (const node of all("[data-status-dot]")) node.classList.remove("is-online");
  }
}

loadConcept();
setInterval(loadConcept, 60000);
setInterval(updateBossCountdowns, 1000);

function updateClock() {
  const clock = $("[data-clock]");
  if (!clock) return;
  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = now.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

updateClock();
setInterval(updateClock, 30000);

function showView(name, updateAddress = true) {
  const target = $(`[data-view="${name}"]`);
  if (!target) return;

  for (const pane of all("[data-view]")) {
    const active = pane === target;
    pane.hidden = !active;
    pane.classList.toggle("is-active", active);
  }

  for (const control of all("[data-view-target]")) {
    const active = control.dataset.viewTarget === name;
    control.classList.toggle("is-active", active);
    if (control.closest(".system-icons")) {
      if (active) control.setAttribute("aria-current", "page");
      else control.removeAttribute("aria-current");
    }
  }

  if (updateAddress) history.replaceState(null, "", `#${name}`);
  window.scrollTo({top: 0, behavior: "smooth"});
}

for (const control of all("[data-view-target]")) {
  control.addEventListener("click", event => {
    event.preventDefault();
    showView(control.dataset.viewTarget);
  });
}

const initialView = location.hash.replace("#", "");
showView($(`[data-view="${initialView}"]`) ? initialView : "home", false);
