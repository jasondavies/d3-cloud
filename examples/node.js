import { createCanvas } from "canvas";
import CloudLayout from "d3-cloud";

const words = ["Hello", "world", "normally", "you", "want", "more", "words", "than", "this"]
    .map(function(d) {
      return {text: d, size: 10 + Math.random() * 90};
    })
    .sort((a, b) => b.size - a.size);

const layout = new CloudLayout().canvas(() => createCanvas(1, 1))
    .aspectRatio(960 / 500)
    .startBox([960, 500]);

const sprites = words
  .map((word, index) => layout.getSprite(word.text, {
    ...word,
    index,
    font: "Impact",
    padding: 5,
    rotate: Math.floor(Math.random() * 2) * 90
  }))
  .filter(Boolean);
const placedWords = layout.placeAll(sprites);

console.log(JSON.stringify(placedWords));
