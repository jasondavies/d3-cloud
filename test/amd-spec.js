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

      it('should support load as AMD', function() {
        expect(locald3).toBeDefined();
        expect(locald3.layout).toBeDefined();
        expect(locald3.layout.cloud).toBeDefined();
        expect(typeof locald3.layout.cloud).toEqual('function');
      });

    });


  } catch (e) {
    console.log(e);
    console.log(e, e.stack);
  }

})();