(() => {
  const container = document.getElementById("bookList");
  if (!container) return;

  const cache = new Map();

  function coverFrom(info = {}) {
    const links = info.imageLinks || {};
    return (links.extraLarge || links.large || links.medium || links.small || links.thumbnail || links.smallThumbnail || "")
      .replace(/^http:/, "https:")
      .replace(/&edge=curl/g, "");
  }

  async function findCover(title) {
    if (cache.has(title)) return cache.get(title);
    try {
      const query = encodeURIComponent(`intitle:${title}`);
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=20&printType=books`);
      if (!response.ok) return "";
      const data = await response.json();
      const normalized = title.toLowerCase();
      const candidates = (data.items || [])
        .map(item => ({
          title: String(item.volumeInfo?.title || ""),
          cover: coverFrom(item.volumeInfo)
        }))
        .filter(item => item.cover)
        .sort((a, b) => {
          const aExact = a.title.toLowerCase() === normalized ? 1 : 0;
          const bExact = b.title.toLowerCase() === normalized ? 1 : 0;
          return bExact - aExact;
        });
      const cover = candidates[0]?.cover || "";
      cache.set(title, cover);
      return cover;
    } catch (error) {
      console.warn("Book cover lookup failed", title, error);
      return "";
    }
  }

  async function repairCard(card) {
    if (card.dataset.coverChecked === "true") return;
    card.dataset.coverChecked = "true";
    const title = card.querySelector("h4")?.textContent?.trim();
    const image = card.querySelector("img");
    if (!title || !image) return;

    const hasUsableImage = image.getAttribute("src") && image.getAttribute("src") !== window.location.href;
    if (hasUsableImage) {
      image.addEventListener("error", async () => {
        const cover = await findCover(title);
        if (cover) {
          image.src = cover;
          image.style.display = "block";
          image.nextElementSibling?.remove();
        }
      }, { once: true });
      return;
    }

    const cover = await findCover(title);
    if (cover) {
      image.src = cover;
      image.style.display = "block";
      const fallback = image.nextElementSibling;
      if (fallback && fallback.tagName === "DIV") fallback.remove();
    }
  }

  function scan() {
    container.querySelectorAll("article").forEach(repairCard);
  }

  new MutationObserver(scan).observe(container, { childList: true, subtree: true });
  scan();
})();