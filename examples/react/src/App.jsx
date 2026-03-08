import { useEffect, useState } from "react";
import CloudLayout from "d3-cloud";

const WIDTH = 720;
const HEIGHT = 480;
const VIEW_BOX = `${-WIDTH / 2} ${-HEIGHT / 2} ${WIDTH} ${HEIGHT}`;
const COLORS = ["#155e63", "#8c2f39", "#1d4e89", "#8f5b00", "#2f6b3b"];
const PREFIXES = [
  "React",
  "Hook",
  "State",
  "Props",
  "Memo",
  "Route",
  "Vite",
  "Node",
  "Cloud",
  "Sprite",
  "Pixel",
  "Vector",
  "Scale",
  "Graph",
  "Brush",
  "Color",
  "Theme",
  "Cache",
  "Frame",
  "Layer"
];
const SUFFIXES = ["UI", "DOM", "SVG", "Data", "Grid", "Flow", "Pack", "View", "Link", "Shape"];
const WORDS = PREFIXES.flatMap((prefix, prefixIndex) =>
  SUFFIXES.map((suffix, suffixIndex) => {
    const text = `${prefix}${suffix}`;
    const index = prefixIndex * SUFFIXES.length + suffixIndex;
    return {
      text,
      size: sizeForIndex(index),
      href: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(text)}`
    };
  })
);

export default function App() {
  const [placedWords, setPlacedWords] = useState([]);

  useEffect(() => {
    setPlacedWords(createCloud());
  }, []);

  return (
    <main>
      <section className="app">
        <h1>d3-cloud + React</h1>
        <p>
          A minimal client-side example with about 200 words. The layout runs
          inside <code>useEffect()</code>, and each placed word is rendered as
          a clickable SVG link.
        </p>
        <svg viewBox={VIEW_BOX} aria-label="Clickable React word cloud">
          {placedWords.map((word, index) => (
            <a key={word.text} href={word.href} target="_blank" rel="noreferrer">
              <text
                transform={`translate(${word.x} ${word.y}) rotate(${word.rotate})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily={word.font}
                fontSize={`${word.size + 1}px`}
                fontStyle={word.style}
                fontWeight={word.weight}
                fill={COLORS[index % COLORS.length]}
              >
                {word.text}
              </text>
            </a>
          ))}
        </svg>
      </section>
    </main>
  );
}

function createCloud() {
  const layout = new CloudLayout()
    .size([WIDTH, HEIGHT])
    .overflow(false);

  return [...WORDS]
    .sort((a, b) => b.size - a.size)
    .map(word => layout.getSprite(word.text, {
      ...word,
      font: "sans-serif",
      weight: "bold",
      padding: 1,
      rotate: 0
    }))
    .filter(Boolean)
    .map(sprite => layout.place(sprite))
    .filter(Boolean);
}

function sizeForIndex(index) {
  if (index === 0) return 42;
  if (index === 1) return 34;
  if (index < 6) return 28 - (index - 2) * 2;
  if (index < 20) return 18 - Math.floor((index - 6) / 4);
  if (index < 80) return 11 - Math.floor((index - 20) / 15);
  return 7 + (index % 3);
}
