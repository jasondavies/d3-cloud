export const SVG_NS = "http://www.w3.org/2000/svg";

export function placeAll(layout, sprites) {
  const placed = [];
  for (const sprite of sprites) {
    const word = layout.place(sprite);
    if (word) placed.push(word);
  }
  return placed;
}

export function measureBounds(sprites, [width, height]) {
  if (!sprites.length) {
    return [{ x: -width / 2, y: -height / 2 }, { x: width / 2, y: height / 2 }];
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const sprite of sprites) {
    x0 = Math.min(x0, sprite.x + sprite.x0);
    y0 = Math.min(y0, sprite.y + sprite.y0);
    x1 = Math.max(x1, sprite.x + sprite.x1);
    y1 = Math.max(y1, sprite.y + sprite.y1);
  }
  return [{ x: x0, y: y0 }, { x: x1, y: y1 }];
}

export function setViewBox(svg, bounds, padding = 28) {
  const width = Math.max(1, bounds[1].x - bounds[0].x);
  const height = Math.max(1, bounds[1].y - bounds[0].y);
  svg.setAttribute("viewBox", `${bounds[0].x - padding} ${bounds[0].y - padding} ${width + padding * 2} ${height + padding * 2}`);
  return { width, height };
}

export function drawText(svg, sprites, { bounds, size, color }) {
  const fragment = document.createDocumentFragment();
  for (const sprite of sprites) {
    const node = document.createElementNS(SVG_NS, "text");
    node.setAttribute("transform", `translate(${sprite.x} ${sprite.y}) rotate(${sprite.rotate})`);
    node.setAttribute("text-anchor", "middle");
    node.setAttribute("font-family", sprite.font);
    node.setAttribute("font-size", `${Math.max(1, Math.ceil(sprite.size))}px`);
    node.setAttribute("font-style", sprite.style);
    node.setAttribute("font-weight", sprite.weight);
    node.setAttribute("fill", color(sprite));
    node.textContent = sprite.text;
    fragment.append(node);
  }
  svg.replaceChildren(fragment);
  return setViewBox(svg, bounds || measureBounds(sprites, size));
}

export function createRandom(seed) {
  let state = seed >>> 0;
  return function() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
