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
	 * Updates XML section contents based on tracing object
	 * @param {Object} trace_obj
	 */
	function updateXMLSection(trace_obj) {
		// find element with source object
		var src,
			el = trace_obj.trace;
		do {
			if (el.ctx || (el.src && el.type == 'LRE')) {
				src = el.ctx || el.src;
				break;
			}
		} while(el = el.parent);
		
		if (src) {
			// get file name
			var file_name = resource.getResourceName(src),
				context_elem = resource.getResourceElement(src);
				
			section_xml.find('.xt-subtitle')
				.data('file-info', {
					type: src.v,
					name: src.i,
					hl: context_elem
				})
				.text(file_name + ':' + src.l);
				
			section_xml.find('.xt-xpath').text(src.xpath);
			section_xml.find('.xt-copy-buf').empty().append(utils.createClippy(src.xpath));
			section_xml.find('.xt-section-content').empty().append(
				renderer.renderXml(context_elem)
			);
		} else {
			console.log('source not found');
		}
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
	 * Updates XML section contents based on tracing object
	 * @param {Object} trace_obj
	 */
	function updateCallstackSection(trace_obj) {
		// create call stack list
		var callstack = [],
			el = trace_obj.trace;
		do {
			if (el.name in call_tags)
				callstack.push(el);
		} while (el = el.parent);
		
		// output callstack
		section_callstack.find('.xt-callstack').remove();
		var output = [],
			list = $('<ul class="xt-callstack"></ul>'),
			item;
			
		$.each(callstack, function(i, n) {
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
		
		section_callstack.append(list);
	}
	
	xsl_tracer.addEvent(EVT_TRACE, function(evt) {
		var trace_obj = evt.data;
		if (trace_obj) {
			updateXSLSection(trace_obj);
			updateXMLSection(trace_obj);
			updateCallstackSection(trace_obj);
		}
	});
});