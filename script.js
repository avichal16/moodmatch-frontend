// Final script.js with frontend-only search, spinner, emoji highlight, GPT recommendations, pagination, Firebase, and watchlist

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
const API_BASE = "https://moodmatch-api-ko99.vercel.app";
const TMDB_KEY = "c5bb9a766bdc90fcc8f7293f6cd9c26a"; // Add your TMDB API key here
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";

// Auth
const loginBtn = document.getElementById("loginButton");
const logoutBtn = document.getElementById("logoutButton");
if (loginBtn) loginBtn.onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
if (logoutBtn) logoutBtn.onclick = () => auth.signOut();
auth.onAuthStateChanged(user => {
  currentUser = user;
  const authSection = document.getElementById("authSection");
  authSection.querySelectorAll("span").forEach(e => e.remove());
  if (user) {
    loginBtn?.classList.add("hidden");
    logoutBtn?.classList.remove("hidden");
    const greeting = document.createElement("span");
    greeting.textContent = `Hi, ${user.displayName || 'User'}`;
    authSection.appendChild(greeting);
  } else {
    loginBtn?.classList.remove("hidden");
    logoutBtn?.classList.add("hidden");
  }
});
async function fetchSearchResultsFrontend(query) {
  try {
    const movieReq = fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`).then(r=>r.json());
    const tvReq = fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`).then(r=>r.json());
    const bookReq = fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`).then(r=>r.json());

    const [moviesRes, tvRes, booksRes] = await Promise.all([movieReq, tvReq, bookReq]);
    const movies = (moviesRes.results || []).map(m => ({ id: m.id, title: m.title, type: "movie", image: m.poster_path ? `https://image.tmdb.org/t/p/w200${m.poster_path}` : "" }));
    const tv = (tvRes.results || []).map(t => ({ id: t.id, title: t.name, type: "tv", image: t.poster_path ? `https://image.tmdb.org/t/p/w200${t.poster_path}` : "" }));
    const books = (booksRes.items || []).map(b => ({ id: b.id, title: b.volumeInfo?.title, type: "book", image: b.volumeInfo?.imageLinks?.thumbnail || "" }));
    return [...movies.slice(0,5), ...tv.slice(0,5), ...books.slice(0,5)];
  } catch (e) {
    console.error("Frontend search failed", e);
    return [];
  }
}

// Spinner controls
function showSpinner() { document.getElementById("loadingSpinner").classList.remove("hidden"); }
function hideSpinner() { document.getElementById("loadingSpinner").classList.add("hidden"); }

// Emoji highlight
const emojiButtons = document.querySelectorAll('.emoji-btn');
emojiButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    if (btn.classList.contains('active')) {
      btn.classList.add('bg-[#f3e7e8]', 'rounded-full');
    } else {
      btn.classList.remove('bg-[#f3e7e8]', 'rounded-full');
    }
  });
});

// Reference search with spinner
const referenceInput = document.getElementById("referenceSearch");
const referenceResults = document.getElementById("referenceResults");
const selectedReference = document.getElementById("selectedReference");
const selectedRefImage = document.getElementById("selectedRefImage");
const selectedRefTitle = document.getElementById("selectedRefTitle");
let selectedSeed = null;

if (referenceInput) {
  referenceInput.addEventListener("input", async (e) => {
    const query = e.target.value.trim();
    if (!query) {
      referenceResults.innerHTML = "";
      referenceResults.classList.add("hidden");
      return;
    }
    console.log("Searching references for:", query);
    showSpinner();
    const results = await fetchSearchResultsFrontend(query);
    hideSpinner();
    renderSearchResults(results);
  });
} else {
  console.log("[debug] referenceSearch element not found - skipping search setup");
}

function renderSearchResults(results) {
  referenceResults.innerHTML = "";
  results.forEach(item => {
    const li = document.createElement("li");
    li.className = "flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-100";
    li.innerHTML = `<img src="${item.image || ''}" class="w-10 h-14 rounded object-cover" /><span>${item.title} (${item.type})</span>`;
    li.onclick = () => {
      selectedSeed = item;
      selectedRefImage.src = item.image;
      selectedRefTitle.textContent = item.title;
      selectedReference.classList.remove("hidden");
      referenceResults.classList.add("hidden");
      referenceInput.value = item.title;
    };
    referenceResults.appendChild(li);
  });
  referenceResults.classList.remove("hidden");
}

// Fetch recommendations with spinner
const recommendBtn = document.getElementById("recommendButton");
if (recommendBtn) {
  recommendBtn.addEventListener("click", async () => {
  const criteria = document.getElementById("criteriaSelect").value;
  const emojis = [...document.querySelectorAll('.emoji-btn.active')].map(e => e.textContent).join(',');
  const context = `${document.getElementById("toggleFriends").checked ? 'with friends' : (document.getElementById("toggleAlone").checked ? 'alone' : '')}, ${document.getElementById("toggleLong").checked ? 'long session' : (document.getElementById("toggleShort").checked ? 'short session' : '')}`;
  const moodData = { mood: `Energy: ${document.getElementById("energySlider").value}, Positivity: ${document.getElementById("positivitySlider").value}, Emojis: ${emojis}, Context: ${context}, Prompt: ${document.getElementById("moodText").value}`, criteria, refId: selectedSeed?.id || "", refType: selectedSeed?.type || "" };
  try {
    showSpinner();
    const res = await fetch(`${API_BASE}/api/mood?${new URLSearchParams(moodData)}`);
    const data = await res.json();
    hideSpinner();
    renderResults(data);
  } catch (e) {
    hideSpinner();
    console.error("Recommendation fetch failed", e);
    document.getElementById("movieList").innerHTML = `<p class='text-red-500'>Failed to load recommendations</p>`;
  }
  });
} else {
  console.log("[debug] recommendButton not found - skipping recommendation setup");
}

// Render results with pagination and watchlist
function renderResults(data) {
  renderList("movieList", data.movies);
  renderList("tvList", data.tv);
  renderList("bookList", data.books);
  const spotify = document.getElementById("spotifyList");
  spotify.innerHTML = data.spotify ? `<iframe src="${data.spotify}" width="300" height="380"></iframe>` : "";
}

function renderList(containerId, items, page=1, perPage=6) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  const start = (page-1)*perPage;
  const pageItems = items.slice(start,start+perPage);
  pageItems.forEach(item => {
    const div = document.createElement("div");
    div.className = "w-40 text-center flex flex-col";

    const img = document.createElement("img");
    img.src = item.image;
    img.className = "rounded-lg w-full mb-2";
    div.appendChild(img);

    const title = document.createElement("p");
    title.textContent = item.title;
    div.appendChild(title);

    const desc = item.description || item.desc || "";
    let descP;
    if (desc) {
      descP = document.createElement("p");
      descP.className = "text-sm mt-1 desc clamp";
      descP.textContent = desc;
      div.appendChild(descP);

      const moreBtn = document.createElement("button");
      moreBtn.textContent = "See More";
      moreBtn.className = "text-xs text-blue-500 mt-1";
      moreBtn.onclick = () => {
        descP.classList.toggle("clamp");
        moreBtn.textContent = descP.classList.contains("clamp") ? "See More" : "See Less";
      };
      div.appendChild(moreBtn);
    }

    if (item.reason) {
      const reason = document.createElement("p");
      reason.className = "text-xs mt-1 text-gray-600";
      reason.textContent = `Reason: ${item.reason}`;
      div.appendChild(reason);
    }

    const save = document.createElement("button");
    save.textContent = "Save";
    save.className = "save-btn bg-red-500 text-white px-2 py-1 rounded mt-1";
    save.onclick = () => saveToWatchlist(item);
    div.appendChild(save);

    container.appendChild(div);
  });
  if (items.length > perPage) {
    const nav = document.createElement("div");
    nav.className = "flex gap-2 justify-center mt-2";
    for (let i=1;i<=Math.ceil(items.length/perPage);i++) {
      const btn = document.createElement("button");
      btn.textContent = i;
      btn.className = `px-2 py-1 rounded ${i===page?'bg-red-500 text-white':'bg-gray-200'}`;
      btn.onclick = () => renderList(containerId, items, i, perPage);
      nav.appendChild(btn);
    }
    container.appendChild(nav);
  }
}

async function saveToWatchlist(item) {
  console.log("Attempting to save to watchlist", item);
  if (!currentUser) {
    console.log("[debug] Save failed - user not logged in");
    return alert("Login to save items");
  }
  const ref = db.collection("users").doc(currentUser.uid).collection("watchlist");
  const exists = await ref.where("id", "==", item.id || item.title).get();
  if (!exists.empty) return alert("Already saved");
  await ref.add(item);
  console.log("[debug] Saved item", item.title);
  alert(`${item.title} saved!`);
}

async function loadWatchlist(user) {
  currentUser = user || currentUser;
  const container = document.getElementById("watchlistContainer");
  if (!currentUser) {
    container.innerHTML = "<p class='text-sm'>Login to view your watchlist.</p>";
    return;
  }
  console.log("Loading watchlist for user", currentUser.uid);
  container.innerHTML = "Loading...";
  const snapshot = await db.collection("users").doc(currentUser.uid).collection("watchlist").get();
  container.innerHTML = "";
  console.log(`[debug] retrieved ${snapshot.size} items`);
  snapshot.forEach(doc => {
    const item = doc.data();
    console.log("[debug] item", item);
    const div = document.createElement("div");
    div.className = "w-40 text-center flex flex-col";

    const img = document.createElement("img");
    img.src = item.image;
    img.className = "rounded-lg w-full mb-2";
    div.appendChild(img);

    const title = document.createElement("p");
    title.textContent = item.title;
    div.appendChild(title);

    const desc = item.description || item.desc || "";
    if (desc) {
      const p = document.createElement("p");
      p.className = "text-sm mt-1 desc clamp";
      p.textContent = desc;
      div.appendChild(p);
    }

    if (item.reason) {
      const reason = document.createElement("p");
      reason.className = "text-xs mt-1 text-gray-600";
      reason.textContent = `Reason: ${item.reason}`;
      div.appendChild(reason);
    }

    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.className = "bg-gray-200 text-black px-2 py-1 rounded mt-1";
    remove.onclick = () => removeFromWatchlist(doc.id, div);
    div.appendChild(remove);

    container.appendChild(div);
  });
}
if (document.getElementById("watchlistContainer")) auth.onAuthStateChanged(user => loadWatchlist(user));

async function removeFromWatchlist(docId, element) {
  if (!currentUser) {
    return alert("Login to modify watchlist");
  }
  await db.collection("users").doc(currentUser.uid).collection("watchlist").doc(docId).delete();
  element.remove();
  alert("Removed from watchlist");
}
