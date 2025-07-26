const API_URL = "https://moodmatch-api-4vdp.vercel.app/api/mood"; // Replace with your actual Vercel API URL
const TMDB_API_KEY = "c5bb9a766bdc90fcc8f7293f6cd9c26a";

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const selectedList = document.getElementById("selectedList");
const tagContainer = document.getElementById("tagOptions");
const moodText = document.getElementById("moodText");
const movieList = document.getElementById("movieList");
const tvList = document.getElementById("tvList");
const bookList = document.getElementById("bookList");
const watchlistContainer = document.getElementById("watchlistContainer");

let selectedTitle = null;
let dynamicTags = [];
let selectedTags = [];

// --- Search Suggestions ---
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    if (query.length > 2) searchAll(query);
    else searchResults.innerHTML = "";
  });
}

async function searchAll(query) {
  searchResults.innerHTML = "<li class='p-2 text-gray-500'>Searching...</li>";
  try {
    const tmdbRes = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
    const tmdbData = await tmdbRes.json();
    const tmdbResults = (tmdbData.results || []).slice(0, 5).map(i => ({
      id: i.id,
      title: i.title || i.name,
      type: i.media_type,
      image: i.poster_path ? `https://image.tmdb.org/t/p/w92${i.poster_path}` : ""
    }));

    const bookRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`);
    const bookData = await bookRes.json();
    const bookResults = (bookData.items || []).map(b => ({
      id: b.id,
      title: b.volumeInfo.title,
      type: "book",
      image: b.volumeInfo.imageLinks?.thumbnail || ""
    }));

    const results = [...tmdbResults, ...bookResults];
    searchResults.innerHTML = "";
    results.forEach(item => {
      const li = document.createElement("li");
      li.className = "flex items-center gap-3 p-2 hover:bg-gray-100 cursor-pointer";
      li.innerHTML = `<img src="${item.image}" class="w-8 h-12 object-cover rounded"><span>${item.title} <span class="text-xs text-gray-500">(${item.type})</span></span>`;
      li.onclick = () => {
        selectedTitle = item;
        selectedList.innerHTML = `<div class="px-3 py-1 bg-[#f3e7e8] rounded-full text-sm">${item.title}</div>`;
        searchResults.innerHTML = "";
        searchInput.value = "";
        buildTagCloud(item);
      };
      searchResults.appendChild(li);
    });
  } catch (e) { console.error(e); }
}

// --- Build Tag Cloud with D3 ---
async function buildTagCloud(item) {
  tagContainer.innerHTML = "";
  dynamicTags = [];
  selectedTags = [];

  try {
    if (item.type === "movie" || item.type === "tv") {
      const kwRes = await fetch(`https://api.themoviedb.org/3/${item.type}/${item.id}/keywords?api_key=${TMDB_API_KEY}`);
      const kwData = await kwRes.json();
      const keywords = (kwData.keywords || kwData.results || []).map(k => k.name);

      const revRes = await fetch(`https://api.themoviedb.org/3/${item.type}/${item.id}/reviews?api_key=${TMDB_API_KEY}`);
      const revData = await revRes.json();
      const reviewText = (revData.results || []).map(r => r.content).join(" ");

      const words = [...keywords, ...reviewText.split(/\s+/)];
      const filtered = words.filter(w => w.length > 4 && w.length < 15);
      const counts = {};
      filtered.forEach(w => counts[w.toLowerCase()] = (counts[w.toLowerCase()] || 0) + 1);
      dynamicTags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word, freq]) => ({ word, freq }));
    } else {
      const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes/${item.id}`);
      const gbData = await gbRes.json();
      const description = gbData.volumeInfo?.description || "";
      const categories = gbData.volumeInfo?.categories || [];
      const words = [...categories, ...description.split(/\s+/)];
      const counts = {};
      words.forEach(w => counts[w.toLowerCase()] = (counts[w.toLowerCase()] || 0) + 1);
      dynamicTags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word, freq]) => ({ word, freq }));
    }

    renderTagCloudD3();
  } catch (e) {
    console.error(e);
    tagContainer.innerHTML = "<p class='text-gray-500'>No tags available.</p>";
  }
}

function renderTagCloudD3() {
  tagContainer.innerHTML = "";
  const width = tagContainer.clientWidth, height = tagContainer.clientHeight;

  const svg = d3.select(tagContainer).append("svg")
    .attr("width", width)
    .attr("height", height);

  const simulation = d3.forceSimulation(dynamicTags)
    .force("charge", d3.forceManyBody().strength(-50))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(d => d.freq * 3 + 20))
    .on("tick", ticked);

  const nodes = svg.selectAll("g")
    .data(dynamicTags)
    .enter().append("g")
    .attr("class", "tag-node")
    .attr("cursor", "pointer")
    .on("click", function (event, d) {
      if (selectedTags.includes(d.word)) {
        selectedTags = selectedTags.filter(t => t !== d.word);
        d3.select(this).select("circle").attr("fill", "#f3e7e8");
      } else if (selectedTags.length < 5) {
        selectedTags.push(d.word);
        d3.select(this).select("circle").attr("fill", "#e92932");
      }
    });

  nodes.append("circle")
    .attr("r", d => d.freq * 2 + 20)
    .attr("fill", "#f3e7e8")
    .attr("stroke", "#994d51")
    .attr("stroke-width", 1.5);

  nodes.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", ".35em")
    .style("pointer-events", "none")
    .style("font-size", d => `${10 + d.freq}px`)
    .style("fill", "#1b0e0e")
    .text(d => d.word);

  function ticked() {
    nodes.attr("transform", d => `translate(${d.x},${d.y})`);
  }
}

// --- Recommendations ---
const recommendBtn = document.getElementById("recommendButton");
if (recommendBtn) recommendBtn.onclick = () => loadRecommendations();

async function loadRecommendations() {
  movieList.innerHTML = "<p class='p-4 text-gray-500'>Loading recommendations...</p>";
  tvList.innerHTML = "";
  bookList.innerHTML = "";

  const tagsForAI = selectedTags.join(", ");
  const moodInput = moodText.value.trim();

  try {
    const res = await fetch(`${API_URL}?moodText=${encodeURIComponent(moodInput)}&tags=${encodeURIComponent(tagsForAI)}`);
    const data = await res.json();

    const movieDetails = await Promise.all(data.movies.map(t => fetchTMDBDetails(t, "movie")));
    const tvDetails = await Promise.all(data.tv.map(t => fetchTMDBDetails(t, "tv")));
    const bookDetails = await Promise.all(data.books.map(t => fetchBookDetails(t)));

    const sortedMovies = movieDetails.filter(Boolean).sort((a,b)=>b.popularity-a.popularity).slice(0,6);
    const sortedTV = tvDetails.filter(Boolean).sort((a,b)=>b.popularity-a.popularity).slice(0,6);
    const finalBooks = bookDetails.filter(Boolean).slice(0,6);

    movieList.innerHTML = "";
    sortedMovies.forEach(m => renderCard(m, movieList));

    tvList.innerHTML = "";
    sortedTV.forEach(tv => renderCard(tv, tvList));

    bookList.innerHTML = "";
    finalBooks.forEach(b => renderCard(b, bookList));

  } catch (e) {
    console.error(e);
    movieList.innerHTML = "<p class='p-4 text-gray-500'>Could not load recommendations.</p>";
  }
}

// --- Helper Functions ---
async function fetchTMDBDetails(title, type) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`);
    const data = await res.json();
    const item = data.results?.[0];
    if (!item) return null;
    return {
      id: item.id,
      title: type === "movie" ? item.title : item.name,
      image: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : "",
      desc: item.overview || "",
      popularity: item.popularity || 0,
      type
    };
  } catch { return null; }
}

async function fetchBookDetails(title) {
  try {
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(title)}&maxResults=1`);
    const data = await res.json();
    const book = data.items?.[0];
    if (!book) return null;
    return {
      id: book.id,
      title: book.volumeInfo.title,
      image: book.volumeInfo.imageLinks?.thumbnail || "",
      desc: book.volumeInfo.description || "",
      type: "book"
    };
  } catch { return null; }
}

function renderCard(item, container) {
  const card = document.createElement("div");
  card.className = "p-4 border rounded-lg bg-white max-w-[220px]";
  card.innerHTML = `
    <img src="${item.image}" class="rounded mb-2">
    <h3 class="font-bold">${item.title} <span class="text-xs text-gray-500">(${item.type})</span></h3>
    <p class="text-xs text-gray-600">${item.desc?.slice(0, 100) || "No description"}...</p>
    <button class="mt-2 px-3 py-1 bg-[#f3e7e8] rounded-full text-sm addWatch">Save</button>`;
  container.appendChild(card);
  card.querySelector(".addWatch").onclick = () => {
    const list = JSON.parse(localStorage.getItem("watchlist") || "[]");
    list.push(item);
    localStorage.setItem("watchlist", JSON.stringify(list));
    alert("Saved to Watchlist!");
  };
}

// Watchlist Page
if (watchlistContainer) {
  const items = JSON.parse(localStorage.getItem("watchlist") || "[]");
  if (!items.length) watchlistContainer.innerHTML = "<p class='p-4 text-gray-500'>No saved titles.</p>";
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "p-4 border rounded-lg bg-white max-w-[200px]";
    card.innerHTML = `
      <img src="${item.image}" class="rounded mb-2">
      <h3 class="font-bold">${item.title} <span class="text-xs text-gray-500">(${item.type})</span></h3>
      <button class="mt-2 px-3 py-1 bg-[#e92932] text-white rounded-full text-sm removeBtn">Remove</button>`;
    card.querySelector(".removeBtn").onclick = () => {
      const list = JSON.parse(localStorage.getItem("watchlist") || "[]").filter(x => x.title !== item.title);
      localStorage.setItem("watchlist", JSON.stringify(list));
      card.remove();
    };
    watchlistContainer.appendChild(card);
  });
}


