/**
 * User interface for XSL tracer
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "xsl_tracer.js"
 */
	
	/** List of self-closing tags */
	var close_self = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");
	
	function makeMap(str){
		var obj = {}, items = str.split(",");
		for ( var i = 0; i < items.length; i++ )
			obj[ items[i] ] = true;
		return obj;
	}
	
	/**
	 * Stylize DOM node
	 * @param {Node} node
	 * @return {String}
	 */
	function stylize(node) {
		switch (node.nodeType) {
			case 1: // element
				return stylizeElement(node);
			case 3: // text node
				return stylizeTextNode(node);
			case 9: // document
				return stylizeElement(node.documentElement);
		}
		
		return '';
	}
	
	/**
	 * Stylize element node as tokenized HTML fragment
	 * @param {Element} node
	 * @return {String} 
	 */
	function stylizeElement(node) {
		var attrs = [];
		utils.each(node.attributes, function(i, n) {
			attrs.push('<span class="xt-clr-attr"><span class="xt-clr-attr-name">' + n.nodeName + '</span>' +
		});
		
		// test if current node should be displayed on one line
		var is_one_liner = node.childNodes.length == 1 && node.firstChild.nodeType == 3 && node.firstChild.nodeValue.length < 100;
		
		var result = [];
		result.push('<span class="xt-clr-tag' + (is_one_liner ? ' xt-clr-one-line' : '') + '">');
		result.push('<span class="xt-clr-tag-switcher"></span>');
		result.push('<span class="xt-clr-tag-open">&lt;');
		result.push('<span class="xt-clr-tag-name">' + node.nodeName +'</span>');
		if (attrs.length)
			result.push(' ' + attrs.join(' '));
			
		if (!node.childNodes.length && node.nodeName in close_self) {
			result.push(' /&gt;</span></span>');
		} else {
			result.push('&gt;</span>');
			utils.each(node.childNodes, function(i, n) {
				result.push(stylize(n));
			});
			
			result.push('<span class="xt-clr-tag-close">&lt;/' +
				'<span class="xt-clr-tag-name">' + node.nodeName +'</span>' +
				'&gt;</span></span>');
		}
		
		return result.join('');
	}
	
	/**
	 * Stylize element node as tokenized HTML fragment
	 * @param {Element} node
	 * @return {String} 
	 */
	function stylizeTextNode(node) {
		return '<span class="xt-clr-text">' + node.nodeValue + '</span>';
	}
	
	return {
		/**
		 * Render XML fragment as styled HTML tree
		 * @param {Element} elem
		 */
		renderXml: function(elem) {
			var div = document.createElement('div');
			div.innerHTML = stylize(elem);
			if (elem.nodeType == 9)
				elem = elem.firstChild;
				
			if (elem.nodeType == 1) {
				var orig_nodes = elem.getElementsByTagName('*');
				$('.xt-clr-tag', div.firstChild).each(function(i, n) {
					$(n).data('original', orig_nodes[i]);
				});
				
				$(div.firstChild).data('original', elem);
			}
			
			return div.firstChild;
		}
	};
})();