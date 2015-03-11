var GradientContainer = require('./GradientContainer');
var Color = require('../color');

function RadialGradientContainer(imageData, container) {
    GradientContainer.apply(this, arguments);
    this.type = this.TYPES.RADIAL;

    if(imageData.prefix === '-webkit-')
      return;

    var bounds = container.parseBounds();

    // TODO: Transform webkit syntax to standard.

    var shape = 'ellipse';
    var extentKeyword;

    var direction = imageData.args[0].split('at')[0];
    var at = imageData.args[0].split('at')[1] || '';

    direction.split(' ').reverse().forEach(function(position) {
      switch(position) {
      case 'circle':
        shape = 'circle';
        extentKeyword = extentKeyword || 'farthest-corner';
        break;
      case 'ellipse':
        shape = 'ellipse';
        extentKeyword = extentKeyword || 'farthest-corner';
        break;
      case 'closest-side':
        extentKeyword = 'closest-side';
        break;
      case 'closest-corner':
        extentKeyword = 'closest-corner';
        break;
      case 'farthest-side':
        extentKeyword = 'farthest-side';
        break;
      case 'farthest-corner':
        extentKeyword = 'farthest-corner';
        break;
      }
    });

    var matches = direction.match(this.lengthExp);
    if(matches.length > 0) {
      if(matches.length > 1) {
        // must be an ellipse

        var width = matches[0].indexOf("%") > -1 ? (parseFloat(matches[0]) / 100) * bounds.width : parseFloat(matches[0]);
        var height = matches[1].indexOf("%") > -1 ? (parseFloat(matches[1]) / 100) * bounds.height : parseFloat(matches[1]);

        this.r = (bounds.width - container.borders.borders[1].width - container.borders.borders[3].width) * (width / bounds.width);
      } else {
        // must be a circle
        // value cannot be a percentage

        this.r = parseFloat(matches[0]);
      }

      this.x0 = this.x1 = 0;
      this.y0 = this.y1 = 0;
    }

    var pMatches = at.match(this.lengthExp);
    if(pMatches.length > 1) {
      var x = pMatches[0].indexOf("%") > -1 ? (parseFloat(pMatches[0]) / 100) * bounds.width : parseFloat(pMatches[0]);
      var y = pMatches[1].indexOf("%") > -1 ? (parseFloat(pMatches[1]) / 100) * bounds.height : parseFloat(pMatches[1]);

      this.x0 = this.x1 = this.x1 + x;
      this.y0 = this.y1 = this.y0 + y;
    }

    this.colorStops = imageData.args.slice(1).map(function(colorStop) {
      var colorStopMatch = colorStop.replace(/transparent/g, 'rgba(0, 0, 0, 0.0)').match(this.stepRegExp);
      return {
        color: new Color(colorStopMatch[1]),
        stop: colorStopMatch[3] === "%" ? 1 - (colorStopMatch[2] / 100) : null
      };
    }, this);

    if(this.colorStops[0].stop === null) {
      this.colorStops[0].stop = 0;
    }

    if(this.colorStops[this.colorStops.length - 1].stop === null) {
      this.colorStops[this.colorStops.length - 1].stop = 1;
    }

    this.colorStops.forEach(function(colorStop, index) {
      if(colorStop.stop === null) {
        this.colorStops.slice(index).some(function(find, count) {
          if(find.stop !== null) {
            colorStop.stop = ((find.stop - this.colorStops[index - 1].stop) / (count + 1)) + this.colorStops[index - 1].stop;
            return true;
          } else {
            return false;
          }
        }, this);
      }
    }, this);
}

RadialGradientContainer.prototype = Object.create(GradientContainer.prototype);

RadialGradientContainer.prototype.lengthExp = /([0-9]+(?:px|%){1})/g;
RadialGradientContainer.prototype.stepRegExp = /((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\))\s*(\d{1,3})?(%|px)?/;

module.exports = RadialGradientContainer;
