/**
 * Gets performance data from trace result and builds timer table
 * @author Sergey Chikuyonok (serge.che@gmail.com) <http://chikuyonok.ru>
 */

/**
 * @type performance
 * @memberOf __performance
 */
var performance = (/** @constructor */ function () {
	/**
	 * Processed performance data
	 * @type Array
	 */
	var data = null;
	
	var allowed_tags = {
		'xsl:template': 1,
		'xsl:call-template': 1,
		'xsl:apply-templates': 1,
		'xsl:copy-of': 1
	};
	
	/**
	 * Recursive function that collects performance data from trace document. 
	 * The result is stored in <code>data</code> object
	 * @param {Object} doc Trace document
	 * @param {Object} data Object reference where data will be stored
	 * @returns {Object} Collected data, key is element's xpath
	 */
	function collectData(doc, data) {
		var total_time = 0;
		
		if (doc.children) {
			utils.each(doc.children, function(i, n) {
				var inner_time = collectData(n, data);
				if (n.type === 'XSL' && n.name in allowed_tags) {
					var key = n.src.xpath;
					if (!(key in data)) {
						data[key] = {
							name: n.name,
							trace: n,
							inner_time: [],
							time: []
						};
					}
					
					data[key].time.push(n.time);
					data[key].inner_time.push(inner_time);
				}
				
				total_time += n.time || 0;
			});
		}
		
		return total_time;
	}
	
	/**
	 * Creates performance table
	 * @param {Object} data Collected data returned from {@link collectData} 
	 * function
	 * @returns Array
	 */
	function createTable(data) {
		var result = [];
		
		for (var k in data) if (data.hasOwnProperty(k)) {
			var n = data[k];
			var len = n.time.length;
			
			if (!len) continue;
			
			// find min, max and total time
			var min = n.time[0], max = n.time[0], total = 0, inner = 0;
			utils.each(n.time, function(i, j) {
				if (j < min) min = j;
				if (j > max) max = j;
				total += j;
			});
			
			utils.each(n.inner_time, function(i, j) {
				inner += j;
			});
			
			result.push({
				name: n.name,
				trace: n.trace,
				xpath: k,
				calls: len,
				min: min,
				max: max,
				avg: len ? total / len : 0,
				total: total,
				own: total - inner
			});
		}
		
		return result;
	}
	
	
	
	return {
		/**
		 * Returns preprocessed performance data from trace result
		 * @memberOf performance
		 * @returns Array
		 */
		getData: function() {
			if (!data) {
				var doc = resource.getResource('trace');
				var tmpl = {};
				collectData(doc[0].data, tmpl);
				
				data = createTable(tmpl);
				data = data.sort(function(a, b) {
					return b.own - a.own;
				});
			}
			
			return data;
		}
	};
})();