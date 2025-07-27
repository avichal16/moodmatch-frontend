// Firebase Setup
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

// Auth
const loginBtn = document.getElementById("loginButton");
const logoutBtn = document.getElementById("logoutButton");
if (loginBtn) loginBtn.onclick = () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
if (logoutBtn) logoutBtn.onclick = () => auth.signOut();
auth.onAuthStateChanged(user => {
  currentUser = user;
  const authSection = document.getElementById("authSection");
  if (user) {
    loginBtn?.classList.add("hidden");
    logoutBtn?.classList.remove("hidden");
    const greeting = document.createElement("span");
    greeting.textContent = `Hi, ${user.displayName || user.email}`;
    greeting.className = "text-sm text-gray-700 self-center";
    authSection.appendChild(greeting);
    loadWatchlist?.();
  } else {
    loginBtn?.classList.remove("hidden");
    logoutBtn?.classList.add("hidden");
  }
});

// Reference Title Search
const TMDB_API_KEY = "c5bb9a766bdc90fcc8f7293f6cd9c26a";
let selectedReference = null;
const refSearch = document.getElementById("referenceSearch");
const refResults = document.getElementById("referenceResults");

if (refSearch) {
  refSearch.addEventListener("input", async () => {
    const q = refSearch.value.trim();
    if (!q) {
      refResults.classList.add("hidden");
      return;
    }
    const tmdbResp = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`);
    const tmdbData = await tmdbResp.json();
    const results = tmdbData.results.filter(r => ["movie","tv"].includes(r.media_type)).slice(0,5);
    refResults.innerHTML = "";
    results.forEach(r => {
      const li = document.createElement("li");
      li.textContent = r.title || r.name;
      li.className = "p-2 hover:bg-gray-100 cursor-pointer";
      li.onclick = () => {
        selectedReference = { id: r.id, type: r.media_type, title: r.title || r.name };
        refSearch.value = r.title || r.name;
        refResults.classList.add("hidden");
      };
      refResults.appendChild(li);
    });
    refResults.classList.remove("hidden");
  });
}

// Watchlist Helpers
async function saveToWatchlist(item) {
  if (!currentUser) return alert("Log in first!");
  const ref = db.collection("watchlists").doc(currentUser.uid);
  const doc = await ref.get();
  const list = doc.exists ? doc.data().items || [] : [];
  if (!list.find(x => x.title === item.title)) list.push(item);
  await ref.set({ items: list });
  alert("Saved to Watchlist!");
}
async function loadWatchlist() {
  const container = document.getElementById("watchlistContainer");
  if (!container || !currentUser) return;
  const ref = db.collection("watchlists").doc(currentUser.uid);
  const doc = await ref.get();
  const list = doc.exists ? doc.data().items || [] : [];
  container.innerHTML = list.length ? "" : "<p class='p-4 text-gray-500'>No saved titles.</p>";
  list.forEach(item => renderCard(item, container, true));
}
async function removeFromWatchlist(title) {
  const ref = db.collection("watchlists").doc(currentUser.uid);
  const doc = await ref.get();
  if (!doc.exists) return;
  const list = doc.data().items.filter(x => x.title !== title);
  await ref.set({ items: list });
  loadWatchlist();
}

// Fetch Recommendations
const API_URL = "https://moodmatch-api-avichals-projects-c02944d8.vercel.app/api/mood";
const recommendBtn = document.getElementById("recommendButton");
if (recommendBtn) recommendBtn.onclick = () => getRecs();

async function getRecs() {
  const energy = document.getElementById("energySlider")?.value || 5;
  const positivity = document.getElementById("positivitySlider")?.value || 5;
  const emojis = Array.from(document.querySelectorAll(".emoji-btn.selected")).map(e => e.textContent).join(" ");
  const freeText = document.getElementById("moodText")?.value || "";
  const context = [
    document.getElementById("toggleAlone")?.checked ? "alone" : "",
    document.getElementById("toggleFriends")?.checked ? "with friends" : "",
    document.getElementById("toggleShort")?.checked ? "short session" : "",
    document.getElementById("toggleLong")?.checked ? "long session" : ""
  ].filter(Boolean).join(", ");
  
  const params = new URLSearchParams({
    mood: `Energy: ${energy}, Positivity: ${positivity}, Emojis: ${emojis}, Context: ${context}, Prompt: ${freeText}`,
    refId: selectedReference?.id || "",
    refType: selectedReference?.type || ""
  });

  const res = await fetch(`${API_URL}?${params}`);
  const data = await res.json();

  renderRecs(data.movies, "movieList");
  renderRecs(data.tv, "tvList");
  renderRecs(data.books, "bookList");
  renderSpotify(data.spotify, "spotifyList");
}

// Renderers
function renderRecs(items, targetId) {
  const container = document.getElementById(targetId);
  container.innerHTML = "";
  items.forEach(item => renderCard(item, container));
}
function renderSpotify(link, targetId) {
  const container = document.getElementById(targetId);
  container.innerHTML = link ? `<iframe src="${link}" width="300" height="380" frameborder="0" allow="encrypted-media"></iframe>` : "<p>No playlist found</p>";
}
function renderCard(item, container, isWatchlist = false) {
  const card = document.createElement("div");
  card.className = "p-4 border rounded-lg bg-white max-w-[220px]";
  card.innerHTML = `
    <img src="${item.image || ''}" class="rounded mb-2">
    <h3 class="font-bold">${item.title || 'Untitled'} (${item.type})</h3>
    <p class="text-xs text-gray-600">${item.desc?.slice(0,100) || ''}</p>
    <p class="text-xs text-gray-500 italic">${item.reason || ''}</p>
    ${isWatchlist ? `<button class="mt-2 px-3 py-1 bg-[#e92932] text-white rounded-full text-sm removeBtn">Remove</button>` 
      : `<button class="mt-2 px-3 py-1 bg-[#f3e7e8] rounded-full text-sm addWatch">Save</button>`}
  `;
  container.appendChild(card);
  if (isWatchlist) card.querySelector(".removeBtn").onclick = () => removeFromWatchlist(item.title);
  else card.querySelector(".addWatch").onclick = () => saveToWatchlist(item);
}
