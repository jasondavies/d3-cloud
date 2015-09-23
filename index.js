var globals = {};

// stash globals
if ("d3" in global) globals.d3 = global.d3;
global.d3 = require("d3");

require("./d3.layout.cloud");
module.exports = d3.layout.cloud;

// restore globals
if ("d3" in globals) global.d3 = globals.d3;
else delete global.d3;
