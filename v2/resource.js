/**
 * Tracer's resource loader and manager
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "xsl_tracer.js"
 * @include "error-names.js"
 */var resource = (function(){
	var resources = {},
		/** How many files is currently loading or in load queue */
		files_loading = 0,
		res_id = 0;
		
	/**
	 * Add loaded resource to collection
	 * @param {String} dict_name Dictionary name where to add resource
	 * @param {String|Object} data Resource content
	 * @param {String|Number} [res_name] Resource name/url under which it should be saved.
	 * If this argument is ommited, the resource name will be generatied 
	 * automatically.
	 */
	function addResource(dict_name, data, res_name) {
		if (typeof res_name == 'undefined')
			res_name = 'obj' + (++res_id);
			
		if (!(dict_name in resources)) {
			resources[dict_name] = [];
		}
		
		resources[dict_name].push({
			name: name,
			data: data
		});
	}
	
	/**
	 * Common file load callback function
	 */
	function loadCallback() {
		if (--files_loading < 1)
			xsl_tracer.dispatchEvent(EVT_LOAD_COMPLETE);
	}
	
	return {
		/**
		 * Load external resource and store it as a part of <code>dict_name</code>
		 * dictionary
		 * @param {String|Object} url Resource's URL. Passing other that 'string'
		 * object type means resource already loaded and should be added to the
		 * resource collection as is.
		 * @param {String} dict_name Resource's dictionary name
		 * @parama {Function} [callback] 
		 */
		load: function(url, dict_name, callback) {
			console.log('get', url);
			if (typeof url != 'string') {
				// passing already loaded resource
				addResource(dict_name, url);
				if (callback)
					callback(data, url);
			} else {
				++files_loading;
				xsl_tracer.dispatchEvent(EVT_LOAD_FILE_START, {url: url});
				
				// force data type to 'text', content parsing should occur 
				// when all documents are loaded
				$.ajax({
					dataType : 'text', 
					error : function(/* XmlHttpRequest*/ xhr, text_status, error_thrown) {
						xsl_tracer.dispatchEvent(EVT_LOAD_FILE_ERROR, {
							url: url,
							error_code: error_thrown,
							error_status: text_status
						});
						
						loadCallback();
					},
		
					success : function(data) {
						addResource(dict_name, data, url);
						xsl_tracer.dispatchEvent(EVT_LOAD_FILE_COMPLETE, {url: url});
						if (callback)
							callback(data, url);
							
						loadCallback();
					},
					type : 'get',
					url : url
				});
			}
		},
		
		/**
		 * Returns single resource or list of resources if <code>res_name</code>
		 * is ommited
		 * @param {Stirng} dict_name Resource dictionary
		 * @param {String|Number} [res_name] Resource name/url or index
		 * @return {String|Object|null}
		 */
		getResource: function(dict_name, res_name) {
			if (typeof res_name == 'undefined') {
				return resources[dict_name];
			} else {
				if (!isNaN( parseInt(res_name) )) {
					// asking for resource by its collection index
					var r = resources[dict_name][parseInt(res_name)];
					return r ? r.data : null;
				} else {
					// asking for resource by its name
					var r = resources[dict_name];
					for (var i = 0, il = r.length; i < il; i++) {
						if (r[i].name == res_name)
							return r[i].data;
					}
				}
			}
			
			return null;
		},
		
		/**
		 * Updates resource in collection
		 * @param {String} dict_name Resource's dictionary name
		 * @param {String|Number} res_name Resource's name or index in document
		 * @param {Object} data Resource's content
		 */
		setResource: function(dict_type, res_name, data) {
			if (!(dict_type in resources)) {
				addResource(dict_type, data, res_name);
			} else if (typeof res_name == 'number') {
				// update resource by its index
				var r = resources[dict_type];
				if (r[res_name])
					r[res_name].data = data;
				else
					r[res_name] = {
						name: 'obj' + (++res_id), 
						data: data
					};
			} else {
				// update resource by its name
				var r = resources[dict_type],
					is_set = false;
				for (var i = 0, il = r.length; i < il; i++) {
					if (r[i].name == res_name) {
						r[i].data = data;
						is_set = true;
						break;
					}
				}
				
				if (!is_set)
					addResource(dict_type, data, res_name);
			}
		}
	}
})();