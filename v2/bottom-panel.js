/**
 * Module for resizing bottom panel
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 */$(function(){
	var panel = $('#xt-trace-info'),
		panel_header = panel.find('.xt-panel-header'),
		top_panel = $('#xt-top-panel'),
		page_body = $('#xt-page-body'),
		
		min_height = 0,
		max_height = 3000,
		max_height_ratio = 0.8,
		available_height = 0,
		
		last_mouse_y = 0,
		last_panel_height = 0,
		
		is_dragging = false;
		
		
	function resizePanel(height) {
		height = Math.min(max_height, Math.max(min_height, height));
		panel.css('height', height);
		page_body.css('height', available_height - height);
	}
	
	function updateLimits() {
		available_height = window.innerHeight - top_panel[0].offsetHeight;
		min_height = panel_header[0].offsetHeight;
		max_height = Math.round(available_height * max_height_ratio);
	}
		
	/**
	 * Start panel dragging/resizing
	 * @param {Event} evt
	 */
	function startDrag(evt) {
		last_mouse_y = evt.pageY;
		last_panel_height = panel[0].offsetHeight;
		
		updateLimits();
		
		is_dragging = true;
		
		evt.preventDefault();
		return false;
	}
	
	/**
	 * Panel dragging/resizing routine
	 * @param {Event} evt
	 */
	function doDrag(evt) {
		var dy = evt.pageY - last_mouse_y;
		resizePanel(last_panel_height - dy);
	}
	
	/**
	 * Stop dragging/resizing
	 * @param {Event} evt
	 */
	function stopDrag(evt) {
		is_dragging = false;
	}
	
	$(document)
		.mousemove(function(/* Event */ evt) {
			if (is_dragging)
				doDrag(evt);
		})
		.mouseup(stopDrag);
		
	panel_header.mousedown(startDrag);
});