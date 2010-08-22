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
		// get file name
		var file_name = resource.getResourceName('xsl', trace_obj.trace.meta.m);
		section_xsl.find('.xt-subtitle')
			.text(file_name + ':' + trace_obj.trace.meta.l)
			.data('file-info', {
				type: 'xsl',
				name: trace_obj.trace.meta.m,
				hl: trace_obj.template
			});
				
		var xpath = utils.createXPath(trace_obj.template);
		section_xsl.find('.xt-xpath').text(xpath);
		section_xsl.find('.xt-copy-buf').empty().append(utils.createClippy(xpath));
		
		section_xsl.find('.xt-section-content').empty().append(
			renderer.renderXml(trace_obj.template)
		);
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
			if (el.src) {
				src = el.src;
				break;
			}
		} while(el = el.parent);
		
		if (src) {
			// get file name
			var file_name = src.f;
			if (file_name !== 'SOURCE') {
				file_name = resource.getResourceName('xml', parseInt(file_name) + 1);
			}
				
			section_xml.find('.xt-subtitle')
				.data('file-info', {
					type: 'xml',
					name: (src.f === 'SOURCE') ? 0 : parseInt(src.f) + 1,
					hl: trace_obj.source
				})
				.text(file_name);
				
			section_xml.find('.xt-xpath').text(src.x);
			section_xml.find('.xt-copy-buf').empty().append(utils.createClippy(src.x));
			section_xml.find('.xt-section-content').empty().append(
				renderer.renderXml(trace_obj.source)
			);
		} else {
			console.log('Can\'t find source');
		}
	}
	
	/**
	 * Creates string representation of XML tag from tracing node
	 * @param {Object} trace_node
	 * @return {String}
	 */
	function createTagFromTrace(trace_node) {
		var result = '&lt;' + trace_node.tag;
		if (trace_node.attrs) {
			var a = trace_node.attrs;
			for (var p in a) if (a.hasOwnProperty(p)) {
				result += ' ' + p + '="' + utils.escapeHTML(a[p]) + '"';
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
			if (el.tag in call_tags)
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
				$('<div class="xt-file-link">' + resource.getResourceName('xsl', n.meta.m) + ':' + n.meta.l + '</div>')
					.data('file-info', {
						type: 'xsl',
						name: n.meta.m,
						hl: n.meta.l + '-' + n.meta.c
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