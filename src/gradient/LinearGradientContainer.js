var GradientContainer = require('./GradientContainer');
var Color = require('../color');

function LinearGradientContainer(imageData, container) {
    GradientContainer.apply(this, arguments);
    this.type = this.TYPES.LINEAR;

    var bounds = container.parseBounds();
    var hasDirection = imageData.args[0].indexOf(this.stepRegExp) === -1;

    if (hasDirection) {
        imageData.args[0].split(" ").reverse().forEach(function(position) {
            switch(position) {
            case "0deg":
            case "left":
                this.x0 = 0;
                this.x1 = bounds.width;
                break;
            case "90deg":
            case "top":
                this.y0 = 0;
                this.y1 = bounds.height;
                break;
            case "180deg":
            case "right":
                this.x0 = bounds.width;
                this.x1 = 0;
                break;
            case "270deg":
            case "bottom":
                this.y0 = bounds.height;
                this.y1 = 0;
                break;
            case "to":
                var y0 = this.y0;
                var x0 = this.x0;
                this.y0 = this.y1;
                this.x0 = this.x1;
                this.x1 = x0;
                this.y1 = y0;
                break;
            default:
                if(position.indexOf('deg') != -1) {
                    var deg = parseFloat(position.substr(0, position.length - 3));

                    // Unprefixed radial gradients use bearings instead of polar coords.
                    if(imageData.prefix === '-webkit-') {
                      deg = 90 - deg;
                    }

                    deg = deg % 360;
                    while(deg < 0) {
                      deg += 360;
                    }

                    var slope = Math.tan(90 - deg);
                    var pSlope = -1 / slope;

                    var hW = bounds.width / 2;
                    var hH = bounds.height / 2;

                    var corner;
                    if (deg < 90) {
                      corner = [hW, hH];
                    } else if (deg < 180) {
                      corner = [hW, -hH];
                    } else if (deg < 270) {
                      corner = [-hW, -hH];
                    } else {
                      corner = [-hW, hH];
                    }

                    var c = corner[1] - pSlope * corner[0];
                    var endX = c / (slope - pSlope);
                    var endY = pSlope * endX + c;

                    this.x0 = hW - endX;
                    this.y0 = hH + endY;

                    this.x1 = hW + endX;
                    this.y1 = hH - endY;
                }
                break;
            }
        }, this);
    } else {
        this.y0 = 0;
        this.y1 = bounds.height;
    }

    this.colorStops = imageData.args.slice(hasDirection ? 1 : 0).map(function(colorStop) {
        var colorStopMatch = colorStop.replace(/transparent/g, 'rgba(0, 0, 0, 0.0)').match(this.stepRegExp);
        return {
            color: new Color(colorStopMatch[1]),
            stop: colorStopMatch[3] === "%" ? colorStopMatch[2] / 100 : null
        };
    }, this);

    if (this.colorStops[0].stop === null) {
        this.colorStops[0].stop = 0;
    }

    if (this.colorStops[this.colorStops.length - 1].stop === null) {
        this.colorStops[this.colorStops.length - 1].stop = 1;
    }

    this.colorStops.forEach(function(colorStop, index) {
        if (colorStop.stop === null) {
            this.colorStops.slice(index).some(function(find, count) {
                if (find.stop !== null) {
                    colorStop.stop = ((find.stop - this.colorStops[index - 1].stop) / (count + 1)) + this.colorStops[index - 1].stop;
                    return true;
                } else {
                    return false;
                }
            }, this);
        }
    }, this);
}

LinearGradientContainer.prototype = Object.create(GradientContainer.prototype);

LinearGradientContainer.prototype.stepRegExp = /((?:rgb|rgba)\(\d{1,3},\s\d{1,3},\s\d{1,3}(?:,\s[0-9\.]+)?\))\s*(\d{1,3})?(%|px)?/;

module.exports = LinearGradientContainer;
