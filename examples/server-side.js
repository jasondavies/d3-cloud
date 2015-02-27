var d3 = require('../index');
var jsdom = require("jsdom").jsdom;

var fs = require('fs');

var document = jsdom("<body></body>");
var fill = d3.scale.category20();

d3.layout.cloud().size([900, 900])
	.words([
	"Hello", "world", "normally", "you", "want", "more", "words",
	"than", "this"].map(function(d) {
	return {text: d, size: 10 + Math.random() * 90};
	}))
	.padding(5)
	.rotate(function() { return ~~(Math.random() * 2) * 90; })
	.font("Impact")
	.fontSize(function(d) { return d.size; })
	.on("end", function(words){
		draw(words, document.body);
	})
	.start();

fs.writeFileSync('output.html', document.body.innerHTML);

function draw(words, node) {
    d3.select(node).append("svg")
        .attr("width", 900)
        .attr("height", 900)
      .append("g")
        .attr("transform", "translate(450,450)")
      .selectAll("text")
        .data(words)
      .enter().append("text")
        .style("font-size", function(d) { return d.size + "px"; })
        .style("font-family", "Impact")
        .style("fill", function(d, i) { return fill(i); })
        .attr("text-anchor", "middle")
        .attr("transform", function(d) {
          return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
        })
        .text(function(d) { return d.text; });
 }