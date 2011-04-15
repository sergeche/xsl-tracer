/**
 * User interface for XSL tracer
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @memberOf __ui
 * 
 * @include "xsl_tracer.js"
 * @include "renderer.js"
 */var __ui = (/** @constructor */ function(){
	/** @type jQuery */
	var file_contents;
	/** @type jQuery Currently selected element */
	var selected_elem;
	
	/**
	 * Highlight element
	 * @param {jQuery} element
	 */
	function highlightElement(elem) {
		// highlignt only those elements inside main container
		elem = $(elem);
		if (elem && elem.closest('#xt-content')) {
			if (selected_elem)
				selected_elem.removeClass('selected');
				
			selected_elem = elem.addClass('selected');
		}
	}
		
	$(document).delegate('.xt-clr-tag-open, .xt-clr-tag-close', 'click', function(/* Event */ evt) {
		var elem = $(this).closest('.xt-clr-tag');
		if (elem.length) {
			if (elem.hasClass('xt-collapsed')) {
				elem.removeClass('xt-collapsed');
			} else {
				highlightElement(elem);
				var original_elem = elem.data('original');
				if (original_elem && original_elem.__trace) {
					// we have attached tracing data to element
					xsl_tracer.dispatchEvent(EVT_TRACE, original_elem.__trace);
				}
			}
		}
	});
	
	$(document).delegate('.xt-clr-tag-switcher', 'click', function(evt) {
		$(this).closest('.xt-clr-tag').toggleClass('xt-collapsed');
	});
	
	$(document).delegate('.xt-file-link', 'click', function(/* Event */ evt) {
		evt.preventDefault();
		var file_info = $(this).data('file-info');
		if (file_info) {
			xsl_tracer.dispatchEvent(EVT_SWITCH_DOCUMENT, file_info);
		}
	});
	
	xsl_tracer.addEvent(EVT_INIT, function(args) {
		file_contents = $('#xt-content');
		$(document.body).addClass('loading');
	});
		
	xsl_tracer.addEvent(EVT_COMPLETE, function(){
		// render full result document when tracer is done
		$(document.body)
			.removeClass('loading')
			.addClass('inited');
		xsl_tracer.dispatchEvent(EVT_SWITCH_DOCUMENT, {type: 'result', name: 0});
	});
	
	xsl_tracer.addEvent(EVT_SWITCH_DOCUMENT, function(evt){
		var doc_type = evt.data.type,
			doc_name = evt.data.name,
			res = resource.getResource(doc_type, doc_name);
			
		if (res) {
			file_contents.empty();
			var doc = renderer.renderXml(res),
				hl_elem;
				
			if (evt.data.hl) {
				var elem = evt.data.hl;
				if (typeof evt.data.hl == 'string') {
					// it's a line-column pair
					var ar = evt.data.hl.split('-'),
						line = parseInt(ar[0], 10),
						col = parseInt(ar[0], 10);
						
					elem = xsl_tracer.searchTagByLineCol(res, line, col);
				}
				
				if (elem) {
					// we have element to highlight, find its representation
					$(doc).find('.xt-clr-tag').each(function(i, n) {
						if ($(n).data('original') === elem) {
							hl_elem = n;
							return false;
						}
					});
				}
			}
			
			file_contents.append(doc);
			if (hl_elem) {
				// we have element to highlight
				highlightElement(hl_elem);
				hl_elem.scrollIntoView(true);
			}
		}
	});
})();