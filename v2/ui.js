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
		
	$(document).delegate('.xt-clr-tag-open, .xt-clr-tag-close', 'click', function(/* Event */ evt) {
		var elem = $(this).closest('.xt-clr-tag');
		if (elem.length) {
			var original_elem = elem.data('original');
			if (original_elem && original_elem.__trace) {
				// we have attached tracing data to element
				var trace_obj = original_elem.__trace;
				updateXSLSection(trace_obj);
				updateXMLSection(trace_obj);
				console.log(trace_obj);
			}
		}
	});
		
	xsl_tracer.addEvent(EVT_COMPLETE, function(){
		// render full result document when tracer is done
		file_contents.append( renderer.renderXml(resource.getResource('result', 0)) );
	});
});