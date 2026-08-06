const API = "https://moodmatch-api-ko99.vercel.app/api/cinemap";
const IMG = "https://image.tmdb.org/t/p/w500";
const svg = document.getElementById("graph");
const viewport = document.getElementById("viewport");
const edgesLayer = document.getElementById("edgesLayer");
const nodesLayer = document.getElementById("nodesLayer");
const stats = document.getElementById("mapStats");
const drawer = document.getElementById("drawer");
const drawerContent = document.getElementById("drawerContent");
const resultsBox = document.getElementById("searchResults");
const input = document.getElementById("movieSearch");
const errorBox = document.getElementById("startupError");

const nodeMap = new Map();
const edgeMap = new Map();
let panX = 0;
let panY = 0;
let scale = 1;
let dragging = false;
let dragStart = null;
let timer;

const ns = "http://www.w3.org/2000/svg";
const keyFor = (type, id) => `${type}:${id}`;

function setTransform() {
  viewport.setAttribute("transform", `translate(${panX} ${panY}) scale(${scale})`);
}

function updateStats() {
  stats.textContent = `${nodeMap.size} nodes · ${edgeMap.size} connections`;
}

function showError(error) {
  console.error(error);
  errorBox.textContent = error?.message || "CineMap could not load.";
  errorBox.style.display = "block";
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.details || data.error || "Request failed");
  return data;
}

function positionFor(type, parentId, index, total) {
  const parent = parentId ? nodeMap.get(parentId) : null;
  const cx = parent?.x ?? 0;
  const cy = parent?.y ?? 0;
  const radius = type === "movie" ? 230 : 145;
  const angle = total > 1 ? (Math.PI * 2 * index) / total - Math.PI / 2 : 0;
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

function addNode(type, data, parentId = null, index = 0, total = 1) {
  const id = keyFor(type, data.id);
  if (nodeMap.has(id)) return id;
  const pos = nodeMap.size ? positionFor(type, parentId, index, total) : { x: 0, y: 0 };
  nodeMap.set(id, { id, type, data, x: pos.x, y: pos.y });
  renderNode(nodeMap.get(id));
  updateStats();
  return id;
}

function addEdge(from, to, label) {
  const id = `${from}|${to}|${label}`;
  if (edgeMap.has(id)) return;
  edgeMap.set(id, { id, from, to, label });
  renderEdge(edgeMap.get(id));
  updateStats();
}

function renderEdge(edge) {
  const from = nodeMap.get(edge.from);
  const to = nodeMap.get(edge.to);
  if (!from || !to) return;
  const group = document.createElementNS(ns, "g");
  group.dataset.edgeId = edge.id;
  const line = document.createElementNS(ns, "line");
  line.setAttribute("class", "edge");
  line.setAttribute("x1", from.x);
  line.setAttribute("y1", from.y);
  line.setAttribute("x2", to.x);
  line.setAttribute("y2", to.y);
  const text = document.createElementNS(ns, "text");
  text.setAttribute("class", "edge-label");
  text.setAttribute("x", (from.x + to.x) / 2);
  text.setAttribute("y", (from.y + to.y) / 2 - 5);
  text.setAttribute("text-anchor", "middle");
  text.textContent = edge.label;
  group.append(line, text);
  edgesLayer.appendChild(group);
}

function renderNode(node) {
  const group = document.createElementNS(ns, "g");
  group.setAttribute("class", `node ${node.type}`);
  group.setAttribute("transform", `translate(${node.x} ${node.y})`);
  group.dataset.nodeId = node.id;

  if (node.type === "genre") {
    const diamond = document.createElementNS(ns, "polygon");
    diamond.setAttribute("points", "0,-27 27,0 0,27 -27,0");
    group.appendChild(diamond);
  } else {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("r", node.type === "movie" ? 34 : 25);
    group.appendChild(circle);
  }

  if (node.type === "movie" && node.data.poster_path) {
    const defs = document.createElementNS(ns, "defs");
    const clip = document.createElementNS(ns, "clipPath");
    const clipId = `clip-${String(node.data.id).replace(/[^a-zA-Z0-9]/g, "")}`;
    clip.setAttribute("id", clipId);
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("r", "31");
    clip.appendChild(circle);
    defs.appendChild(clip);
    const image = document.createElementNS(ns, "image");
    image.setAttribute("href", `${IMG}${node.data.poster_path}`);
    image.setAttribute("x", "-31");
    image.setAttribute("y", "-31");
    image.setAttribute("width", "62");
    image.setAttribute("height", "62");
    image.setAttribute("preserveAspectRatio", "xMidYMid slice");
    image.setAttribute("clip-path", `url(#${clipId})`);
    group.append(defs, image);
  }

  const text = document.createElementNS(ns, "text");
  text.setAttribute("y", node.type === "movie" ? 52 : 43);
  const label = node.data.title || node.data.name;
  text.textContent = label?.length > 24 ? `${label.slice(0, 22)}…` : label;
  group.appendChild(text);
  group.addEventListener("click", event => {
    event.stopPropagation();
    if (node.type === "movie") loadMovie(node.data.id, false).catch(showError);
    if (node.type === "director") loadDirector(node.data.id, false).catch(showError);
    if (node.type === "genre") loadGenre(node.data.id, false).catch(showError);
  });
  nodesLayer.appendChild(group);
}

function centerOn(nodeId) {
  const node = nodeMap.get(nodeId);
  if (!node) return;
  const rect = svg.getBoundingClientRect();
  scale = Math.min(1.05, Math.max(.55, scale));
  panX = rect.width / 2 - node.x * scale;
  panY = rect.height / 2 - node.y * scale + 50;
  setTransform();
}

function fitMap() {
  if (!nodeMap.size) return;
  const values = [...nodeMap.values()];
  const xs = values.map(n => n.x);
  const ys = values.map(n => n.y);
  const minX = Math.min(...xs) - 90;
  const maxX = Math.max(...xs) + 90;
  const minY = Math.min(...ys) - 90;
  const maxY = Math.max(...ys) + 90;
  const rect = svg.getBoundingClientRect();
  scale = Math.min(.95, rect.width / (maxX - minX), rect.height / (maxY - minY));
  panX = rect.width / 2 - ((minX + maxX) / 2) * scale;
  panY = rect.height / 2 - ((minY + maxY) / 2) * scale + 35;
  setTransform();
}

async function loadMovie(id, focus = true) {
  errorBox.style.display = "none";
  const data = await getJson(`${API}?id=${encodeURIComponent(id)}`);
  const root = addNode("movie", data.movie);
  const additions = [];
  if (data.director) additions.push({ type: "director", data: data.director, label: "directed by" });
  data.genres.slice(0, 5).forEach(genre => additions.push({ type: "genre", data: genre, label: "genre" }));
  data.related.slice(0, 12).forEach((movie, index) => additions.push({ type: "movie", data: movie, label: index < 6 ? "related" : "similar" }));
  additions.forEach((item, index) => {
    const child = addNode(item.type, item.data, root, index, additions.length);
    addEdge(root, child, item.label);
  });
  showMovieDetails(data);
  if (focus) centerOn(root); else fitMap();
}

async function loadDirector(id, focus = true) {
  const data = await getJson(`${API}?personId=${encodeURIComponent(id)}`);
  const root = addNode("director", data.person);
  data.movies.forEach((movie, index) => addEdge(root, addNode("movie", movie, root, index, data.movies.length), "directed"));
  showCollectionDetails("Filmmaker", data.person.name, data.person.biography, data.movies, data.person.profile_path);
  if (focus) centerOn(root); else fitMap();
}

async function loadGenre(id, focus = true) {
  const data = await getJson(`${API}?genreId=${encodeURIComponent(id)}`);
  const root = addNode("genre", data.genre);
  data.movies.forEach((movie, index) => addEdge(root, addNode("movie", movie, root, index, data.movies.length), "genre"));
  showCollectionDetails("Genre", data.genre.name, `Explore films associated with ${data.genre.name}.`, data.movies, null);
  if (focus) centerOn(root); else fitMap();
}

function showMovieDetails(data) {
  const movie = data.movie;
  drawerContent.innerHTML = `<div class="detail-head"><img class="poster" src="${movie.poster_path ? `${IMG}${movie.poster_path}` : "mmlogo.png"}" alt="${movie.title}"><div><h2>${movie.title}</h2><div class="meta">${[movie.release_date?.slice(0,4),movie.runtime?`${movie.runtime} min`:"",movie.vote_average?`${movie.vote_average.toFixed(1)}/10`:""].filter(Boolean).join(" · ")}</div>${data.director?`<div class="meta" style="margin-top:6px">Directed by ${data.director.name}</div>`:""}</div></div><p class="overview">${movie.overview||"No overview available."}</p><div class="chips">${data.genres.map(g=>`<span>${g.name}</span>`).join("")}${data.keywords.map(k=>`<span>${k.name}</span>`).join("")}</div><h3 style="margin-top:22px;font-size:14px">Connected films</h3><div class="chips">${data.related.slice(0,10).map(m=>`<span>${m.title}</span>`).join("")}</div>`;
  drawer.classList.add("open");
}

function showCollectionDetails(kind, title, description, movies, imagePath) {
  drawerContent.innerHTML = `<div class="detail-head"><img class="poster" src="${imagePath?`${IMG}${imagePath}`:"mmlogo.png"}" alt="${title}"><div><div class="meta">${kind}</div><h2>${title}</h2><div class="meta">${movies.length} films on this branch</div></div></div><p class="overview">${description||"Explore this branch of cinema."}</p><h3 style="margin-top:22px;font-size:14px">Films in this branch</h3><div class="chips">${movies.slice(0,14).map(m=>`<span>${m.title}</span>`).join("")}</div>`;
  drawer.classList.add("open");
}

input.addEventListener("input", () => {
  clearTimeout(timer);
  const query = input.value.trim();
  if (query.length < 2) return resultsBox.style.display = "none";
  timer = setTimeout(async () => {
    try {
      const results = await getJson(`${API}?query=${encodeURIComponent(query)}`);
      resultsBox.innerHTML = results.map(movie => `<div class="result" data-id="${movie.id}"><img src="${movie.poster_path?`${IMG}${movie.poster_path}`:"mmlogo.png"}"><div><strong>${movie.title}</strong><span>${movie.release_date?.slice(0,4)||"Unknown year"}</span></div></div>`).join("");
      resultsBox.style.display = results.length ? "block" : "none";
      resultsBox.querySelectorAll(".result").forEach(item => item.onclick = () => {
        input.value = item.querySelector("strong").textContent;
        resultsBox.style.display = "none";
        loadMovie(Number(item.dataset.id), true).catch(showError);
      });
    } catch (error) { showError(error); }
  }, 260);
});

document.getElementById("closeDrawer").onclick = () => drawer.classList.remove("open");
document.getElementById("fitButton").onclick = fitMap;
document.getElementById("resetButton").onclick = () => {
  nodeMap.clear(); edgeMap.clear(); nodesLayer.innerHTML = ""; edgesLayer.innerHTML = ""; drawer.classList.remove("open"); updateStats(); loadMovie(603, true).catch(showError);
};
document.getElementById("randomButton").onclick = async () => {
  try { const movie = await getJson(`${API}?random=1`); if (movie) loadMovie(movie.id, true); }
  catch (error) { showError(error); }
};

svg.addEventListener("wheel", event => {
  event.preventDefault();
  const rect = svg.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;
  const oldScale = scale;
  scale = Math.min(2.4, Math.max(.25, scale * (event.deltaY < 0 ? 1.12 : .89)));
  panX = mx - ((mx - panX) / oldScale) * scale;
  panY = my - ((my - panY) / oldScale) * scale;
  setTransform();
}, { passive: false });
svg.addEventListener("pointerdown", event => { dragging = true; dragStart = { x: event.clientX - panX, y: event.clientY - panY }; svg.setPointerCapture(event.pointerId); });
svg.addEventListener("pointermove", event => { if (!dragging) return; panX = event.clientX - dragStart.x; panY = event.clientY - dragStart.y; setTransform(); });
svg.addEventListener("pointerup", () => { dragging = false; });

window.addEventListener("resize", fitMap);
updateStats();
loadMovie(603, true).catch(showError);