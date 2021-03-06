/**
 * Tracer's resource loader and manager
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @memberOf __resource
 * @type resource
 * 
 * @include "xsl_tracer.js"
 * @include "error-names.js"
 */var resource = (/** @constructor */ function(){
	var resources = {},
		/** How many files is currently loading or in load queue */
		files_loading = 0,
		res_id = 0,
		timer;
		
	/**
	 * Reserves resource slot in resource collection in order to preserve load 
	 * queue indexes
	 * @param {String} dict_name Dictionary name where to reserve slot
	 * @return {Number}
	 */
	function reserveResourceSlot(dict_name) {
		if (!(dict_name in resources)) {
			resources[dict_name] = [];
		}
		
		resources[dict_name].push(0);
		return resources[dict_name].length - 1;
	}
		
	/**
	 * Add loaded resource to collection
	 * @param {String} dict_name Dictionary name where to add resource
	 * @param {String|Object} data Resource content
	 * @param {String|Number} [res_name] Resource name/url under which it should be saved.
	 * If this argument is ommited, the resource name will be generatied 
	 * automatically.
	 */
	function addResource(dict_name, data, res_name, slot) {
		if (typeof res_name == 'undefined')
			res_name = 'obj' + (++res_id);
			
		if (!(dict_name in resources)) {
			resources[dict_name] = [];
		}
		
		var r = {
			name: res_name,
			data: data
		};
		
		if (typeof slot != 'undefined')
			resources[dict_name][slot] = r;
		else
			resources[dict_name].push(r);
	}
	
	/**
	 * Common file load callback function
	 */
	function loadCallback() {
		if (--files_loading < 1) {
			if (timer)
				clearTimeout(timer);
				
			timer = setTimeout(function() {
				xsl_tracer.dispatchEvent(EVT_LOAD_COMPLETE);
			}, 100);
		}
	}
	
	function getResource(dict_name, res_name) {
		if (!isNaN( parseInt(res_name) )) {
			// asking for resource by its collection index
			return resources[dict_name][parseInt(res_name)] || null;
		} else {
			// asking for resource by its name
			var r = resources[dict_name];
			for (var i = 0, il = r.length; i < il; i++) {
				if (r[i].name == res_name)
					return r[i];
			}
		}
		
		return null;
	}
	
	/**
	 * Check if passed url has the same domain as the current one
	 * @param {String} url
	 * @return {Boolean}
	 */
	function isSameDomain(url) {
		url = utils.trim(url);
		var m = url.match(/^http:\/\/(.+?)(?:\/|$)/i);
		if (m) {
			var url_host = m[1];
			if (url_host.indexOf('@') != -1) {
				// remove username/password
				url_host = url_host.split('@')[1];
			}
			
			return url_host.toLowerCase() == location.host.toLowerCase();
		}
		
		return true; // looks like relative path
	}
	
	/**
	 * Returns proxied url for cross-domain ajax resource loading
	 * @param {String} url Url to proxy
	 * @return {String|null|
	 */
	function getProxiedUrl(url) {
		var proxy = xsl_tracer.getProxyUrl();
		return proxy ? proxy.replace('%s', encodeURIComponent(url)) : null;
	}
	
	function loadAjax(url, slot, dict_name, callback) {
		// force data type to 'text', content parsing should occur 
		// when all documents are loaded
		
		var load_url = url;
		if (!isSameDomain(url))
			load_url = getProxiedUrl(url);
			
		$.ajax({
			dataType : 'text', 
			error : function(/* XmlHttpRequest*/ xhr, text_status, error_thrown) {
				xsl_tracer.dispatchEvent(EVT_LOAD_FILE_ERROR, {
					url: url,
					error_code: error_thrown,
					error_data: text_status
				});
				
				loadCallback();
			},

			success : function(data) {
				addResource(dict_name, data, url, slot);
				xsl_tracer.dispatchEvent(EVT_LOAD_FILE_COMPLETE, {url: url});
				if (callback)
					callback(data, url);
					
				loadCallback();
			},
			type : 'get',
			url : load_url || url
		});
	}
	
	/**
	 * Load data using YQL (for cross-domain ajax)
	 */
	function loadYQL(url, slot, dict_name, callback) {
		$.getJSON("http://query.yahooapis.com/v1/public/yql?"
				+ "q=select%20*%20from%20xml%20where%20url%3D%22"
				+ encodeURIComponent(url)
				+ "%22&format=xml&callback=?",
				
			function(data) {
				if (data.results[0]) {
					addResource(dict_name, data.results[0], url, slot);
					xsl_tracer.dispatchEvent(EVT_LOAD_FILE_COMPLETE, {url: url});
					if (callback)
						callback(data.results[0], url);
						
					loadCallback();
				} else {
					xsl_tracer.dispatchEvent(EVT_LOAD_FILE_ERROR, {
						url: url,
						error_code: -1,
						error_data: "Can't load data using YQL"
					});
				}
			});
	}
	
	return {
		/**
		 * Load external resource and store it as a part of <code>dict_name</code>
		 * dictionary
		 * @memberOf resource
		 * @param {String|Object} url Resource's URL. Passing other that 'string'
		 * object type means resource already loaded and should be added to the
		 * resource collection as is.
		 * @param {String} dict_name Resource's dictionary name
		 * @parama {Function} [callback] 
		 */
		load: function(url, dict_name, callback) {
			if (typeof url != 'string') {
				// passing already loaded resource
				var data = url;
				if (url instanceof Element) {
					data = utils.unescapeHTML(url.innerHTML);
				}
				
				addResource(dict_name, data);
				if (callback)
					callback(data);
			} else {
				var slot = reserveResourceSlot(dict_name);
				++files_loading;
				xsl_tracer.dispatchEvent(EVT_LOAD_FILE_START, {url: url});
				
				if (isSameDomain(url) || xsl_tracer.getProxyUrl())
					loadAjax(url, slot, dict_name, callback);
				else
					loadYQL(url, slot, dict_name, callback);
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
				var res = getResource(dict_name, res_name);
				return res ? res.data : null;
			}
		},
		
		/**
		 * Returns single resource's name/url
		 * @param {Stirng|Object} dict_name Resource dictionary or trace resource
		 * reference
		 * @param {String|Number} res_name Resource name/url or index
		 * @return {String|null}
		 */
		getResourceName: function(dict_name, res_name) {
			if (typeof dict_name == 'object') {
				// passing trace resource reference
				res_name = dict_name.i;
				dict_name = dict_name.v;
			}
			
			var res = getResource(dict_name, res_name);
			return res ? res.name : null;
		},
		
		/**
		 * Returns resource DOM element by xpath specified in <code>trace_info</code>
		 * @param {Object} trace_info Tracing resource reference
		 * @return {Element}
		 */
		getResourceElement: function(trace_info) {
			if (trace_info) {
				var res = this.getResource(trace_info.v, trace_info.i);
				if (res)
					return utils.xpathFind(trace_info.xpath, res);
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
	};
})();