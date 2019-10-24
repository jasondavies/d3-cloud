
const d3 = require("d3"),
    cloud = require("../../index");

export function cloudTest(words, options) {

    const div = document.createElement('div');
    div.setAttribute("id", 'cloudCanvas');
    div.setAttribute("style", "display: block; width: 500px; height: 500px; background: #eee");


    const fill = d3.scale.category20();

    const layout = cloud()
        .size([500, 500])
        .words(words.map(function (d) {
            return {text: d, size: 10 + Math.random() * 90, test: "haha"};
        }))
        .padding(5)
        .rotate(function () {
            return ~~(Math.random() * (180/options.angle)) * options.angle;
        })
        .font("Impact")
        .fontSize(function (d) {
            return d.size;
        })
        .on("end", draw);

    function draw(words) {
        d3.select('div#cloudCanvas').append("svg")
            .attr("width", layout.size()[0])
            .attr("height", layout.size()[1])
            .append("g")
            .attr("transform", "translate(" + layout.size()[0] / 2 + "," + layout.size()[1] / 2 + ")")
            .selectAll("text")
            .data(words)
            .enter().append("text")
            .style("font-size", function (d) {
                return d.size + "px";
            })
            .style("font-family", "Impact")
            .style("fill", function (d, i) {
                return fill(i);
            })
            .attr("text-anchor", "middle")
            .attr("transform", function (d) {
                return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
            })
            .text(function (d) {
                return d.text;
            });
    }

    setTimeout(() => {
        layout.start()
    }, 5);

    return div;
}
