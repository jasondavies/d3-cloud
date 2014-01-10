var Canvas = require("canvas"),
    globals = {};

// stash globals
if ("Canvas" in global) globals.Canvas = global.Canvas;
global.Canvas = Canvas;

module.exports = require("./d3.layout.cloud");

// restore globals
if ("Canvas" in globals) global.Canvas = globals.Canvas;
else delete global.Canvas;
