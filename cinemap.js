const API = "https://moodmatch-api-ko99.vercel.app/api/cinemap";
const IMG = "https://image.tmdb.org/t/p/w500";
const nodes = new vis.DataSet([]);
const edges = new vis.DataSet([]);
const known = new Set();

const graph = new vis.Network(document.getElementById("graph"), { nodes, edges }, {
  autoResize: true,
  physics: { stabilization: { iterations: 120 }, barnesHut: { gravitationalConstant: -4200, springLength: 150, springConstant: .025 } },
  interaction: { hover: true, keyboard: true },
  nodes: { font: { color: "#e5e7eb", face: "Inter", size: 14 }, borderWidth: 2, shadow: { enabled: true, color: "rgba(0,0,0,.5)", size: 14 } },
  edges: { color: { color: "rgba(148,163,184,.32)", highlight: "#a78bfa" }, width: 1.4, smooth: { type: "dynamic" }, font: { color: "#64748b", size: 9, strokeWidth: 0 } },
  groups: {
    movie: { shape: "circularImage", size: 34, color: { border: "#8b5cf6", background: "#111827", highlight: { border: "#f0abfc", background: "#111827" } } },
    director: { shape: "dot", size: 20, color: { border: "#22d3ee", background: "#083344" } },
    genre: { shape: "diamond", size: 22, color: { border: "#f59e0b", background: "#451a03" } }
  }
});

const mid = id => `movie:${id}`;
const pid = id => `person:${id}`;
const gid = id => `genre:${id}`;

function addEdge(from, to, label) {
  const id = `${from}|${to}|${label}`;
  if (!edges.get(id)) edges.add({ id, from, to, label });
}

function addMovie(movie) {
  const id = mid(movie.id);
  if (!known.has(id)) {
    known.add(id);
    nodes.add({ id, group: "movie", label: movie.title || "Untitled", image: movie.poster_path ? `${IMG}${movie.poster_path}` : "mmlogo.png", movie });
  }
  return id;
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.details || data.error || "Request failed");
  return data;
}

async function loadMovie(id, focus = true) {
  const data = await getJson(`${API}?id=${encodeURIComponent(id)}`);
  const root = addMovie(data.movie);

  if (data.director) {
    const directorId = pid(data.director.id);
    if (!known.has(directorId)) {
      known.add(directorId);
      nodes.add({ id: directorId, group: "director", label: data.director.name });
    }
    addEdge(root, directorId, "directed by");
  }

  data.genres.slice(0, 4).forEach(genre => {
    const genreId = gid(genre.id);
    if (!known.has(genreId)) {
      known.add(genreId);
      nodes.add({ id: genreId, group: "genre", label: genre.name });
    }
    addEdge(root, genreId, "genre");
  });

  data.related.slice(0, 10).forEach((movie, index) => {
    const child = addMovie(movie);
    addEdge(root, child, index < 5 ? "related" : "similar");
  });

  showDetails(data);
  const visible = [root, ...data.related.slice(0, 7).map(movie => mid(movie.id))];
  setTimeout(() => {
    if (focus) graph.focus(root, { scale: 1.05, animation: { duration: 700 } });
    graph.fit({ nodes: visible, animation: { duration: 700 } });
  }, 200);
}

function showDetails(data) {
  const movie = data.movie;
  const year = movie.release_date?.slice(0, 4) || "—";
  const runtime = movie.runtime ? `${movie.runtime} min` : "";
  const rating = movie.vote_average ? `${movie.vote_average.toFixed(1)}/10` : "";
  document.getElementById("drawerContent").innerHTML = `
    <div class="detail-head">
      <img class="poster" src="${movie.poster_path ? `${IMG}${movie.poster_path}` : "mmlogo.png"}" alt="${movie.title}">
      <div><h2>${movie.title}</h2><div class="meta">${[year, runtime, rating].filter(Boolean).join(" · ")}</div>${data.director ? `<div class="meta" style="margin-top:6px">Directed by ${data.director.name}</div>` : ""}</div>
    </div>
    <p class="overview">${movie.overview || "No overview available."}</p>
    <div class="chips">${data.genres.map(g => `<span>${g.name}</span>`).join("")}${data.keywords.map(k => `<span>${k.name}</span>`).join("")}</div>
    <button id="expandSelected" class="expand">Expand this film on the map</button>
    <h3 style="margin-top:22px;font-size:14px">Connected films</h3>
    <div class="chips">${data.related.slice(0, 8).map(m => `<span>${m.title}</span>`).join("")}</div>`;
  document.getElementById("expandSelected").onclick = () => loadMovie(movie.id, true);
  document.getElementById("drawer").classList.add("open");
}

const input = document.getElementById("movieSearch");
const resultsBox = document.getElementById("searchResults");
let timer;
input.addEventListener("input", () => {
  clearTimeout(timer);
  const query = input.value.trim();
  if (query.length < 2) { resultsBox.style.display = "none"; return; }
  timer = setTimeout(async () => {
    try {
      const results = await getJson(`${API}?query=${encodeURIComponent(query)}`);
      resultsBox.innerHTML = results.map(movie => `<div class="result" data-id="${movie.id}"><img src="${movie.poster_path ? `${IMG}${movie.poster_path}` : "mmlogo.png"}"><div><strong>${movie.title}</strong><span>${movie.release_date?.slice(0,4) || "Unknown year"}</span></div></div>`).join("");
      resultsBox.style.display = results.length ? "block" : "none";
      resultsBox.querySelectorAll(".result").forEach(item => item.onclick = () => {
        input.value = item.querySelector("strong").textContent;
        resultsBox.style.display = "none";
        loadMovie(Number(item.dataset.id), true).catch(showError);
      });
    } catch (error) { showError(error); }
  }, 260);
});

function showError(error) {
  console.error(error);
  resultsBox.innerHTML = `<div style="padding:14px;color:#fda4af;font-size:13px">${error.message || "Something went wrong"}</div>`;
  resultsBox.style.display = "block";
}

document.getElementById("closeDrawer").onclick = () => document.getElementById("drawer").classList.remove("open");
document.getElementById("randomButton").onclick = async () => {
  try {
    const movie = await getJson(`${API}?random=1`);
    if (movie) loadMovie(movie.id, true);
  } catch (error) { showError(error); }
};

graph.on("click", params => {
  if (!params.nodes.length) return;
  const node = nodes.get(params.nodes[0]);
  if (node.group === "movie") loadMovie(node.movie.id, false).catch(showError);
});

loadMovie(603, true).catch(showError);