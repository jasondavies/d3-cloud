# Word Cloud Layout for D3

This is a [Wordle](http://www.wordle.net/)-inspired word cloud layout written
in JavaScript. It uses HTML5 canvas and sprite masks to achieve
near-interactive speeds.

See [here](http://www.jasondavies.com/wordcloud/) for an interactive
demonstration along with implementation details.

![Example cloud of Twitter search results for “amazing”](raw/master/examples/amazing.png)

## Usage

See the samples in `examples/`.

This layout is similar to
[d3.layout.force](https://github.com/mbostock/d3/wiki/Force-Layout), in that
it’s *asynchronous* and *stateful*.
