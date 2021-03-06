import Handsontable from './../../browser';
import {addClass, removeClass} from './../../helpers/dom/element';
import {registerRenderer, getRenderer} from './../../renderers';

/**
 * @private
 * @plugin Search
 */
Handsontable.Search = function Search(instance) {
  this.queryNext = function(queryStr, queryMethod, async_callback) {
    var rowCount = instance.countRows() + 1; // +1 for column header row
    var colCount = instance.countCols();
    var queryResult = [];

    if (!queryMethod) {
      queryMethod = Handsontable.Search.global.getDefaultQueryMethod();
    }

    var selectedCells = instance.getSelected(),
        startRow = -1,
        startCol = 0,
        processedRows = 0;

    if (selectedCells) {
      if (selectedCells[0] == 0 && selectedCells[1] == selectedCells[3] && instance.countRows() == (selectedCells[2] + 1)){
        startRow = -1;
        startCol = selectedCells[1] + 1;
      } else {
        startRow = selectedCells[0];
        startCol = selectedCells[1] + 1;
      }
    }

    function batchSearch(startRow, startCol, async_callback) {
      var last_row = startRow;
      for (var rowIndex = startRow; rowIndex < (startRow + 100) && processedRows <= rowCount; rowIndex++) {
        for (var colIndex = startCol; colIndex < colCount; colIndex++) {
          var cellData;

          if (rowIndex < 0){
            cellData = instance.getColHeader(colIndex);
          } else {
            cellData = instance.getDataAtCell(rowIndex, colIndex);
          }

          var cellProperties = instance.getCellMeta(rowIndex, colIndex);
          var cellQueryMethod = cellProperties.search.queryMethod || queryMethod;
          var testResult = cellQueryMethod(queryStr, cellData);
          if (testResult) {
            var singleResult = {
              row: rowIndex,
              col: colIndex,
              data: cellData
            };
            queryResult.push(singleResult);
          }

          if (testResult) {
            async_callback(queryResult[0]);
            return;
          }
        }
        startCol = 0;
        processedRows++;
        if (rowIndex == rowCount - 2) {
          rowIndex = -2;
        }
        if (queryResult.length > 0) {
          async_callback(queryResult);
          return;
        }
        last_row = rowIndex + 1;
      }

      if (queryResult.length > 0) {
        async_callback(queryResult);
      } else if (processedRows > rowCount) {
        async_callback(undefined);
      } else {
        setTimeout(function() {
          batchSearch(last_row, 0, async_callback);
        }, 0);
      }
    };

    setTimeout(function() {
      batchSearch(startRow, startCol, async_callback);
    }, 0);

    return queryResult;
  };

  this.query = function(queryStr, callback, queryMethod) {
    var rowCount = instance.countRows();
    var colCount = instance.countCols();
    var queryResult = [];

    if (!callback) {
      callback = Handsontable.Search.global.getDefaultCallback();
    }

    if (!queryMethod) {
      queryMethod = Handsontable.Search.global.getDefaultQueryMethod();
    }

    for (var rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      for (var colIndex = 0; colIndex < colCount; colIndex++) {
        var cellData = instance.getDataAtCell(rowIndex, colIndex);
        var cellProperties = instance.getCellMeta(rowIndex, colIndex);
        var cellCallback = cellProperties.search.callback || callback;
        var cellQueryMethod = cellProperties.search.queryMethod || queryMethod;
        var testResult = cellQueryMethod(queryStr, cellData);

        if (testResult) {
          var singleResult = {
            row: rowIndex,
            col: colIndex,
            data: cellData,
          };

          queryResult.push(singleResult);
        }

        if (cellCallback) {
          cellCallback(instance, rowIndex, colIndex, cellData, testResult);
        }
      }
    }

    return queryResult;
  };
};

Handsontable.Search.DEFAULT_CALLBACK = function(instance, row, col, data, testResult) {
  instance.getCellMeta(row, col).isSearchResult = testResult;
};

Handsontable.Search.DEFAULT_QUERY_METHOD = function(query, value) {
  if (typeof query == 'undefined' || query == null || !query.toLowerCase || query.length === 0) {
    return false;
  }
  if (typeof value == 'undefined' || value == null) {
    return false;
  }

  return value.toString().toLowerCase().indexOf(query.toLowerCase()) != -1;
};

Handsontable.Search.DEFAULT_SEARCH_RESULT_CLASS = 'htSearchResult';

Handsontable.Search.global = (function() {

  var defaultCallback = Handsontable.Search.DEFAULT_CALLBACK;
  var defaultQueryMethod = Handsontable.Search.DEFAULT_QUERY_METHOD;
  var defaultSearchResultClass = Handsontable.Search.DEFAULT_SEARCH_RESULT_CLASS;

  return {
    getDefaultCallback: function() {
      return defaultCallback;
    },

    setDefaultCallback: function(newDefaultCallback) {
      defaultCallback = newDefaultCallback;
    },

    getDefaultQueryMethod: function() {
      return defaultQueryMethod;
    },

    setDefaultQueryMethod: function(newDefaultQueryMethod) {
      defaultQueryMethod = newDefaultQueryMethod;
    },

    getDefaultSearchResultClass: function() {
      return defaultSearchResultClass;
    },

    setDefaultSearchResultClass: function(newSearchResultClass) {
      defaultSearchResultClass = newSearchResultClass;
    }
  };

})();

Handsontable.SearchCellDecorator = function(instance, TD, row, col, prop, value, cellProperties) {
  var searchResultClass = (cellProperties.search !== null && typeof cellProperties.search == 'object' &&
      cellProperties.search.searchResultClass) || Handsontable.Search.global.getDefaultSearchResultClass();

  if (cellProperties.isSearchResult) {
    addClass(TD, searchResultClass);
  } else {
    removeClass(TD, searchResultClass);
  }
};

var originalBaseRenderer = getRenderer('base');

registerRenderer('base', function(instance, TD, row, col, prop, value, cellProperties) {
  originalBaseRenderer.apply(this, arguments);
  Handsontable.SearchCellDecorator.apply(this, arguments);
});

function init() {
  /* jshint ignore:start */
  var instance = this;
  /* jshint ignore:end */

  var pluginEnabled = !!instance.getSettings().search;

  if (pluginEnabled) {
    instance.search = new Handsontable.Search(instance);
  } else {
    delete instance.search;
  }
}

Handsontable.hooks.add('afterInit', init);
Handsontable.hooks.add('afterUpdateSettings', init);
