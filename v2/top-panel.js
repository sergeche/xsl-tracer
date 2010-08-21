/**
 * Top panel module
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "xsl_tracer.js"
 */$(function(){
	var file_list = $('#fld-xt-file'),
		is_propagated = false;
	
	/**
	 * Creates list of available files to view in main content pane
	 */
	function propagateFileList() {
		if (is_propagated)
			return;
		
		file_list.empty();
		file_list.append('<option value="result-0">Result</option>');
		
		var trace_doc = resource.getResource('trace', 0),
			group;
		
		// XML group
		group = $('<optgroup label="XML"></optgroup>');
		group.append('<option value="xml-0">Source</option>');
		$.each(trace_doc['xml'], function(i, n) {
			group.append('<option value="xml-' + (i + 1) + '">' + n + '</option>');
		});
		
		file_list.append(group);
		
		// XSL group
		group = $('<optgroup label="XSL"></optgroup>');
		$.each(trace_doc['xsl'], function(i, n) {
			group.append('<option value="xsl-' + i + '">' + n + '</option>');
		});
		
		file_list.append(group);
		
		is_propagated = true;
	}
	
	
	function onChange() {
		var value = file_list.val().split('-');
		xsl_tracer.dispatchEvent(EVT_SWITCH_DOCUMENT, {type: value[0], name: value[1]});
	}
	
	file_list.change(onChange);
	
	
	xsl_tracer.addEvent(EVT_COMPLETE, function() {
		propagateFileList();
	});
	
	xsl_tracer.addEvent(EVT_SWITCH_DOCUMENT, function(evt) {
		propagateFileList();
		// temporary remove onChange event to not run into endless loop
		file_list.unbind('change', onChange);
		file_list.val(evt.data.type + '-' + evt.data.name);
		file_list.change(onChange);
	});
});