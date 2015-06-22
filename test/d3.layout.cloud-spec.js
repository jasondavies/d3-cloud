(function() {

  /* globals require, describe, it, expect, console */

  'use strict';

  try {

    var document = require("jsdom").jsdom("<html><head></head><body></body></html>");
    // window = document.createWindow();
    // navigator = window.navigator;
    // CSSStyleDeclaration = window.CSSStyleDeclaration;

    var d3 = require("../src/d3.layout.cloud");

    var fs = require("fs");


    describe('d3.layout.cloud', function() {

      it('should create an svg', function() {

        var w = 960 * 1,
          h = 600 * 1;

        var layout = d3.layout.cloud()
          .padding(0)
          .size([w, h])
          .font("Impact")
          .text(function(d) {
            return d.key;
          })
          .on("end", draw);

        var start = +new Date();

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
          tags = d3.entries(tags).sort(function(a, b) {
            return b.value - a.value;
          }).slice(0, 500);
          var min = +tags[tags.length - 1].value || 1,
            max = +tags[0].value;
          layout.fontSize(function(d) {
            return min + (d - min) / (max - min);
          }).words(tags).start();
        }

        function draw() {
          console.log(+new Date() - start);
        }

        expect(document).toBeDefined();
        expect(document.getElementsByTagName('svg')).toBeDefined();
        expect(document.getElementsByTagName('svg').length).toEqual(' ');
      });

    });


  } catch (e) {
    console.log(e);
    console.log(e, e.stack);
  }

})();