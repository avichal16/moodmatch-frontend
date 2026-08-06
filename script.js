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
    greeting.className = "hidden md:inline text-sm";
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

function showSpinner() {
  document.getElementById("loadingSpinner")?.classList.remove("hidden");
}

function hideSpinner() {
  document.getElementById("loadingSpinner")?.classList.add("hidden");
}

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
    try {
      const results = await fetchSearchResults(query);
      renderSearchResults(results);
    } catch (error) {
      console.error("Reference search failed", error);
    }
  }, 300);
});

function renderSearchResults(results) {
  if (!referenceResults) return;
  referenceResults.innerHTML = "";
  if (!results.length) {
    referenceResults.classList.add("hidden");
    return;
  }

  results.forEach(item => {
    const li = document.createElement("li");
    li.className = "flex items-center gap-3 p-2 cursor-pointer hover:bg-[#fcf1f2]";
    li.innerHTML = `<img src="${item.image || ""}" alt="" class="w-10 h-14 rounded object-cover bg-gray-100"><span class="text-sm">${item.title} <span class="text-gray-500">(${item.type})</span></span>`;
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
recommendBtn?.addEventListener("click", async () => {
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
});

function renderResults(data) {
  renderList("movieList", data.movies || []);
  renderList("tvList", data.tv || []);
  renderList("bookList", data.books || []);
  const spotify = document.getElementById("spotifyList");
  if (spotify) {
    spotify.innerHTML = data.spotify
      ? `<iframe src="${data.spotify}" width="100%" height="352" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" class="rounded-xl"></iframe>`
      : `<p class="text-sm text-gray-500">No playlist was available for this mood.</p>`;
  }
}

function renderList(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<p class="col-span-full text-sm text-gray-500">No recommendations available.</p>`;
    return;
  }

  items.slice(0, 6).forEach(item => {
    const card = document.createElement("article");
    card.className = "bg-white rounded-2xl overflow-hidden border border-[#f0e2e3] shadow-sm flex flex-col";

    const image = document.createElement("img");
    image.src = item.image || "";
    image.alt = item.title || "Recommendation";
    image.className = "w-full aspect-[2/3] object-cover bg-[#f3e7e8]";
    card.appendChild(image);

    const body = document.createElement("div");
    body.className = "p-3 flex flex-col flex-1";

    const title = document.createElement("h4");
    title.className = "font-bold text-sm leading-snug";
    title.textContent = item.title;
    body.appendChild(title);

    if (item.reason) {
      const reason = document.createElement("p");
      reason.className = "text-xs text-[#765557] mt-2";
      reason.textContent = item.reason;
      body.appendChild(reason);
    }

    const save = document.createElement("button");
    save.className = "mt-auto pt-3 text-sm font-bold text-[#e92932] text-left";
    save.textContent = "+ Save";
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
    container.innerHTML = "<p class='text-sm'>Login to view your watchlist.</p>";
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
    remove.className = "bg-gray-200 text-black px-2 py-1 rounded mt-1";
    remove.onclick = async () => {
      await db.collection("users").doc(currentUser.uid).collection("watchlist").doc(doc.id).delete();
      card.remove();
    };
    card.appendChild(remove);
    container.appendChild(card);
  });
}

if (document.getElementById("watchlistContainer")) {
  auth.onAuthStateChanged(user => loadWatchlist(user));
}
