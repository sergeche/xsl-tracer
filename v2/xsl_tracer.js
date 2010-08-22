/**
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "./lib/EventDispatcher.js"
 * @include "./lib/json2.js"
 * @include "event-names.js"
 * @include "utils.js"
 * @include "resource.js"
 */var xsl_tracer = (function(){
	/** 
	 * Main event dispatcher. Most of tracer features and UI components are 
	 * binded to events. See <code>event-names.js</code> for a list of available
	 * events. 
	 */
	var dispatcher = new EventDispatcher(),
		/** @type {String} Path to XSL templates root folder */
		templates_root,
		/** List of RLE elements from tracing document */
		trace_lre = [],
		/** Wether or not errors occured during tracer initialization */
		has_errors = false;
		
	/**
	 * Resolves path to file name, making it usable for downloading
	 * (i.e. make absolute path for document). You can update this resolver
	 * with <code>xsl_tracer.setPathResolver()</code> method
	 * 
	 * @param {String} filename File name
	 * @param {String} type Document type (xsl, dtd, xml) to resolve path for
	 * @return {String}
	 */
	var resolvePath = function(filename, type) {
		return utils.resolvePath(templates_root, filename);
	}
	
	/**
	 * Remove entity definitions and escape entity names so they don't
	 * break XML parsing
	 * @param {String} text
	 */
	function cleanupEntities(text) {
		return text
			.replace(/<\!DOCTYPE\s+xsl:stylesheet\s+SYSTEM\s+['"](.+?)['"]\s*>/i, '')
			.replace(/<\!DOCTYPE\s+xsl:stylesheet\s+\[((?:.|[\r\n])+?)\]\s*>/i, '')
			.replace(/&(?!#|x\d)/gi, '&amp;');
	}
	
	/**
	 * Relement all element's line and column positions for faster lookup
	 * @param {String} name
	 * @param {Document} doc
	 * @return {Array} List of indexed tags 
	 */
	function rememberElementLines(name, doc) {
		var result = [];
		utils.each(doc.getElementsByTagName('*'), function(i, n) {
			var lines = n.getAttribute('xsltrace-line').split('-'),
				cols = n.getAttribute('xsltrace-column').split('-')
				
			result.push({
				elem: n,
				start_line: parseInt(lines[0], 10),
				end_line: parseInt(lines[1] || lines[0], 10),
				start_column: parseInt(cols[0], 10),
				end_column: parseInt(cols[1] || cols[0], 10)
			});
		});
		
		result.sort(function(a, b) {
			return a.start_line - b.start_line
		});
		
		return result;
	}
	
	/**
	 * Removes extra data from XML document added by XSL tracer
	 * @param {Document} doc
	 * @return {Document}
	 */
	function cleanupDocument(doc) {
		utils.each(doc.getElementsByTagName('*'), function(i, /* Element */ n) {
			n.removeAttribute('xsltrace-line');
			n.removeAttribute('xsltrace-column');
		});
		
		return doc;
	}
	
	/**
	 * Search for element in XML file by its line and column
	 * @param {Document} XML/XSL module
	 * @param {Number} line Element's line
	 * @param {Number} col Element's column
	 * @return {Element}
	 */
	function searchTagByLineCol(doc, line, col) {
		line = parseInt(line, 10);
		col = parseInt(col, 10);
		var result;
		if (doc.__lines) {
			$.each(doc.__lines, function(i, n) {
				if (line >= n.start_line && line <= n.end_line && col >= n.start_column && col <= n.end_column) {
					result = n.elem;
					return false;
				}
			});
		}
		
		return result;
	}
	
	/**
	 * Walks through tracing docoment and call <code>callback</code> function
	 * on each element
	 * @param {Function} callback
	 * @param {Object} [doc]  
	 */
	function walkTraceDoc(callback, doc) {
		doc =  doc || resource.getResource('trace', 0);
		try {
			function walk(elem) {
				for (var i = 0, il = elem.children.length; i < il; i++) {
					if (callback(elem.children[i]) === false)
						throw "StopWalking";
					if (elem.children[i].children.length)
						walk(elem.children[i]);
				}
			}
			
			walk(doc);
		} catch (e) {}
	}
	
	/**
	 * Process all loaded documents and convert them to apropriate data type.
	 * Basically, it transforms all XML/XSL documents into a DOM tree
	 */
	function processDocuments() {
		// don't do anything if we have errors
		if (has_errors)
			return;
		
		var toXML = function(i, n) {
			var data = cleanupEntities(n.data);
			data = utils.toXML(data);
			
			if (!data) {
				has_errors = true;
				dispatcher.dispatchEvent(EVT_ERROR, {
					error_name: 'xml_parsing_error',
					error_data: data
				});
			} else {
				return n.data = data;
			}
		};
		
		// transform all XSL documents
		utils.each(resource.getResource('xsl'), function(i, n) {
			n.data = utils.markTagPositions(n.data);
			var data = toXML(i, n);
			data.__lines = rememberElementLines(n.name, data);
			n.data = cleanupDocument(data);
		});
		
		// transform all XML documents
		utils.each(resource.getResource('xml'), toXML);
		utils.each(resource.getResource('result'), toXML);
		
		processTraceDocument();
		
		if (!has_errors) {
			// extend result document with tracing data
			buildElementDependency(resource.getResource('result', 0));
			
			// tracer is ready
			dispatcher.dispatchEvent(EVT_COMPLETE);
		}
	}
	
	/**
	 * Processes tracing documents
	 */
	function processTraceDocument() {
		var walk = function(elem, parent) {
			elem.parent = parent || null;
			for (var i = 0, il = elem.children.length; i < il; i++)
				walk(elem.children[i], elem);
		};
		
		utils.each(resource.getResource('trace'), function(i, n) {
			if (typeof n.data == 'string')
				n.data = JSON.parse(n.data);
				
			walk(n.data);
		});
		
		// find all LRE elements
		trace_lre = [];
		walkTraceDoc(function(elem) {
			if (elem.tag === 'L' || elem.tag == 'xsl:element')
				trace_lre.push(elem);
		});
	}
	
	/**
	 * Search for parent node with specified name in tracing document
	 * @param {Element} elem
	 * @param {String} node_name
	 * @return {Element}
	 */
	function findParent(elem, node_name) {
		var result = null;
		do {
			if (elem.tag == node_name) {
				result = elem;
				break;
			}
		} while(elem = elem.parent);
		
		return result;
	}
	
	/**
	 * Search for template node for specified element
	 * @param {Element} elem
	 * @return {Element}
	 */
	function findTemplate(elem){
		if (!elem) return null;
		var meta = elem.meta;
		var res = resource.getResource('xsl', parseInt(meta.m, 10));
		var result = searchTagByLineCol(res, meta.l, meta.c);
		if (!result)
			console.error('resource chain broken');
		
		return result;
	}
	
	/**
	 * Search for data source for specified element 
	 * @param {Object} template_node
	 * @return {Element}
	 */
	function findSource(template_node){
		if (!template_node)
			return;
			
		// search for src element
		var src,
			el = template_node;
		do {
			if (el.src) {
				src = el.src;
				break;
			}
		} while(el = el.parent);
		
		
		if (!src || !src.x) 
			return null;
		
		var source_doc = resource.getResource('xml', src.f === 'SOURCE' ? 0 : parseInt(src.f, 10) + 1);
		return  utils.xpathFind(src.x, source_doc);
	}
	
	/**
	 * Links all tracing data into <code>__trace</code> expando propery for
	 * each element in result document
	 * @param {Document} doc 
	 */
	function buildElementDependency(doc){
		var result_elems = doc.getElementsByTagName('*');
		utils.each(trace_lre, function(i, /* Element */ node){
			// TODO научиться работать с комментариями, пришедшими в результатирующий документ
			var r = result_elems[i];
			
			if (r) {
				var template_node = findParent(node, 'xsl:template');
				r.__trace = {
					trace: node,
					source: findSource(template_node),
					module: template_node.meta.m,
					template: findTemplate(template_node),
					result: r
				};
			}
		});
		
		return doc;
	}
	
	/**
	 * Add event listener
	 * @param {String|Array} name Event name(s)
	 * @param {Function} fn Event listener
	 * @param {Boolean} [only_once] Event listener should be called only once
	 */
	function addEvent(name, fn, only_once) {
		if (typeof name == 'string')
			name = name.split(' ');
			
		for (var i = 0, il = name.length; i < il; i++) {
			dispatcher.addEventListener(name[i], fn, only_once);
		}
	}
	
	
	addEvent(EVT_LOAD_COMPLETE, processDocuments);
	addEvent([EVT_ERROR, EVT_LOAD_FILE_ERROR], function() {
		has_errors = true;
	});
	
	return {
		/**
		 * Init XSL tracer
		 * @param {Stirng} options.template_path Path to root XSL templates folder
		 * @param {String} options.source_url Path to source XML which is transformed by XSL
		 * @param {String|Object} options.trace_url Path or pointer to trace data
		 * @param {String|Element} options.result_url Path or pointer to result data
		 */
		init: function(options) {
			templates_root = options.template_path;
			this.dispatchEvent(EVT_INIT);
			
			// start document loading
			
			// we should load source document first in order to maintain
			// correct document's index positions
			resource.load(options.source_url, 'xml', function(data, url) {
				// ..then load tracing data
				resource.load(options.trace_url, 'trace', function(data) {
					if (typeof data == 'string') {
						data = JSON.parse(data);
						// save trace data
						resource.setResource('trace', 0, data);
					}
						
					// ...and now load all the rest external references
					utils.each(data['xsl'], function(i, n) {
						resource.load(resolvePath(n, 'xsl'), 'xsl');
					});
					
					utils.each(data['xml'], function(i, n) {
						resource.load(resolvePath(n, 'xml'), 'xml');
					});
					
					resource.load(options.result_url, 'result');
				});
			});
		},
		
		/**
		 * Add event listener
		 * @param {String|Array} name Event name(s)
		 * @param {Function} fn Event listener
		 * @param {Boolean} [only_once] Event listener should be called only once
		 */
		addEvent: addEvent,
		
		/**
		 * Remove event listener
		 * @param {String} name Event name
		 * @param {Function} fn Event listener
		 * @param {Boolean} [only_once] Event listener should be called only once
		 */
		removeEvent: function(name, fn) {
			dispatcher.removeEventListener(name, fn);
		},
		
		/**
		 * Dispatch event to all listeners
		 * @param {String} name Event name
		 * @param {Object} [data] Event extra data (avaliable 
		 * as <code>evt.data</code> in event listener)
		 */
		dispatchEvent: function(name, data) {
			dispatcher.dispatchEvent(name, data);
		},
		
		/**
		 * Setup function that is used for path resolving. This function should
		 * accept two arguments: <code>filename</code> (file's name) and 
		 * <code>type</code> (document type: xsl, dtd, xml)
		 * @param {Function} fn
		 */
		setPathResolver: function(fn) {
			resolvePath = fn;
		},
		
		searchTagByLineCol: searchTagByLineCol
	}
})();