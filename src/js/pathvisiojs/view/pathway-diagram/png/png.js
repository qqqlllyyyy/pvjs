"use strict";

pathvisiojs.view.pathwayDiagram.png = function(){

  function load(args, callback) {
    if (!args) {
      throw new Error("Missing input data.");
    }
    var wikiPathwaysId = args.parsedInputData.wikiPathwaysId,
      revision = args.parsedInputData.revision,
      target = args.target,
      containerWidth = args.width,
      containerHeight = args.height,
      pngUrl,
      png,
      pngWidth,
      pngHeight,
      fitScreenScale;

    if (!!wikiPathwaysId) {
      pngUrl = encodeURI(pathvisiojs.config.pngDiagramUriStub() + wikiPathwaysId + '&revision=' + revision);
    }
    else {
      pngUrl = pathvisiojs.config.diagramNotAvailableImageUri();
    }
    window.setTimeout(function() {
      png = document.createElement('img');
      png.src = pngUrl;
      png.onload = function() {
        pngWidth = this.width;
        pngHeight = this.height;
        fitScreenScale = Math.min(containerWidth/pngWidth, containerHeight/pngHeight);
        target.append('img')
        .attr('id', 'pathvisiojs-pathway-png')
        .attr('src', pngUrl)
        .attr('x', 0)
        .attr('y', 0)
        .attr('style', 'position:relative; left:'
              + (containerWidth - pngWidth * fitScreenScale)/2 + 'px; '
              + 'top:' + (containerHeight - pngHeight * fitScreenScale)/2 + 'px; ')
        .attr('width', pngWidth * fitScreenScale)
        .attr('height', pngHeight * fitScreenScale);
        callback(null);
      }
    }, 50);
  }

  return {
    load:load
  };
}();