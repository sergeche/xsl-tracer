/**
 * This module updates trace sections (XML, XSL, Call Stack) whenever 
 * EVT_TRACE occures
 * 
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "xsl_tracer.js"
 */$(function(){
	var section_xsl = $('#xt-xsl-section'),
		section_xml = $('#xt-xml-section'),
		section_callstack = $('#xt-callstack-section'),
		call_tags = {
			'xsl:apply-templates': 1,
			'xsl:call-template': 1,
			'xsl:apply-imports': 1
		};
	
	/**
	 * Updates XSL section contents based on tracing object
	 * @param {Object} trace_obj
	 */
	function updateXSLSection(trace_obj) {
		var template,
			_trace = trace_obj.trace;
			
		// find template definition
		do {
			if (_trace.name == 'xsl:template' && _trace.src) {
				template = _trace;
				break;
			}
		} while (_trace = _trace.parent);
		
		if (template) {
			// get file name
			var file_name = resource.getResourceName(template.src),
				template_elem = resource.getResourceElement(template.src);
			section_xsl.find('.xt-subtitle')
				.text(file_name + ':' + template.src.l)
				.data('file-info', {
					type: template.src.v,
					name: template.src.i,
					hl: template_elem
				});
					
			var xpath = template.src.xpath;
			section_xsl.find('.xt-xpath').text(xpath);
			section_xsl.find('.xt-copy-buf').empty().append(utils.createClippy(xpath));
			
			section_xsl.find('.xt-section-content').empty().append(
				renderer.renderXml(template_elem)
			);
		}
	}
	
	/**
	 * Updates single XML tab content based on trace data
	 */
	function updateTabContent(trace_data, class_name, limit) {
		// get file name
		var file_name = resource.getResourceName(trace_data),
			context_elem = resource.getResourceElement(trace_data);
			
		var output_elems = section_xml.find(class_name);
		
		output_elems.filter('dt')
			.data('file-info', {
				type: trace_data.v,
				name: trace_data.i,
				hl: context_elem,
				display_string: file_name + ':' + trace_data.l
			})
			.find('.xt-xpath').text(trace_data.xpath).end()
			.find('.xt-copy-buf').empty().append(utils.createClippy(trace_data.xpath));
			
		output_elems.filter('dd').empty().append(
			renderer.renderXml(context_elem, limit)
		);
	}
	
	/**
	 * Updates XML context section content based on tracing object, displaying
	 * context node of selected element's applied template
	 * @param {Object} trace_obj
	 */
	function updateXMLContextSection(trace_obj) {
		// find element with source object
		var src,
			el = trace_obj.trace;
		do {
			if (el.ctx) {
				src = el.ctx;
				break;
			}
		} while(el = el.parent);
		
		if (src) 
			updateTabContent(src, '.xt-trace-context', 10);
		else
			console.log('no context', trace_obj);
	}
	
	/**
	 * Updates XML source section content based on tracing object, displaying
	 * source (basically XSL) node of selected element's applied template
	 * @param {Object} trace_obj
	 */
	function updateXMLSourceSection(trace_obj) {
		// find element with source object
		var src,
			el = trace_obj.trace;
		do {
			if (el.src && el.type == 'LRE') {
				src = el.src;
				break;
			}
		} while(el = el.parent);
		
		if (src) 
			updateTabContent(src, '.xt-trace-source');
	}
	
	/**
	 * Creates string representation of XML tag from tracing node
	 * @param {Object} trace_node
	 * @return {String}
	 */
	function createTagFromTrace(trace_node) {
		var result = '&lt;' + trace_node.name,
			elem = resource.getResourceElement(trace_node.src);
		
		if (elem) {
			var a = elem.attributes;
			for (var i = 0, il = a.length; i < il; i++) {
				result += ' ' + a[i].nodeName + '="' + utils.escapeHTML(a[i].nodeValue) + '"';
			}
		}
		
		return result + '&gt;';
	}
	
	/**
	 * Renders list of template calls in callstack section
	 * @param {String} title List title
	 * @param {Array} calls List of template calls trace objects 
	 */
	function renderCallList(title, calls) {
		if (calls && calls.length) {
			var output = [],
				list = $('<ul class="xt-callstack"></ul>'),
				item;
				
			$.each(calls, function(i, n) {
				item = $('<li></li>');
				item.append(
					$('<div class="xt-file-link">' + resource.getResourceName(n.src) + ':' + n.src.l + '</div>')
						.data('file-info', {
							type: n.src.v,
							name: n.src.i,
							hl: resource.getResourceElement(n.src)
						})
				);
				item.append($('<div class="xt-callstack-title">' + createTagFromTrace(n) + '</div>'));
				list.append(item);
			});
			
			section_callstack.append('<h3><span class="xt-title">' + title + '</span></h3>');
			section_callstack.append(list);
		}
	}
	
	/**
	 * Outputs callstack (outer calls) into callstack section
	 * @param {Object} trace_obj Trace data
	 */
	function showCallstack(trace_obj) {
		// create call stack list
		var callstack = [],
			el = trace_obj.trace;
		do {
			if (el.name in call_tags)
				callstack.push(el);
		} while (el = el.parent);
		
		// output callstack
		renderCallList('Call stack', callstack);
	}
	
	/**
	 * Outputs inner calls, a list of applied templates which cannot be 
	 * displayed at this moment in main document tab (like attribute or text
	 * matched templates) 
	 * @param {Object} trace_obj Trace data
	 */
	function showInnerCalls(trace_obj) {
		// find all inner template calls which does not produce LRE
		var call_list = [],
			el = trace_obj.trace;
			
		function findTemplates(node) {
			for (var i = 0, il = node.children.length; i < il; i++) {
				var n = node.children[i];
				if (n == 'xsl:template') {
					// check if there's no direct LRE children
					var has_lre = false;
					for (var j = 0, jl = n.children.length; j < jl; j++) {
						if (n.children[j].type == 'LRE') {
							has_lre = true;
							break;
						}
					}
					
					if (!has_lre) {
						call_list.push(n);
					}
				} else {
					findTemplates(n);
				}
			}
		}
		
		renderCallList('Inner calls', call_list);
	}
	
	/**
	 * Updates XML section contents based on tracing object
	 * @param {Object} trace_obj
	 */
	function updateCallstackSection(trace_obj) {
		section_callstack.empty();
		showCallstack(trace_obj);
		showInnerCalls(trace_obj);
	}
	
	/**
	 * Update displayed file url of XML section depending on selected tab
	 */
	function updateTabFileLink() {
		var selected_tab = section_xml.find('.xt-section-tabs > dt.xt-active'),
			file_info = selected_tab.data('file-info'),
			file_link = section_xml.find('.xt-file-link');
			
		file_link.text('').data('file-info', null);
		
		if (file_info) {
			file_link
				.text(file_info.display_string)
				.data(file_info);
		}
	}
	
	xsl_tracer.addEvent(EVT_TRACE, function(evt) {
		var trace_obj = evt.data;
		if (trace_obj) {
			updateXSLSection(trace_obj);
			updateXMLContextSection(trace_obj);
			updateXMLSourceSection(trace_obj);
//			updateXMLSection(trace_obj);
			updateCallstackSection(trace_obj);
			
			updateTabFileLink();
		}
	});
	
	section_xml.find('.xt-section-tabs > dt').click(function() {
		var cur_tab = $(this);
		if (!cur_tab.hasClass('xt-active')) {
			cur_tab.addClass('xt-active').siblings().removeClass('xt-active');
			updateTabFileLink();
		}
	})
});