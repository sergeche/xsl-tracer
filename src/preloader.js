/**
 * Preloader module: shows loading file list and errors
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @memberOf __preloader
 * 
 * @include "xsl_tracer.js"
 */var __preloader = (/** @constructor */ function(){
	/** @type jQuery */
	var preloader;
	/** @type jQuery */
	var file_list;
		
	function processError(text) {
		return text.replace(/\n\r?/g, '<br />');
	}
		
	xsl_tracer.addEvent(EVT_INIT, function() {
		if (!preloader) {
			preloader = $('#xt-preloader'),
			file_list = preloader.find('.xt-file-list');
				
			if (!file_list.length) {
				file_list = $('<ul class="xt-file-list"></ul>').appendTo(preloader.find('.xt-files'));
			}
		}
		
		preloader.find('.xt-file-list').empty();
	});
		
	xsl_tracer.addEvent(EVT_LOAD_FILE_START, function(/* Event */ evt) {
		file_list.append('<li><span class="xt-file-name">' + evt.data.url + '</span></li>');
	});
	
	xsl_tracer.addEvent(EVT_LOAD_FILE_COMPLETE, function(/* Event */ evt) {
		var file_name = evt.data.url;
		file_list.find('li').each(function(i, n) {
			n = $(n);
			if (n.text() == file_name) {
				n.addClass('success');
				return false;
			}
		});
	});
	
	xsl_tracer.addEvent([EVT_LOAD_FILE_ERROR, EVT_ERROR], function(/* Event */ evt) {
		var file_name = evt.data.url,
			is_file_found = false;
		
		file_list.find('li').each(function(i, n) {
			n = $(n);
			if (n.text() == file_name) {
				is_file_found = true;
				n.addClass('error').append(
					$('<div class="xt-error"></div>').html(processError(evt.data.error_data))
				);
				return false;
			}
		});
		
		if (!is_file_found) {
			$('#xt-preloader-other-errors').show().append(
				$('<div class="xt-error"></div>').html(processError(evt.data.error_data))
			);
		}
	});
	
	$(function(){
		$('#xt-preloader').delegate('li.error > .xt-file-name', 'click', function(/* Event */ evt) {
			$(this).next('.xt-error').toggle();
		});
	});
	
})();