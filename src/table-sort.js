/**
 * Sort table rows
 * @author Sergey Chikuyonok (serge.che@gmail.com) <http://chikuyonok.ru>
 */

/**
 * @type xt_table_sort
 * @memberOf __xt_table_sort
 */
var xt_table_sort = (/** @constructor */ function () {
	return {
		/**
		 * Sorts table by header cell
		 * @memberOf xt_table_sort
		 * @param {HTMLElement} cell Header cell (th)
		 * @param {String} order Sort order ('asc' or 'desc')
		 */
		sort: function(cell, order) {
			cell = $(cell);
			var header_cells = cell.parent().find('th');
			var cell_ix = header_cells.index(cell[0]);
			/** @type jQuery */
			var table = cell.closest('table');
			
			var rows = [];
			
			// create array of all rows
			table.find('tr').slice(1).each(function(i, n) {
				rows.push(n);
			});
			
			/**
			 * @returns jQuery
			 */
			var getCell = function(row) {
				return $(row).find('td').eq(cell_ix);
			};
			
			if (rows.length) {
				// choose proper sort algorithm
				var ref_cell = $(rows[0]).find('td').eq(cell_ix), 
					sort_fn;
				if (order == 'asc') {
					if (ref_cell.attr('data-sort')) {
						sort_fn = function(a, b) {
							return parseFloat(getCell(a).attr('data-sort')) - parseFloat(getCell(b).attr('data-sort'));
						};
					} else {
						sort_fn = function(a, b) {
							return getCell(a).text() < getCell(b).text() ? -1 : 0;
						};
					}
				} else {
					if (ref_cell.attr('data-sort')) {
						sort_fn = function(a, b) {
							return parseFloat(getCell(b).attr('data-sort')) - parseFloat(getCell(a).attr('data-sort'));
						};
					} else {
						sort_fn = function(a, b) {
							return getCell(a).text() < getCell(b).text() ? 0 : -1;
						};
					}
				}
			}
			
			rows = rows.sort(sort_fn);
			var frag = document.createDocumentFragment();
			for (var i = 0, il = rows.length; i < il; i++) {
				frag.appendChild(rows[i]);
			}
			
			table.append(frag);
			header_cells.removeClass('selected xt-sort-desc xt-sort-asc');
			cell.addClass('selected xt-sort-' + order);
		}
	};
})();