/***********************************
 * xrefSpecifier
 **********************************/

var _ = require('lodash');
var datasetControl = require('./dataset-control');
var displayNameControl = require('../../../sub-components/display-name-control');
var editorUtils = require('../../../editor-utils');
var fs = require('fs');
var XrefSearch = require('./xref-search');
var xrefTypeControl = require('./xref-type-control');
var highland = require('highland');
var identifierControl = require('./identifier-control');
var m = require('mithril');
var mithrilUtils = require('../../../../mithril-utils');

var xrefSpecifier = {};
var xrefSearch;

xrefSpecifier.ItemList = Array;

xrefSpecifier.Item = function(item) {
  this.id = m.prop(item.id);
  this.name = m.prop(item.name);
}

xrefSpecifier.vm = (function() {

  var selectedPvjsElement;
  var selectedXref;

  var vm = {};
  vm.init = function(pvjs) {
    xrefSpecifier.vm.saveButtonClass = 'btn-default';

    xrefSearch = new XrefSearch(xrefSpecifier);

    /***********************************************
     * DataNode onclick event handler
     **********************************************/

    var diagramContainer = document.querySelector('.diagram-container');
    diagramContainer.addEventListener('click', editorOnClickDiagramContainer, false);

    function editorOnClickDiagramContainer(event) {
      m.startComputation();

      // TODO this is a kludge. refactor.
      xrefSpecifier.vm.saveButtonClass = 'btn-success';

      var selectedElementId = event.target.id;

      selectedPvjsElement = pvjs.sourceData.pvjson.elements.filter(function(pvjsElement) {
        return pvjsElement.id === selectedElementId;
      })
      .map(function(pvjsElement) {
        return pvjsElement;
      })[0];

      if (!selectedPvjsElement) {
        m.endComputation();
        return;
      }

      selectedXref = _.find(pvjs.sourceData.pvjson.elements,
          function(pvjsElement) {
            return pvjsElement.id === selectedPvjsElement.entityReference;
          });

      if (!selectedXref) {
        m.endComputation();
        return;
      }

      // TODO next section is a kludge. refactor to not display annotation panel in edit mode.
      event.preventDefault();
      document.querySelector('.annotation').style.display = 'none';
      window.setTimeout(function() {
        document.querySelector('.annotation').style.visibility = 'hidden';
        document.querySelector('.annotation').style.display = null;
      }, 2000);

      var iri = selectedPvjsElement.entityReference;
      var iriComponents = iri.split('identifiers.org');
      var iriPath = iriComponents[iriComponents.length - 1];
      var iriPathComponents = iriPath.split('/');
      var preferredPrefix = iriPathComponents[1];
      var identifier = iriPathComponents[2];

      var datasetId = 'http://identifiers.org/' + preferredPrefix;
      selectedXref.isDataItemIn = {id: datasetId};

      selectedXref.identifier = identifier;

      var entity = editorUtils.convertXrefToPvjsEntity(selectedXref);
      xrefSpecifier.vm.updateControlValues(entity);

      m.endComputation();
    }

    vm.save = function() {
      xrefSpecifier.vm.saveButtonClass = 'btn-default';
      var xrefType = xrefTypeControl.vm.currentXrefType.name();
      var datasetName = datasetControl.vm.currentDataset.name();
      var identifier = identifierControl.vm.identifier();
      var displayName = displayNameControl.vm.displayName();

      // TODO this isn't exactly matching the current pvjson model
      selectedPvjsElement['gpml:Type'] = 'gpml:' + xrefType;
      selectedPvjsElement.textContent = displayName;

      // TODO If the actual entity reference is changed, update
      // the link to the new entity reference, adding it if it
      // doesn't already exist.
      selectedXref.dbName = datasetName;
      selectedXref.dbId = identifier;
      selectedXref.displayName = displayName;

      updateXrefsInGpml(
          pvjs, selectedPvjsElement.id, xrefType, datasetName, identifier, displayName);
    }

    vm.cancel = function() {
      xrefSpecifier.vm.saveButtonClass = 'btn-default';
      xrefTypeControl.vm.currentXrefType.id = m.prop('');
      datasetControl.vm.currentDataset.id = m.prop('');
      identifierControl.vm.identifier = m.prop('');
      displayNameControl.vm.displayName = m.prop('');
      selectedPvjsElement = null;
      pvjs.editor.close();
      diagramContainer.removeEventListener('click', editorOnClickDiagramContainer);
    }

    xrefSearch.vm.init();
    xrefTypeControl.vm.init();
    datasetControl.vm.init();
    identifierControl.vm.init();
    displayNameControl.vm.init();
  }

  /**
   * update the dropdowns and input boxes that
   * identify and/or describe an entity.
   *
   * @param {object} entity
   * @param {string} entity.type Type
   * @param {string} entity.displayName Short name for display
   * @param {string} entity.identifier Character string that differentiates this
   *                                          entity from other entitys.
   * @param {object} entity.isDataItemIn Dataset of which this entity
   *                                              reference is a member
   * @param {string} entity.isDataItemIn.id IRI
   * @param {string} entity.isDataItemIn.displayName Short name for display
   * @return
   */
  vm.updateControlValues = function(entity) {
    xrefTypeControl.vm.changeXrefType(entity.type);
    datasetControl.vm.changeDataset(entity.isDataItemIn.id);
    identifierControl.vm.identifier = m.prop(entity.identifier);
    displayNameControl.vm.displayName = m.prop(entity.displayName);
  }

  return vm;
})();

xrefSpecifier.controller = function() {
  xrefSpecifier.vm.init();
}

xrefSpecifier.view = function() {
  return m('nav.pathvisiojs-editor-annotation.navbar.navbar-default.navbar-form.well.well-sm', [
    m('div.form-group.navbar-left', [
      xrefSearch.view(),
    ]),
    m('div.form-group.well.well-sm.navbar-left', [
      xrefTypeControl.view(),
      datasetControl.view(),
      identifierControl.view(),
      displayNameControl.view(),
    ]),
    m('div.form-group.well.well-sm.navbar-left', [
      m('button[type="submit"].btn.btn-sm.' + xrefSpecifier.vm.saveButtonClass, {
        onclick: xrefSpecifier.vm.save
      }, [
        m('span.glyphicon.glyphicon-ok')
      ]),
    ]),
    m('span.glyphicon.glyphicon-remove.navbar-right[style="color: #aaa;"]', {
      onclick: xrefSpecifier.vm.cancel
    })
  ]);
}

/***********************************************
 * Temporary solution for handling updates
 * to GPML DataNode Xrefs.
 * The long-term solution will be to convert
 * the pvjson to GPML.
 **********************************************/
function updateXrefsInGpml(pvjs, selectedElementId, xrefType,
    datasetName, identifier, displayName) {
  if (!datasetName || !identifier) {
    throw new Error('Missing datasetName and/or identifier for updateXrefsInGpml');
  }

  var gpmlDoc = pvjs.sourceData.original;

  var textLabelElement = pvjs.$element.select('#text-for-' + selectedElementId)
    .select('text').text(displayName);

  var dataNodeElement = gpmlDoc.find('DataNode[GraphId="' + selectedElementId + '"]');
  var xrefElement = dataNodeElement.find('Xref');

  dataNodeElement.attr('Type', xrefType);
  dataNodeElement.attr('TextLabel', displayName);

  xrefElement.attr('Database', datasetName);
  xrefElement.attr('ID', identifier);

  console.log('');
  console.log('');
  console.log('');
  console.log('*********************************************************************');
  console.log('*********************************************************************');
  console.log('');
  console.log('Updated GPML file as string:');
  console.log('');
  console.log(gpmlDoc.html());
  console.log('');
  console.log('*********************************************************************');
  console.log('*********************************************************************');
  console.log('');

  console.log('You successfully performed a local update for a GPML DataNode.')
  console.log('It now has the following values:');
  console.log('GraphId: ' + selectedElementId);
  console.log('TextLabel: ' + displayName);
  console.log('Type: ' + xrefType);
  console.log('Database: ' + datasetName);
  console.log('ID: ' + identifier);
}

module.exports = xrefSpecifier;
