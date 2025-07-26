// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyBpjHeCWkzMYDU-F3vKyeGL6BWR-VTptu0",
  authDomain: "moodmatch-c44c3.firebaseapp.com",
  projectId: "moodmatch-c44c3",
  storageBucket: "moodmatch-c44c3.firebasestorage.app",
  messagingSenderId: "452869601500",
  appId: "1:452869601500:web:918923d855fb04f4d95c19"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;

// --- Auth Buttons ---
const loginBtn = document.getElementById("loginButton");
const logoutBtn = document.getElementById("logoutButton");

if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => console.error("Login error:", err));
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => auth.signOut());
}

// --- Update UI on Login State ---
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    loginBtn?.classList.add("hidden");
    logoutBtn?.classList.remove("hidden");
    console.log(`Logged in as ${user.displayName || user.email}`);
    loadWatchlist(); // Only loads on watchlist page
  } else {
    loginBtn?.classList.remove("hidden");
    logoutBtn?.classList.add("hidden");
  }
});

// --- Firestore Watchlist Functions ---
async function saveToWatchlist(item) {
  if (!currentUser) {
    alert("Please log in to save to your watchlist.");
    return;
  }

  const ref = db.collection("watchlists").doc(currentUser.uid);
  const doc = await ref.get();
  const list = doc.exists ? doc.data().items || [] : [];

  // Avoid duplicates
  if (!list.find(x => x.title === item.title)) {
    list.push({
      title: item.title,
      type: item.type,
      image: item.image || "",
      desc: item.desc || ""
    });
  }

  await ref.set({ items: list });
  alert("Saved to your watchlist!");
  setTimeout(() => loadWatchlist(), 500); // Refresh after save
}

async function loadWatchlist() {
  const container = document.getElementById("watchlistContainer");
  if (!container || !currentUser) return;

  const ref = db.collection("watchlists").doc(currentUser.uid);
  const doc = await ref.get();
  const list = doc.exists ? doc.data().items || [] : [];

  container.innerHTML = "";
  if (!list.length) {
    container.innerHTML = "<p class='p-4 text-gray-500'>No saved titles.</p>";
    return;
  }

  list.forEach(item => renderCard(item, container, true));
}

async function removeFromWatchlist(title) {
  if (!currentUser) return;

  const ref = db.collection("watchlists").doc(currentUser.uid);
  const doc = await ref.get();
  if (!doc.exists) return;

  const list = doc.data().items.filter(x => x.title !== title);
  await ref.set({ items: list });
  loadWatchlist();
}

// --- Recommendation Logic (Movies, TV, Books) ---
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
  } catch (e) {
    console.error(e);
  }
}

// --- Tag Cloud ---
async function buildTagCloud(item) {
  tagContainer.innerHTML = "<p class='text-gray-500'>Loading tags...</p>";
  dynamicTags = [];

  try {
    if (item.type === "movie" || item.type === "tv") {
      const kwRes = await fetch(`https://api.themoviedb.org/3/${item.type}/${item.id}/keywords?api_key=${TMDB_API_KEY}`);
      const kwData = await kwRes.json();
      const keywords = (kwData.keywords || kwData.results || []).map(k => k.name);

      const revRes = await fetch(`https://api.themoviedb.org/3/${item.type}/${item.id}/reviews?api_key=${TMDB_API_KEY}`);
      const revData = await revRes.json();
      const reviewText = (revData.results || []).map(r => r.content).join(" ");

      const words = [...keywords, ...reviewText.split(/\s+/)];
      const filtered = words.filter(w => w.length > 4 && w.length < 15 && !/^(the|this|that|with|there|about|their|which)$/i.test(w));
      const counts = {};
      filtered.forEach(w => counts[w.toLowerCase()] = (counts[w.toLowerCase()] || 0) + 1);
      dynamicTags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20).map(e => e[0]);
    } else {
      const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes/${item.id}`);
      const gbData = await gbRes.json();
      const description = gbData.volumeInfo?.description || "";
      const categories = gbData.volumeInfo?.categories || [];
      const words = [...categories, ...description.split(/\s+/)];
      const filtered = words.filter(w => w.length > 4 && w.length < 15);
      const counts = {};
      filtered.forEach(w => counts[w.toLowerCase()] = (counts[w.toLowerCase()] || 0) + 1);
      dynamicTags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20).map(e => e[0]);
    }

    renderTagCloud();
  } catch (e) {
    console.error(e);
    tagContainer.innerHTML = "<p class='text-gray-500'>No tags available.</p>";
  }
}

function renderTagCloud() {
  tagContainer.innerHTML = "";
  selectedTags = [];
  dynamicTags.forEach(tag => {
    const span = document.createElement("span");
    span.textContent = tag;
    span.className = "px-4 py-2 m-1 bg-[#f3e7e8] rounded-full cursor-pointer hover:bg-[#994d51] hover:text-white transition";
    span.onclick = () => {
      if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t => t !== tag);
        span.classList.remove("bg-[#994d51]", "text-white");
      } else if (selectedTags.length < 5) {
        selectedTags.push(tag);
        span.classList.add("bg-[#994d51]", "text-white");
      }
    };
    tagContainer.appendChild(span);
  });
}

// --- Get Recommendations ---
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

    const sortedMovies = movieDetails.filter(Boolean).sort((a,b) => b.popularity - a.popularity).slice(0,6);
    const sortedTV = tvDetails.filter(Boolean).sort((a,b) => b.popularity - a.popularity).slice(0,6);
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

// --- Fetch Details ---
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

// --- Render Cards ---
function renderCard(item, container, isWatchlist = false) {
  const card = document.createElement("div");
  card.className = "p-4 border rounded-lg bg-white max-w-[220px]";
  card.innerHTML = `
    <img src="${item.image || ''}" class="rounded mb-2">
    <h3 class="font-bold">${item.title || 'Untitled'} <span class="text-xs text-gray-500">(${item.type || ''})</span></h3>
    <p class="text-xs text-gray-600">${item.desc?.slice(0, 100) || "No description"}...</p>
    ${isWatchlist 
      ? `<button class="mt-2 px-3 py-1 bg-[#e92932] text-white rounded-full text-sm removeBtn">Remove</button>`
      : `<button class="mt-2 px-3 py-1 bg-[#f3e7e8] rounded-full text-sm addWatch">Save</button>`}
  `;
  container.appendChild(card);

  if (isWatchlist) {
    card.querySelector(".removeBtn").onclick = () => removeFromWatchlist(item.title);
  } else {
    card.querySelector(".addWatch").onclick = () => saveToWatchlist(item);
  }
}
