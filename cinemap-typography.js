(() => {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const nodesLayer = document.getElementById("nodesLayer");
  if (!nodesLayer) return;

  const wordsToLines = (label, maxChars, maxLines) => {
    const words = String(label || "").trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/…$/, "").slice(0, Math.max(5, maxChars - 1))}…`;
    return kept;
  };

  const styleNode = (group) => {
    if (!group || group.dataset.typographyReady === "1") return;
    const title = group.querySelector(".node-title");
    if (!title) return;

    const original = (title.dataset.fullLabel || title.textContent || "").trim();
    if (!original) return;
    title.dataset.fullLabel = original;

    const isSeed = group.classList.contains("seed");
    const isMovie = group.classList.contains("movie");
    const lines = wordsToLines(original, isSeed ? 17 : isMovie ? 20 : 18, isSeed ? 2 : 3);
    title.textContent = "";

    const lineHeight = isSeed ? 9.5 : 10.5;
    const firstY = -((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
      const tspan = document.createElementNS(SVG_NS, "tspan");
      tspan.setAttribute("x", "0");
      tspan.setAttribute("y", String(firstY + index * lineHeight));
      tspan.textContent = line;
      title.appendChild(tspan);
    });

    const meta = group.querySelector(".node-meta");
    if (meta) {
      const metaY = firstY + (lines.length - 1) * lineHeight + 12;
      meta.setAttribute("y", String(metaY));
    }

    group.dataset.typographyReady = "1";
  };

  const refresh = () => nodesLayer.querySelectorAll(".node").forEach(styleNode);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches?.(".node")) styleNode(node);
        node.querySelectorAll?.(".node").forEach(styleNode);
      });
    }
  });

  observer.observe(nodesLayer, { childList: true, subtree: true });
  refresh();
})();
