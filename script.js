const API_URL = "https://moodmatch-api-4vdp.vercel.app/api/mood"; // Replace with your actual Vercel API URL
const TMDB_API_KEY = "c5bb9a766bdc90fcc8f7293f6cd9c26a";

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const selectedList = document.getElementById("selectedList");
const tagContainer = document.getElementById("tagOptions");
const moodText = document.getElementById("moodText");
const movieList = document.getElementById("movieList");
const bookList = document.getElementById("bookList");
const watchlistContainer = document.getElementById("watchlistContainer");

let selectedTitles = [];
let selectedTags = [];

// Tag Options
const tags = ["Suspenseful","Thought-Provoking","Wholesome","Intense","Emotional","Funny","Romantic","Action-Packed","Mysterious","Heartwarming"];
if (tagContainer) {
  tags.forEach(tag => {
    const btn=document.createElement("div");
    btn.textContent=tag;
    btn.className="px-4 py-1 bg-[#f3e7e8] rounded-full cursor-pointer";
    btn.onclick=()=>{
      if (selectedTags.includes(tag)) {
        selectedTags = selectedTags.filter(t=>t!==tag);
        btn.classList.remove("bg-[#994d51]","text-white");
      } else if (selectedTags.length<5) {
        selectedTags.push(tag);
        btn.classList.add("bg-[#994d51]","text-white");
      }
    };
    tagContainer.appendChild(btn);
  });
}

// Search Suggestions
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    if (query.length > 2) searchAll(query);
    else searchResults.innerHTML = "";
  });
}

async function searchAll(query) {
  searchResults.innerHTML="<li class='p-2 text-gray-500'>Searching...</li>";
  try {
    const tmdbRes=await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
    const tmdbData=await tmdbRes.json();
    const tmdbResults=(tmdbData.results||[]).slice(0,5).map(i=>({
      id:i.id,title:i.title||i.name,type:i.media_type,image:i.poster_path?`https://image.tmdb.org/t/p/w92${i.poster_path}`:""
    }));

    const bookRes=await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`);
    const bookData=await bookRes.json();
    const bookResults=(bookData.items||[]).map(b=>({
      id:b.id,title:b.volumeInfo.title,type:"book",image:b.volumeInfo.imageLinks?.thumbnail||""
    }));

    const results=[...tmdbResults,...bookResults];
    searchResults.innerHTML="";
    results.forEach(item=>{
      const li=document.createElement("li");
      li.className="flex items-center gap-3 p-2 hover:bg-gray-100 cursor-pointer";
      li.innerHTML=`<img src="${item.image}" class="w-8 h-12 object-cover rounded"><span>${item.title} <span class="text-xs text-gray-500">(${item.type})</span></span>`;
      li.onclick=()=>{
        selectedTitles.push(item);
        const chip=document.createElement("div");
        chip.className="px-3 py-1 bg-[#f3e7e8] rounded-full text-sm";
        chip.textContent=item.title;
        selectedList.appendChild(chip);
        searchResults.innerHTML="";
        searchInput.value="";
      };
      searchResults.appendChild(li);
    });
  } catch(e){console.error(e);}
}

// Mood Analysis + Recommendations
const recommendBtn=document.getElementById("recommendButton");
if (recommendBtn) recommendBtn.onclick=()=>loadRecommendations();

async function getMoodAnalysis(text,tags=[]) {
  try {
    const params=new URLSearchParams({ moodText:text, tags:tags.join(",") });
    const res=await fetch(`${API_URL}?${params}`);
    return res.json();
  } catch(e){
    console.error("Mood API error",e);
    return {tags:tags,genres:[]};
  }
}

async function loadRecommendations() {
  movieList.innerHTML="<p class='p-4 text-gray-500'>Loading recommendations...</p>";
  bookList.innerHTML="";

  const moodData=await getMoodAnalysis(moodText.value.trim(),selectedTags);
  const genres=moodData.genres||[];
  const keyword=selectedTitles[0]?.title||moodData.tags?.[0]||"bestseller";

  try {
    const movieRes=await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&with_genres=${genres.join(",")}`);
    const movies=(await movieRes.json()).results.slice(0,6).map(m=>({
      id:m.id,title:m.title,image:`https://image.tmdb.org/t/p/w200${m.poster_path}`,desc:m.overview,type:"movie"
    }));

    const bookRes=await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(keyword)}&maxResults=6`);
    const books=(await bookRes.json()).items.map(b=>({
      id:b.id,title:b.volumeInfo.title,image:b.volumeInfo.imageLinks?.thumbnail||"",desc:b.volumeInfo.description||"",type:"book"
    }));

    movieList.innerHTML="";
    movies.forEach(i=>renderCard(i,movieList));
    bookList.innerHTML="";
    books.forEach(i=>renderCard(i,bookList));
  } catch(e){console.error(e);}
}

function renderCard(item,container){
  const card=document.createElement("div");
  card.className="p-4 border rounded-lg bg-white max-w-[220px]";
  card.innerHTML=`
    <img src="${item.image}" class="rounded mb-2">
    <h3 class="font-bold">${item.title} <span class="text-xs text-gray-500">(${item.type})</span></h3>
    <p class="text-xs text-gray-600">${item.desc?.slice(0,100)||"No description"}...</p>
    <button class="mt-2 px-3 py-1 bg-[#f3e7e8] rounded-full text-sm addWatch">Save</button>`;
  container.appendChild(card);
  card.querySelector(".addWatch").onclick=()=>{
    const list=JSON.parse(localStorage.getItem("watchlist")||"[]");
    list.push(item);
    localStorage.setItem("watchlist",JSON.stringify(list));
    alert("Saved to Watchlist!");
  };
}

// Watchlist
if (watchlistContainer){
  const items=JSON.parse(localStorage.getItem("watchlist")||"[]");
  if (!items.length) watchlistContainer.innerHTML="<p class='p-4 text-gray-500'>No saved titles.</p>";
  items.forEach(item=>{
    const card=document.createElement("div");
    card.className="p-4 border rounded-lg bg-white max-w-[200px]";
    card.innerHTML=`
      <img src="${item.image}" class="rounded mb-2">
      <h3 class="font-bold">${item.title} <span class="text-xs text-gray-500">(${item.type})</span></h3>
      <button class="mt-2 px-3 py-1 bg-[#e92932] text-white rounded-full text-sm removeBtn">Remove</button>`;
    card.querySelector(".removeBtn").onclick=()=>{
      const list=JSON.parse(localStorage.getItem("watchlist")||"[]").filter(x=>x.title!==item.title);
      localStorage.setItem("watchlist",JSON.stringify(list));
      card.remove();
    };
    watchlistContainer.appendChild(card);
  });
}

