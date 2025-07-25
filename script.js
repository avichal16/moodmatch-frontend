const API_URL = "https://<your-vercel-project>.vercel.app/api/mood"; // Replace with your Vercel URL
const TMDB_API_KEY = "c5bb9a766bdc90fcc8f7293f6cd9c26a";

const moodText = document.getElementById("moodText");
const movieList = document.getElementById("movieList");
const bookList = document.getElementById("bookList");

async function getMoodAnalysis(text) {
  const params = new URLSearchParams({ moodText: text });
  const res = await fetch(`${API_URL}?${params}`);
  return res.json();
}

document.getElementById("recommendButton").onclick = async () => {
  const moodData = await getMoodAnalysis(moodText.value);
  const genres = moodData.genres.join(",");
  const keyword = moodData.tags[0] || "bestseller";

  const movieRes = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&with_genres=${genres}`);
  const movies = (await movieRes.json()).results.slice(0, 6);

  const bookRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${keyword}&maxResults=6`);
  const books = (await bookRes.json()).items;

  movieList.innerHTML = "<h2>Movies</h2>" + movies.map(m => `<p>${m.title}</p>`).join("");
  bookList.innerHTML = "<h2>Books</h2>" + books.map(b => `<p>${b.volumeInfo.title}</p>`).join("");
};
