'use strict';

// TODO Some of this code can be removed now that we are using lodash and
// jquery (in browser environment / Cheerio if in Node.js environment).

var _ = require('lodash');
var Async = require('async');
var Strcase = require('tower-strcase');
var $ = typeof window === 'undefined' ? $ : window.$;

var Utils = {
  clone: function(src) {
    function mixin(dest, source, copyFunc) {
      var name;
      var s;
      var empty = {};
      for (name in source) {
        // the (!(name in empty) || empty[name] !== s) condition avoids
        // copying properties in "source"
        // inherited from Object.prototype.
        // For example, if dest has a custom toString() method,
        // don't overwrite it with the toString() method that
        // source inherited from Object.prototype
        s = source[name];
        if (!(name in dest) || (dest[name] !== s && (!(name in empty) || empty[name] !== s))) {
          dest[name] = copyFunc ? copyFunc(s) : s;
        }
      }
      return dest;
    }

    if (!src ||
        typeof src !== 'object' ||
        Object.prototype.toString.call(src) === '[object Function]') {
      // null, undefined, any non-object, or function
      return src; // anything
    }
    if (src.nodeType && 'cloneNode' in src) {
      // DOM Node
      return src.cloneNode(true); // Node
    }
    if (src instanceof Date) {
      // Date
      return new Date(src.getTime()); // Date
    }
    if (src instanceof RegExp) {
      // RegExp
      return new RegExp(src);   // RegExp
    }

    var r;
    var i;
    var l;
    if (src instanceof Array) {
      // array
      r = [];
      for (i = 0, l = src.length; i < l; ++i) {
        if (i in src) {
          r.push(Utils.clone(src[i]));
        }
      }
      // we don't clone functions for performance reasons
      //    }else if (d.isFunction(src)) {
      //      // function
      //      r = function() { return src.apply(this, arguments); };
    } else {
      // generic objects
      r = src.constructor ? new src.constructor() : {};
    }
    return mixin(r, src, Utils.clone);

  },

  // this both clones a node and inserts it at the same level of the DOM
  // as the element it was cloned from.
  // it returns a window.d3 selection of the cloned element
  cloneNode: function(selector) {
    var node = window.d3.select(selector).node();
    return window.d3.select(node.parentNode.insertBefore(node.cloneNode(true), node.nextSibling));
  },

  convertToArray: function(object) {
    var array = null;
    if (Utils.getObjectType(object) === 'Object') {
      array = [];
      array.push(object);
      return array;
    } else {
      if (Utils.getObjectType(object) === 'Array') {
        return object;
      } else {
        if (Utils.getObjectType(object) === 'String') {
          array = [];
          array.push(object);
          return array;
        }
      }
    }
  },

  getObjectType: function(object) {
    var result;
    if (Object.prototype.toString.call(object) === '[object Object]') {
      result = 'Object';
    } else {
      if (Object.prototype.toString.call(object) === '[object Array]') {
        result = 'Array';
      } else {
        if (Object.prototype.toString.call(object) === '[object String]') {
          result = 'String';
        }
      }
    }
    return result;
  },

  getTextDirection: function(text) {
    /**
     * From
     * http://stackoverflow.com/questions/7770235/
     *    change-text-direction-of-textbox-automatically
     * What about Chinese characters that go top to bottom?
     */
    var x =  new RegExp('[\x00-\x80]+'); // is ascii

    var isAscii = x.test(text);

    var direction;
    if (isAscii) {
      direction = 'ltr';
    } else {
      direction = 'rtl';
    }

    return direction;
  },

  getUriParam: function(name) {
    // Thanks to http://stackoverflow.com/questions/11582512/
    // how-to-get-uri-parameters-with-javascript
    // This will be replaced once we get the backend php to get the json
    var parameter = decodeURIComponent(
        (new RegExp('[?|&]' + name + '=([^&;]+?)(&|#|;|$)').exec(location.search) || ['', ''])[1]
          .replace(/\+/g, '%20')) || null;
    if (!!parameter) {
      return parameter;
    } else {
      console.warn('Warning: URL parameter "' + name + '" is null.');
      return null;
    }
  },

  getWindowDimensions: function() {
    var winW = 630;
    var winH = 460;
    if (document.body && document.body.width) {
      winW = document.body.width;
      winH = document.body.height;
    }
    if (document.compatMode === 'CSS1Compat' &&
        document.documentElement &&
        document.documentElement.width) {
      winW = document.documentElement.width;
      winH = document.documentElement.height;
    }
    if (window.innerWidth && window.innerHeight) {
      winW = window.innerWidth;
      winH = window.innerHeight;
    }
    return {'width': winW, 'height': winH};
  },

  intersect: function(a, b) {
    // modified version of https://github.com/juliangruber/intersect/blob/master/index.js
    var res = [];
    for (var i = 0; i < a.length; i++) {
      if (b.indexOf(a[i]) > -1) {
        res.push(a[i]);
      }
    }
    return res;
  },

  isIE: function() {
    var myNav = navigator.userAgent.toLowerCase();
    return (myNav.indexOf('msie') !== -1) ?
      parseInt(myNav.split('msie')[1], 10) : false;
  },

  // see http://stackoverflow.com/questions/18082/validate-numbers-in-javascript-isnumeric
  isNumber: function(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  },

  isOdd: function(num) {
    return num % 2;
  },

  isWikiPathwaysId: function(data) {
    data = data.trim();
    return data.substr(0, 2).toUpperCase() === 'WP' &&
      Utils.isNumber(data.substr(data.length - 1));
  },

  // TODO are we using this anymore?
  loadScripts: function(array, callback) {
    var loader = function(src, handler) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = script.onreadystatechange = function() {
        script.onreadystatechange = script.onload = null;
        if (/MSIE ([6-9]+\.\d+);/.test(navigator.userAgent)) {
          window.setTimeout(function() {handler();}, 8, this);
        } else {
          handler();
        }
      };
      var head = document.getElementsByTagName('head')[0];
      (head || document.body).appendChild(script);
    };
    (function _handler() {
      if (array.length !== 0) {
        loader(array.shift(), _handler);
      } else {
        if (callback) {
          callback();
        }
      }
    })();
  },

  moveArrayItem: function(arr, oldIndex, newIndex) {
    // from http://stackoverflow.com/questions/5306680/
    // move-an-array-element-from-one-array-position-to-another
    if (newIndex >= arr.length) {
      var k = newIndex - arr.length;
      while ((k--) + 1) {
        arr.push(undefined);
      }
    }
    arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
    return arr; // for testing purposes
  },

  splitStringByNewLine: function(str) {
    // PathVisio (Java) uses '&#xA;' for indicating newline, and browsers
    // convert this into '\r\n' or '\n' in JavaScript.
    return str.split(/\r\n|\r|\n/g);
  },

  strToHtmlId: function(str) {
    var re = /\W/gi;
    return str.replace(re, '');
  },

  // from here: http://www.cjboco.com/blog.cfm/post/
  // determining-an-elements-width-and-height-using-javascript/
  // TODO have not tested x-browser yet.
  getElementWidth: function(element) {
    if (typeof element.clip !== 'undefined') {
      return element.clip.width;
    } else {
      if (element.style.pixelWidth) {
        return element.style.pixelWidth;
      } else {
        return element.width;
      }
    }
  },

  getElementHeight: function(element) {
    if (typeof element.clip !== 'undefined') {
      return element.clip.height;
    } else {
      if (element.style.pixelHeight) {
        return element.style.pixelHeight;
      } else {
        return element.height;
      }
    }
  },

  addClassForD3: function($element, className) {
    var elementClass = $element.attr('class') || '';

    // There are not classes at all
    if (elementClass.match(/[^\s]+/g) === null) {
      $element.attr('class', className);
    // Element has no such class
    } else if (elementClass.match(/[^\s]+/g).indexOf(className) === -1) {
      $element.attr('class', elementClass + ' ' + className);
    }
  },

  removeClassForD3: function($element, className) {
    var elementClass = $element.attr('class') || '';
    var classes = elementClass.match(/[^\s]+/g);

    // Remove that class from list and join class name back
    if (classes !== null  && classes.indexOf(className) !== -1) {
      classes = _.filter(classes, function(_class) {return _class !== className;});
      $element.attr('class', classes.join(' '));
    }
  },

  proxy: function(fn, context) {
    return function() {
      fn.apply(context, arguments);
    };
  },

  convertToCssClassName: function(inputString) {
    var cssClassName = Strcase.paramCase(inputString);
    //var cssClassName = (inputString).replace(/[^(\w|\-)]/g, '').toLowerCase();
    // to make valid cssClassName per HTML4 spec, I'm ensuring the first character is a letter
    if (!/^[a-zA-Z]/.test(cssClassName)) {
      cssClassName = 'class-' + cssClassName;
    }
    return cssClassName;
  },

  convertToCSSId: function(inputString) {
    var id = Strcase.paramCase(inputString);
    //var id = (inputString).replace(/[^(\w|\-)]/g, '').toLowerCase();
    // to make valid id per HTML4 spec, I'm ensuring the first character is a letter
    if (!/^[a-zA-Z]/.test(id)) {
      id = 'id-' + id;
    }
    return id;
  },

  /**
   * Checks if an object is a DOM element
   *
   * @param  {object}  o HTML element or String
   * @return {Boolean}   returns true if object is a DOM element
   */
  isElement: function(o) {
    return (
      typeof HTMLElement === 'object' ?
        (o instanceof HTMLElement ||
         o instanceof SVGElement ||
         o instanceof SVGSVGElement) : //DOM2
        o && typeof o === 'object' && o !== null &&
        o.nodeType === 1 &&
        typeof o.nodeName === 'string'
    );
  }
};

module.exports = Utils;
