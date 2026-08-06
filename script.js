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
let selectedSeed = null;

const API_BASE = "https://moodmatch-api-ko99.vercel.app";
const TMDB_KEY = "c5bb9a766bdc90fcc8f7293f6cd9c26a";

const loginBtn = document.getElementById("loginButton");
const logoutBtn = document.getElementById("logoutButton");
if (loginBtn) loginBtn.onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
if (logoutBtn) logoutBtn.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
  currentUser = user;
  const authSection = document.getElementById("authSection");
  if (!authSection) return;
  authSection.querySelectorAll("span").forEach(el => el.remove());
  loginBtn?.classList.toggle("hidden", Boolean(user));
  logoutBtn?.classList.toggle("hidden", !user);
  if (user) {
    const greeting = document.createElement("span");
    greeting.className = "hidden text-sm text-slate-400 md:inline";
    greeting.textContent = `Hi, ${user.displayName || "User"}`;
    authSection.appendChild(greeting);
  }
});

const moodText = document.getElementById("moodText");
document.querySelectorAll(".mood-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".mood-chip").forEach(item => item.classList.remove("active"));
    chip.classList.add("active");
    if (moodText) {
      moodText.value = chip.dataset.prompt || chip.textContent.trim();
      moodText.focus();
    }
  });
});

function showSpinner() { document.getElementById("loadingSpinner")?.classList.remove("hidden"); }
function hideSpinner() { document.getElementById("loadingSpinner")?.classList.add("hidden"); }
function showError(message) {
  const error = document.getElementById("formError");
  if (!error) return;
  error.textContent = message;
  error.classList.remove("hidden");
}
function clearError() {
  const error = document.getElementById("formError");
  if (!error) return;
  error.textContent = "";
  error.classList.add("hidden");
}

async function fetchSearchResults(query) {
  const [moviesRes, tvRes, booksRes] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`).then(r => r.json()),
    fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`).then(r => r.json()),
    fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`).then(r => r.json())
  ]);
  return [
    ...(moviesRes.results || []).slice(0, 5).map(item => ({ id: item.id, title: item.title, type: "movie", image: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : "" })),
    ...(tvRes.results || []).slice(0, 5).map(item => ({ id: item.id, title: item.name, type: "tv", image: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : "" })),
    ...(booksRes.items || []).slice(0, 5).map(item => ({ id: item.id, title: item.volumeInfo?.title, type: "book", image: item.volumeInfo?.imageLinks?.thumbnail || "" }))
  ];
}

const referenceInput = document.getElementById("referenceSearch");
const referenceResults = document.getElementById("referenceResults");
const selectedReference = document.getElementById("selectedReference");
const selectedRefImage = document.getElementById("selectedRefImage");
const selectedRefTitle = document.getElementById("selectedRefTitle");
let searchTimer;

referenceInput?.addEventListener("input", event => {
  clearTimeout(searchTimer);
  const query = event.target.value.trim();
  if (!query) {
    selectedSeed = null;
    referenceResults.innerHTML = "";
    referenceResults.classList.add("hidden");
    selectedReference?.classList.add("hidden");
    return;
  }
  searchTimer = setTimeout(async () => {
    try { renderSearchResults(await fetchSearchResults(query)); }
    catch (error) { console.error("Reference search failed", error); }
  }, 300);
});

function renderSearchResults(results) {
  if (!referenceResults) return;
  referenceResults.innerHTML = "";
  if (!results.length) return referenceResults.classList.add("hidden");
  results.forEach(item => {
    const li = document.createElement("li");
    li.className = "flex items-center gap-3 rounded-lg p-2.5 text-slate-200 transition hover:bg-white/[0.07] cursor-pointer";
    li.innerHTML = `<img src="${item.image || ""}" alt="" class="h-14 w-10 rounded-md object-cover bg-slate-800"><span class="text-sm font-medium">${item.title} <span class="text-slate-500">(${item.type})</span></span>`;
    li.onclick = () => {
      selectedSeed = item;
      if (selectedRefImage) selectedRefImage.src = item.image || "";
      if (selectedRefTitle) selectedRefTitle.textContent = item.title;
      selectedReference?.classList.remove("hidden");
      selectedReference?.classList.add("flex");
      referenceResults.classList.add("hidden");
      referenceInput.value = item.title;
    };
    referenceResults.appendChild(li);
  });
  referenceResults.classList.remove("hidden");
}

const recommendBtn = document.getElementById("recommendButton");
recommendBtn?.addEventListener("click", requestRecommendations);

async function requestRecommendations() {
  const mood = moodText?.value.trim();
  if (!mood) {
    showError("Choose a mood or describe what you want first.");
    moodText?.focus();
    return;
  }
  clearError();
  recommendBtn.disabled = true;
  recommendBtn.classList.add("opacity-60", "cursor-not-allowed");
  showSpinner();
  const params = new URLSearchParams({
    mood,
    criteria: document.getElementById("criteriaSelect")?.value || "popular",
    refId: selectedSeed?.id || "",
    refType: selectedSeed?.type || ""
  });
  try {
    const response = await fetch(`${API_BASE}/api/mood?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.details || data.error || "Recommendation request failed");
    renderResults(data);
    document.getElementById("resultsSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("Recommendation fetch failed", error);
    showError(error.message || "Failed to load recommendations. Please try again.");
  } finally {
    hideSpinner();
    recommendBtn.disabled = false;
    recommendBtn.classList.remove("opacity-60", "cursor-not-allowed");
  }
}

function renderResults(data) {
  const planTitle = document.getElementById("planTitle");
  if (planTitle) planTitle.textContent = data.planTitle || "Your Personalized Entertainment Plan";
  renderList("movieList", data.movies || []);
  renderList("tvList", data.tv || []);
  renderList("bookList", data.books || []);
  const spotify = document.getElementById("spotifyList");
  if (spotify) {
    spotify.innerHTML = data.spotify
      ? `<iframe src="${data.spotify}" width="100%" height="352" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" class="rounded-2xl"></iframe>`
      : `<p class="p-5 text-sm text-slate-500">No playlist was available for this mood.</p>`;
  }
}

function renderList(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<p class="col-span-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-500">No recommendations available.</p>`;
    return;
  }
  items.slice(0, 6).forEach(item => {
    const card = document.createElement("article");
    card.className = "group relative flex min-h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/70 shadow-[0_18px_45px_rgba(0,0,0,.22)] transition duration-300 hover:-translate-y-1.5 hover:border-violet-400/30 hover:shadow-[0_22px_60px_rgba(76,29,149,.22)]";

    const media = document.createElement("div");
    media.className = "relative overflow-hidden bg-slate-800 aspect-[2/3]";
    const image = document.createElement("img");
    image.src = item.image || "";
    image.alt = item.title || "Recommendation";
    image.loading = "lazy";
    image.className = "h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]";
    if (!item.image) image.style.display = "none";
    media.appendChild(image);
    if (!item.image) {
      const fallback = document.createElement("div");
      fallback.className = "flex h-full items-center justify-center bg-gradient-to-br from-slate-800 to-violet-950 p-4 text-center text-sm font-bold text-slate-400";
      fallback.textContent = item.title;
      media.appendChild(fallback);
    }
    if (typeof item.score === "number") {
      const score = document.createElement("span");
      score.className = "absolute right-2 top-2 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[10px] font-bold text-violet-200 backdrop-blur";
      score.textContent = `${Math.round(item.score * 100)}% match`;
      media.appendChild(score);
    }
    card.appendChild(media);

    const body = document.createElement("div");
    body.className = "flex flex-1 flex-col p-4";
    const title = document.createElement("h4");
    title.className = "text-sm font-bold leading-snug text-white";
    title.textContent = item.title;
    body.appendChild(title);
    if (item.reason) {
      const reason = document.createElement("p");
      reason.className = "mt-2 text-xs leading-5 text-slate-400";
      reason.textContent = item.reason;
      body.appendChild(reason);
    }
    const save = document.createElement("button");
    save.className = "mt-auto pt-4 text-left text-xs font-bold text-violet-300 transition hover:text-violet-200";
    save.textContent = "+ Save to Watchlist";
    save.onclick = () => saveToWatchlist(item);
    body.appendChild(save);
    card.appendChild(body);
    container.appendChild(card);
  });
}

async function saveToWatchlist(item) {
  if (!currentUser) return alert("Login to save items");
  const collection = db.collection("users").doc(currentUser.uid).collection("watchlist");
  const existing = await collection.where("id", "==", item.id || item.title).get();
  if (!existing.empty) return alert("Already saved");
  await collection.add(item);
  alert(`${item.title} saved!`);
}

async function loadWatchlist(user) {
  currentUser = user || currentUser;
  const container = document.getElementById("watchlistContainer");
  if (!container) return;
  if (!currentUser) {
    container.innerHTML = "<p class='text-sm text-slate-400'>Login to view your watchlist.</p>";
    return;
  }
  container.innerHTML = "Loading...";
  const snapshot = await db.collection("users").doc(currentUser.uid).collection("watchlist").get();
  container.innerHTML = "";
  snapshot.forEach(doc => {
    const item = doc.data();
    const card = document.createElement("div");
    card.className = "w-40 text-center flex flex-col";
    card.innerHTML = `<img src="${item.image || ""}" class="rounded-lg w-full mb-2"><p>${item.title || ""}</p>`;
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.className = "mt-1 rounded bg-slate-700 px-2 py-1 text-white";
    remove.onclick = async () => {
      await db.collection("users").doc(currentUser.uid).collection("watchlist").doc(doc.id).delete();
      card.remove();
    };
    card.appendChild(remove);
    container.appendChild(card);
  });
}

if (document.getElementById("watchlistContainer")) auth.onAuthStateChanged(user => loadWatchlist(user));
