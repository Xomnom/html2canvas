var Promise = require('./promise');
var Support = require('./support');
var CanvasRenderer = require('./renderer/CanvasRenderer');
var ImageLoader = require('./imageloader');
var NodeParser = require('./nodeparser');
var NodeContainer = require('./nodecontainer');
var BoundingBox = require('./BoundingBox');
var log = require('./log');
var utils = require('./utils');
var createWindowClone = require('./clone');
var loadUrlDocument = require('./proxy').loadUrlDocument;
var getBounds = utils.getBounds;

var html2canvasNodeAttribute = "data-html2canvas-node";
var html2canvasCloneIndex = 0;

function getDocWidth(node, isDGLux) {
  var hasScroll = !isDGLux || node.ownerDocument.body.firstChild.style.overflowX !== 'hidden';
  var children = Array.prototype.slice.call(node.ownerDocument.body.childNodes).map(function(child) {
    var bounds = utils.getBounds(child);
    var arr = [bounds.x + child.innerWidth];
    if(hasScroll)
      arr.push(bounds.x + child.scrollWidth);
    return arr;
  }).reduce(function(arr, child) {
    return arr.concat(child);
  }, []);
  
  var arr = [
    node.clientWidth,
    node.offsetWidth,
    node.ownerDocument.documentElement.clientWidth,
    node.ownerDocument.documentElement.offsetWidth
  ];
  
  if(hasScroll)
    arr = arr.concat([
      node.scrollWidth,
      node.ownerDocument.documentElement.scrollWidth
    ]);

  return Math.max.apply(this, arr.concat(children).filter(function(a) {
    return a;
  }));
}

function getDocHeight(node, isDGLux) {
  var hasScroll = !isDGLux || node.ownerDocument.body.firstChild.style.overflowY !== 'hidden';
  var children = Array.prototype.slice.call(node.ownerDocument.body.childNodes).map(function(child) {
    var bounds = utils.getBounds(child);
    var arr = [bounds.y + child.innerHeight];
    if(hasScroll)
      arr.push(bounds.y + child.scrollHeight);
    return arr;
  }).reduce(function(arr, child) {
    return arr.concat(child);
  }, []);

  var arr = [
    node.clientHeight,
    node.offsetHeight,
    node.ownerDocument.documentElement.clientHeight,
    node.ownerDocument.documentElement.offsetHeight
  ];
  
  if(hasScroll)
    arr = arr.concat([
      node.scrollHeight,
      node.ownerDocument.documentElement.scrollHeight
    ]);
  
  return Math.max.apply(this, arr.concat(children).filter(function(a) {
    return a;
  }));
}

function html2canvas(nodeList, options) {
  var index = html2canvasCloneIndex++;
  options = options || {};
  if(!options.debug) {
    html2canvas.logging = true;
    html2canvas.start = Date.now();
  }

  options.isDGLux = options.isDGLux || false;
  options.scale = options.scale || 1;
  options.async = typeof(options.async) === "undefined" ? true : options.async;
  options.allowTaint = typeof(options.allowTaint) === "undefined" ? false : options.allowTaint;
  options.removeContainer = typeof(options.removeContainer) === "undefined" ? true : options.removeContainer;
  options.javascriptEnabled = typeof(options.javascriptEnabled) === "undefined" ? false : options.javascriptEnabled;
  options.imageTimeout = typeof(options.imageTimeout) === "undefined" ? 10000 : options.imageTimeout;
  options.renderer = typeof(options.renderer) === "function" ? options.renderer : CanvasRenderer;
  options.strict = !!options.strict;

  if(typeof(nodeList) === "string") {
    log("Creating iframe for HTML contents");
    return new Promise(function(complete, reject) {
      var frame = document.createElement("iframe");

      frame.width = options.width || '100%';
      frame.height = options.height || '100%';
      utils.hideContainer(frame);

      document.body.appendChild(frame);

      const frameDocument = frame.contentWindow.document;
      frame.onload = function() {
        html2canvas(frameDocument.documentElement, options).then(function(canvas) {
          document.body.removeChild(frame);
          complete(canvas);
        }).catch((e) => {
          console.log(e);
          reject(e);
        });
      };

      frameDocument.open();
      frameDocument.write(nodeList);
      frameDocument.close();
    });
  }

  var node = document.documentElement[0];

  if (nodeList) {
    node = (nodeList.length) ? nodeList[0] : nodeList;
  }

  node.setAttribute(html2canvasNodeAttribute + index, index);
  var width = options.width || getDocWidth(node, options.isDGLux);
  var height = options.height || getDocHeight(node, options.isDGLux);

  return renderDocument(node.ownerDocument, options, width, height, index).then(function(canvas) {
    if(typeof(options.onrendered) === "function") {
      log("options.onrendered is deprecated, html2canvas returns a Promise containing the canvas");
      options.onrendered(canvas);
    }
    return canvas;
  }).catch(function(err) {
    console.error(err);
  });
}

html2canvas.Promise = Promise;
html2canvas.CanvasRenderer = CanvasRenderer;
html2canvas.NodeContainer = NodeContainer;
html2canvas.log = log;
html2canvas.utils = utils;

function renderDocument(document, options, windowWidth, windowHeight, html2canvasIndex) {
  return createWindowClone(document, document, windowWidth, windowHeight, options, document.defaultView.pageXOffset, document.defaultView.pageYOffset).then(function(container) {
    log("Document cloned");
    var attributeName = html2canvasNodeAttribute + html2canvasIndex;
    var selector = "[" + attributeName + "='" + html2canvasIndex + "']";
    document.querySelector(selector).removeAttribute(attributeName);
    var clonedWindow = container.contentWindow;
    var node = clonedWindow.document.querySelector(selector);
    var oncloneHandler = (typeof(options.onclone) === "function") ? Promise.resolve(options.onclone(clonedWindow.document)) : Promise.resolve(true);
    return oncloneHandler.then(function() {
      options.document = document;
      return renderWindow(node, container, options, windowWidth, windowHeight);
    });
  });
}

function renderWindow(node, container, options, windowWidth, windowHeight) {
  var clonedWindow = container.contentWindow;
  var support = new Support(clonedWindow.document);
  var imageLoader = new ImageLoader(options, support);
  var bounds = getBounds(node);

  var width = options.type === "view" ? windowWidth : getDocWidth(node, options.isDGLux);
  var height = options.type === "view" ? windowHeight : getDocHeight(node, options.isDGLux);

  var renderer = new options.renderer(width, height, imageLoader, options);
  var parser = new NodeParser(node, renderer, support, imageLoader, options);
  return parser.ready.then(function() {
    log("Finished rendering");
    var canvas;

    if(options.type === "view") {
      canvas = crop(renderer.canvas, new BoundingBox(
        0,
        0,
        renderer.canvas.width,
        renderer.canvas.height
      ));
    } else if(node === clonedWindow.document.body || node === clonedWindow.document.documentElement || options.canvas != null) {
      canvas = renderer.canvas;
    } else {
      canvas = crop(renderer.canvas, new BoundingBox(
        bounds.x,
        bounds.y,
        options.width != null ? bounds.x + options.width : bounds.y + bounds.width,
        options.width != null ? bounds.y + options.width : bounds.y + bounds.width
      ));
    }

    cleanupContainer(container, options);
    return canvas;
  });
}

function cleanupContainer(container, options) {
  if(options.removeContainer) {
    container.parentNode.removeChild(container);
    log("Cleaned up container");
  }
}

function crop(canvas, bounds) {
  var croppedCanvas = document.createElement("canvas");
  var x1 = Math.min(canvas.width - 1, Math.max(0, bounds.x));
  var x2 = Math.min(canvas.width, Math.max(1, bounds.x + bounds.width));
  var y1 = Math.min(canvas.height - 1, Math.max(0, bounds.y));
  var y2 = Math.min(canvas.height, Math.max(1, bounds.y + bounds.height));
  croppedCanvas.width = bounds.width;
  croppedCanvas.height = bounds.height;
  log("Cropping canvas at:", "left:", bounds.x, "top:", bounds.y, "width:", (x2 - x1), "height:", (y2 - y1));
  log("Resulting crop with width", bounds.width, "and height", bounds.height, " with x", x1, "and y", y1);
  croppedCanvas.getContext("2d").drawImage(canvas, x1, y1, x2 - x1, y2 - y1, bounds.x, bounds.y, x2 - x1, y2 - y1);
  return croppedCanvas;
}

function absoluteUrl(url) {
  var link = document.createElement("a");
  link.href = url;
  link.href = link.href;
  return link;
}

module.exports = (typeof(document) === "undefined" || typeof(Object.create) !== "function" || typeof(document.createElement("canvas").getContext) !== "function") ? function() {
  return Promise.reject("No canvas support");
} : html2canvas;
