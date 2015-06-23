(function() {

  /* globals require, describe, it, expect, console */
  'use strict';

  try {

    var localdocument;
    var locald3;
    try {
      localdocument = document;
      locald3 = d3;
    } catch (e) {
      localdocument = require("jsdom").jsdom("<html><head></head><body><div id='a-cloud'></div></body></html>");
      locald3 = require("d3");
      require("../");
    }
    // window = localdocument.createWindow();
    // navigator = window.navigator;
    // CSSStyleDeclaration = window.CSSStyleDeclaration;

    describe('d3.layout.cloud', function() {
      var simpleCloudElement = localdocument.createElement("div");
      simpleCloudElement.setAttribute("id", "simple-cloud");
      localdocument.body.appendChild(simpleCloudElement);

      var fill = locald3.scale.category20();

      var mySimpleCloud = locald3.layout.cloud().size([300, 300])
        .words([
          "Hello", "world", "normally", "you", "want", "more", "words",
          "than", "this"
        ].map(function(d) {
          return {
            text: d,
            size: 10 + Math.random() * 90
          };
        }))
        .padding(5)
        .rotate(function() {
          return ~~(Math.random() * 2) * 90;
        })
        .font("Impact")
        .fontSize(function(d) {
          return d.size;
        })
        .on("end", draw)
        .start();

      function draw(words) {
        locald3.select(simpleCloudElement).append("svg")
          .attr("width", 300)
          .attr("height", 300)
          .append("g")
          .attr("transform", "translate(150,150)")
          .selectAll("text")
          .data(words)
          .enter().append("text")
          .style("font-size", function(d) {
            return d.size + "px";
          })
          .style("font-family", "Impact")
          .style("fill", function(d, i) {
            return fill(i);
          })
          .attr("text-anchor", "middle")
          .attr("transform", function(d) {
            return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
          })
          .text(function(d) {
            return d.text;
          });
      }

      it('should draw one svg text node for each word, if it fits', function() {
        expect(mySimpleCloud).toBeDefined();
        expect(mySimpleCloud.words().length).toEqual(9);

        expect(localdocument).toBeDefined();
        expect(locald3.select(simpleCloudElement)).toBeDefined();
        if (locald3.select(simpleCloudElement)[0][0].children[0].childNodes[0]._childNodes) {
          expect(locald3.select(simpleCloudElement)[0][0].children[0].childNodes[0]._childNodes.length).toEqual(mySimpleCloud.words().length);
        } else {
          expect(locald3.select(simpleCloudElement)[0][0].children[0].childNodes[0].childElementCount).toEqual(mySimpleCloud.words().length);
        }
      });

    });

  } catch (e) {
    console.log(e);
    console.log(e, e.stack);
  }

})();