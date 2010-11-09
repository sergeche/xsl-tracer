/**
 * User interface for XSL tracer
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "xsl_tracer.js"
 */var renderer = (function(){
	
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
	function stylize(node, counter) {
		if (node) {
			if (counter.cur < counter.limit) {
				switch (node.nodeType) {
					case 1: // element
						counter.cur++;
						return stylizeElement(node, counter);
					case 3: // text node
						return stylizeTextNode(node);
					case 9: // document
						return stylize(node.documentElement, counter);
				}
			} else if (counter.cur == counter.limit) {
				counter.cur++;
				return '<span class="xt-clr-truncate"></span>';
			}
		}
		
		return '';
	}
	
	/**
	 * Stylize element node as tokenized HTML fragment
	 * @param {Element} node
	 * @return {String} 
	 */
	function stylizeElement(node, counter) {
		var attrs = [];
		utils.each(node.attributes, function(i, n) {
			attrs.push('<span class="xt-clr-attr"><span class="xt-clr-attr-name">' + n.nodeName + '</span>' +				'="' +				'<span class="xt-clr-attr-value">' + n.nodeValue + '</span>' +				'"</span>');
		});
		
		// test if current node should be displayed on one line
		var is_one_liner = node.childNodes.length == 1 && node.firstChild.nodeType == 3 && node.firstChild.nodeValue.length < 100;
		
		var result = [],
			add_class = '';
			
		if (is_one_liner || !node.childNodes.length)
			add_class += ' xt-clr-one-line'
			
		result.push('<span class="xt-clr-tag' + add_class + '">');
		result.push('<span class="xt-clr-tag-switcher"></span>');
		result.push('<span class="xt-clr-tag-open">&lt;');
		result.push('<span class="xt-clr-tag-name">' + node.nodeName +'</span>');
		if (attrs.length)
			result.push(' ' + attrs.join(' '));
			
		var name = node.nodeName.toLowerCase();
			
//		if (!node.childNodes.length && (name in close_self || name.indexOf('xsl:') === 0)) {
		if (!node.childNodes.length) {
			result.push(' /&gt;</span></span>');
		} else {
			result.push('&gt;</span>');
			utils.each(node.childNodes, function(i, n) {
				result.push(stylize(n, counter));
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
		 * @param {Number} limit How many nodes to render
		 */
		renderXml: function(elem, limit) {
			var div = document.createElement('div');
			if (!elem)
				return div;
			
			var counter = {
				cur: 0,
				limit: limit || Number.POSITIVE_INFINITY
			};
			
			div.innerHTML = stylize(elem, counter);
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