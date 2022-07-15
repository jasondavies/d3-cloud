const { createCanvas } = require("canvas");
const cloud = require("d3-cloud");

const words = ["Hello", "world", "normally", "you", "want", "more", "words", "than", "this"]
    .map(function(d) {
      return {text: d, size: 10 + Math.random() * 90};
    });

cloud().size([960, 500])
    .canvas(() => createCanvas(1, 1))
    .words(words)
    .padding(5)
    .rotate(() => Math.floor(Math.random() * 2) * 90)
    .font("Impact")
    .fontSize(d => d.size)
    .on("end", words => console.log(JSON.stringify(words)))
    .start();
