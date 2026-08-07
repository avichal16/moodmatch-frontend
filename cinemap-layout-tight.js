// Compact first-view layout for CineMap. Runs after cinemap.js.
Object.assign(REGION_POS, {
  genre: { x: -430, y: -85 },
  movement: { x: -220, y: 175 },
  country: { x: 420, y: -85 },
  decade: { x: 420, y: 205 },
  style: { x: 10, y: 285 },
  company: { x: 255, y: 300 },
  director: { x: 0, y: -190 }
});

// Use less outer padding for the overview so the atlas fills the available canvas.
fitMap = function(max = .96) {
  if (!nodeMap.size) return;
  const vals = [...nodeMap.values()];
  const xs = vals.map(n => n.x), ys = vals.map(n => n.y);
  const minX = Math.min(...xs) - 105, maxX = Math.max(...xs) + 105;
  const minY = Math.min(...ys) - 95, maxY = Math.max(...ys) + 95;
  const r = svg.getBoundingClientRect();
  scale = Math.min(max, r.width / (maxX - minX), r.height / (maxY - minY));
  panX = r.width / 2 - ((minX + maxX) / 2) * scale + 80;
  panY = r.height / 2 - ((minY + maxY) / 2) * scale;
  setTransform();
};

// Rebuild once with the compact coordinates after the main renderer has initialized.
seedAtlas();
fitMap(.96);
