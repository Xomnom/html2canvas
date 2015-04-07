var SVGContainer = require('./SVGContainer');
var Promise = require('../promise');
var SVGParser = require('./SVGParser.js');

function SVGNodeContainer(node, _native) {
  this.src = node;
  this.image = document.createElement('canvas');
  var self = this;

  this.promise = new Promise(function(resolve, reject) {
    SVGParser.parse(this.image, node, {
      renderCallback: resolve
    });
  }.bind(this));
}

SVGNodeContainer.prototype = Object.create(SVGContainer.prototype);

module.exports = SVGNodeContainer;
