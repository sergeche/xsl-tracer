/**
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "./lib/EventDispatcher.js"
 * @include "./lib/json2.js"
 * @include "event-names.js"
 * @include "utils.js"
 * @include "resource.js"
 * @include "errors.js"
 */var xsl_tracer = (function(){
	/** 
	 * Main event dispatcher. Most of tracer features and UI components are 
	 * binded to events. See <code>event-names.js</code> for a list of available
	 * events. 
	 */
	var dispatcher = new EventDispatcher(),
		/** @type {String} Path to XSL templates root folder */
		templates_root,
		
		/** List of xpath references for tracing elements */
		xpath_lookup = {},
		
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
		// no need in path resolving if template root is empty
		return templates_root 
			? utils.resolvePath(templates_root, filename) 
			: filename;
	}
	
	/**
	 * Removes all entity references from document
	 * @param {String} text
	 * @return {String}
	 */
	function removeEntityReferences(text) {
		// removing doctype is a bit tricky — use text parsing instead regexp
		var m = text.match(/<\!DOCTYPE/i);
		if (m) {
			var pos = m.index + m[0].length,
				end_pos = pos,
				brace = 0,
				len = text.length,
				ch;
				
			while (pos < len) {
				ch = text.charAt(pos);
				if (ch == '[')
					brace++;
				else if (ch == ']')
					brace--;
				else if (ch == '>' && (!brace || text.charAt(pos - 1) == ']')) {
					end_pos = pos + 1;
					break;
				}
				pos++;
			}
			
			text = text.substring(0, m.index) + text.substring(end_pos);
		}
		
		return text;
	}
	
	/**
	 * Remove entity definitions and escape entity names so they don't
	 * break XML parsing
	 * @param {String} text
	 */
	function cleanupEntities(text) {
		return removeEntityReferences(text)
			.replace(/&(?!#|x\d)/gi, '&amp;');
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
			try {
				data = utils.toXML(data);
				return n.data = data;
			} catch (e) {
				has_errors = true;
				var error_data = '';
				
				if (e == 'XmlParsingError') {
					/** @type {Document} */
					var error_doc = e.doc,
						error_elem = error_doc && error_doc.getElementsByTagName('parsererror')[0];
						
					if (error_elem) {
						var divs = error_elem.getElementsByTagName('div');
						if (divs.length) {
							// WebKit error style
							utils.each(error_elem.getElementsByTagName('div'), function(i, n) {
								error_data += n.outerHTML;
							});
						} else {
							error_data = utils.escapeHTML(error_elem.textContent || '') || error_elem.innerHTML;
						}
					}
				}
				
				dispatcher.dispatchEvent(EVT_ERROR, {
					url: n.name,
					error_code: 'xml_parsing_error',
					error_data: error_data
				});
				
//				console.log(data);
				
				return null;
			}
		};
		
		// transform all XSL documents
		utils.each(resource.getResource('xsl'), toXML);
		
		// transform all XML documents
		utils.each(resource.getResource('xml'), toXML);
		utils.each(resource.getResource('result'), function(i, /* String */ n) {
			// the result may be not well-formed XML document, so we 
			// explicitly wrap content with root tag
			n.data = removeEntityReferences(n.data);
			n.data = '<xsl-tracer>' + n.data.replace(/<\?xml.+?\?>/g, '') + '</xsl-tracer>';
			return toXML(i, n);
		});
		
		processTraceDocument();
		
		if (!has_errors) {
			// extend result document with tracing data
			buildElementDependency(resource.getResource('result', 0));
			
			// TODO tracer is ready
			dispatcher.dispatchEvent(EVT_COMPLETE);
		}
	}
	
	/**
	 * @class
	 */
	function LRE(name, ref) {
		this.name = name;
		this.ref = ref;
		this.children = [];
		/** @type {LRE} */
		this.previousSibling = null;
		/** @type {LRE} */
		this.nextSibling = null;
		/** @type {LRE} */
		this.parent = null;
	}
	
	LRE.prototype = {
		/**
		 * @param {LRE} child
		 */
		addChild: function(child) {
			child.previousSibling = null;
			child.nextSibling = null;
			
			if (this.children.length) {
				var lastChild = this.children[this.children.length - 1];
				child.previousSibling = lastChild;
				lastChild.nextSibling = child;
			}
			
			this.children.push(child);
			child.parent = this;
		},
		
		getPath: function() {
			var prefix;
			if (!this.parent)
				return "/";
			else {
				prefix = this.parent.getPath();
				return (prefix == '/' ? '' : prefix) + 
	            	"/" + this.name + "[" + this.getNumber() + "]";
			}
		},
		
		getNumber: function() {
			var curName = this.name,
				pos = 1,
				prev = this;
				
			while (prev = prev.previousSibling) {
				if (prev.name == curName)
					pos++;
			}
			
			return pos;
		}
	};
	
	function makeLreTree(trace, /* LRE */ lre_node) {
		for (var i = 0, il = trace.children.length; i < il; i++) {
			var item = trace.children[i],
				el = lre_node;
				
			if (item.type == 'LRE') {
				el = new LRE(item.name, item);
				lre_node.addChild(el);
			}
			
			makeLreTree(item, el);
		}
	}
	
	function updateXpath(/* LRE */ lre) {
		lre.ref.xpath = lre.getPath();
		for (var i = 0, il = lre.children.length; i < il; i++) {
			updateXpath(lre.children[i]);
		}
	}
	
	/**
	 * Processes tracing document
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
		
		var trace_doc = resource.getResource('trace', 0),
			lre_root = new LRE('', trace_doc);
			
		makeLreTree(trace_doc, lre_root);
		updateXpath(lre_root);
		
		// find all LRE elements
		xpath_lookup = {};
		walkTraceDoc(function(elem) {
			if (elem.type === 'LRE')
				xpath_lookup[elem.xpath] = elem;
		});
	}
	
	/**
	 * Links all tracing data into <code>__trace</code> expando propery for
	 * each element in result document
	 * @param {Document} doc 
	 */
	function buildElementDependency(doc){
		utils.each(doc.getElementsByTagName('*'), function(i, /* Element */ node) {
			var xpath = utils.createXPath(node);
			if (xpath in xpath_lookup) {
				node.__trace = {
					trace: xpath_lookup[xpath],
					result: node // backreference
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
			// don't do anything if there's a global error
			if (document.getElementById('xt-global-error'))
				return;
			
			if (options.template_path)
				templates_root = options.template_path;
			else if (options.template_url)
				templates_root = utils.getBasePath(options.template_url);
			else
				templates_root = "";
				
			this.dispatchEvent(EVT_INIT);
			
			// start document loading
			resource.load(options.trace_url, 'trace', function(data) {
				if (typeof data == 'string') {
					try {
						data = JSON.parse(data);
					} catch (e) {
						try {
							// do some eval parsing
							data = (new Function("return " + data))();
						} catch (e) {
							data = null;
							xsl_tracer.dispatchEvent(EVT_ERROR, {
								url: options.trace_url,
								error_code: 0,
								error_data: e.toString()
							});
						}
					}
				}
				
				if (data) {
					// save trace data
					resource.setResource('trace', 0, data);
					
					// ...and now load all the rest external references
					utils.each(data['xsl'], function(i, n) {
						resource.load(resolvePath(n, 'xsl'), 'xsl');
					});
					
					utils.each(data['xml'], function(i, n) {
						resource.load((n == 'SOURCE') ? options.source_url : resolvePath(n, 'xml'), 'xml');
					});
				}
				
				resource.load(options.result_url, 'result');
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
		}
	}
})();