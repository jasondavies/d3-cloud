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
      localdocument = require("jsdom").jsdom("<html><head></head><body></body></html>");
      locald3 = require("../src/d3.layout.cloud");
    }
    // window = localdocument.createWindow();
    // navigator = window.navigator;
    // CSSStyleDeclaration = window.CSSStyleDeclaration;

    describe('d3.layout.cloud', function() {

      it('should parse a text into words', function() {

        var endTime,
          w = 960 * 1,
          h = 600 * 1;

        var layout = locald3.layout.cloud()
          .padding(0)
          .size([w, h])
          .font("Impact")
          .text(function(d) {
            return d.key;
          })
          .on("end", draw);

        var start  = +new Date();

        for (var i = 0; i < 2; i++) {
          parseText("this is a small cloud");
        }

        function parseText(text) {
          var tags = {};
          text.split(/\s+/g).forEach(function(word) {
            word = word.replace(/[^A-Za-z0-9]/g, "");
            if (word.length <= 3) return;
            tags[word] = (tags[word] || 0) + 1;
          });
          tags = locald3.entries(tags).sort(function(a, b) {
            return b.value - a.value;
          }).slice(0, 500);
          var min = +tags[tags.length - 1].value || 1,
            max = +tags[0].value;
          layout.fontSize(function(d) {
            return min + (d - min) / (max - min);
          }).words(tags).start();
        }

        function draw() {
          endTime = +new Date();
          console.log("Time", +new Date() - start);
        }

        expect(start).toBeDefined();
        expect(endTime).toBeDefined();

        expect(layout).toBeDefined();
        expect(layout.words().length).toEqual(3);

      });

    });


  } catch (e) {
    console.log(e);
    console.log(e, e.stack);
  }

})();