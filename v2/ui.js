/**
 * User interface for XSL tracer
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "xsl_tracer.js"
 * @include "renderer.js"
 */$(function(){
	var file_contents = $('#xt-content'),
		section_xsl = $('#xt-xsl-section'),
		section_xml = $('#xt-xml-section'),
		section_callstack = $('#xt-callstack-section');
		
	/**
	 * Updates XSL section contents based on tracing object
	 * @param {Object} trace_obj
	 */
	function updateXSLSection(trace_obj) {
		// get file name
		var file_name = resource.getResourceName('xsl', trace_obj.trace.meta.m);
		section_xsl.find('.xt-subtitle').text(file_name + ':' + trace_obj.trace.meta.l);
		section_xsl.find('.xt-xpath').text(utils.createXPath(trace_obj.template));
		
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
			if (file_name !== 'SOURCE')
				file_name = resource.getResourceName('xml', file_name);
			
			section_xml.find('.xt-subtitle').text(file_name);
			section_xml.find('.xt-xpath').text(src.x);
			section_xml.find('.xt-section-content').empty().append(
				renderer.renderXml(trace_obj.source)
			);
		} else {
			console.log('Can\'t find source');
		}
	}
	
	/**
	 * Escapes unsafe HTML characters
	 * @param {String} str
	 * @return {String}
	 */
	function escapeHTML(str) {
		var charmap = {
			'<': '&lt;',
			'>': '&gt;',
			'&': '&amp;'
		};
		
		return str.replace(/[<>&]/g, function(s) {
			return charmap[s] || s;
		});
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
				result += ' ' + p + '="' + escapeHTML(a[p]) + '"';
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
			if (el.tag == 'xsl:apply-templates')
				callstack.push(el);
		} while (el = el.parent);
		
		// output callstack
		section_callstack.find('.xt-callstack').remove();
		var output = [];
		$.each(callstack, function(i, n) {
			output.push('<li>' +
				'<div class="xt-callstack-title">' + createTagFromTrace(n) + '</div>' +
				'<div class="xt-callstack-res">' + resource.getResourceName('xsl', n.meta.m) + ':' + n.meta.l + '</div>' +
				'</li>'
			);
		});
		
		section_callstack.append('<ul class="xt-callstack">' + output.join('') + '</ul>');
	}
	
	$(document).delegate('.xt-clr-tag-open, .xt-clr-tag-close', 'click', function(/* Event */ evt) {
		var elem = $(this).closest('.xt-clr-tag');
		if (elem.length) {
			var original_elem = elem.data('original');
			if (original_elem && original_elem.__trace) {
				// we have attached tracing data to element
				var trace_obj = original_elem.__trace;
				updateXSLSection(trace_obj);
				updateXMLSection(trace_obj);
				updateCallstackSection(trace_obj);
			}
		}
	});
		
	xsl_tracer.addEvent(EVT_COMPLETE, function(){
		// render full result document when tracer is done
		file_contents.append( renderer.renderXml(resource.getResource('result', 0)) );
	});
});