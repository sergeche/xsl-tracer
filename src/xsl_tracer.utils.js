/**
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "xsl_tracer.js"
 */
 
/**
 * Вспомогательные утилиты
 */
xsl_tracer.utils = function(){
	/**
	 * Вспомогательная структура для хранения дерева документа
	 * @param {Element} node
	 */
	function SimpleNode(node){
		this.ref = node;
//		this.ref_xpath = xsl_tracer.utils.createXPath(node);
		
		this.childNodes = [];
		this.firstChild = null;
		this.nextSibling = null;
		this.parentNode = null;
	}
	
	SimpleNode.prototype = {
		addChild: function(/* Element */node){
			var s = new SimpleNode(node);
			
			if (!this.childNodes.length) {
				// это первый потомок
				this.firstChild = s;
			} else {
				this.childNodes[this.childNodes.length - 1].nextSibling = s;
			}
			
			s.parentNode = this;
			this.childNodes.push(s);
			return s;
		},
		
		render: function(type){
			type = type || 'dom';
			var elem;
			var sys_id = 'xsldbg-id';
			switch (this.ref.nodeType) {
				case 3: //text node
					elem = '<span class="xsldbg-text">' + this.ref.nodeValue + '</span>';
//					elem.data('xsldbg-ref', this.ref);
					return (type == 'dom') ? $(elem) : elem;
				case 1: //element
					var attrs = [];
					var a = this.ref.attributes;
					$.each(a, function(name, /* Element */n){
						if (a[name].nodeName != sys_id)
							attrs.push(
								'<span class="xsldbg-attr">' +
									'<span class="xsldbg-attr-name">' + 
										a[name].nodeName + 
									'</span>="' +
									'<span class="xsldbg-attr-value">' + a[name].nodeValue + '</span>"' +
								'</span>'
							);
					});
					
					attrs = (attrs.length) ? ' ' + attrs.join(' ') : '';
					
					var tag_name = this.ref.nodeName.toLowerCase();
					var elem_id = this.ref.getAttribute(sys_id);
					
					elem = '<div class="xsldbg-element"'+ ( elem_id ? ' id="' + elem_id + '"' : '' ) + '">';
//					elem = '<div class="xsldbg-element"'+ ( elem_id ? ' id="' + elem_id + '"' : '' ) + '" xpath="' + this.ref_xpath + '">';
//					elem.data('xsldbg-ref', this.ref);
					if (this.childNodes.length) {
						elem += '<span class="xsldbg-start-tag">&lt;' + tag_name + attrs +'&gt;</span>';
						$.each(this.childNodes, function(i, /*SimpleNode */el){
							elem += el.render('text');
						});
						elem += '<span class="xsldbg-end-tag">&lt;/' + tag_name +'&gt;</span>';
					} else {
						elem += '<span class="xsldbg-start-tag">&lt;' + tag_name + attrs +'/&gt;</span>';
					}
					
					elem += '</div>';
					
					return (type == 'dom') ? $(elem) : elem;
			}
		},
		
		getName: function(){
			return this.ref.nodeType == 1 ? this.ref.nodeName : null;
		}
	};
	
	return {
		/**
		 * Возвращает только имя файла из всего пути
		 * 
		 * @param {String} path Путь к файлу
		 * @return {String}
		 */
		getFileName : function(path) {
			var re = /([\w\.\-]+)$/i;
			var m = re.exec(path);
			return (m) ? m[1] : '';
		},
		/**
		 * Возвращает базовый путь к файлу (без имени файла)
		 * 
		 * @param {String} path Путь к файлу
		 * @return {String}
		 */
		getBasePath : function(path) {
			return path.substring(0, path.length - this.getFileName(path).length);
		},

		/**
		 * Строит абсолютный url для файла
		 * 
		 * @param {String} path Путь к файлу
		 * @return {String}
		 */
		buildAbsoluteUrl : function(path) {
			var url = window.location.pathname + this.getBasePath(path);
			url = url.replace(/\/{2,}/g, '/');
			var dirs = [];
			$.each(url.split('/'), function(i, n) {
				if (n == '..' && dirs.length) {
					dirs.pop();
				} else if (n && n != '.') {
					dirs.push(n);
				}
			});

			var result = window.location.protocol + '//' + window.location.host + '/';
			result += (dirs.length) ? dirs.join('/') + '/' : '';
			result += this.getFileName(path);
			return result;
		},

		/**
		 * Конвертирует текст в XML
		 * 
		 * @param {String}
		 *            text
		 * @return {Document}
		 */
		toXML : function(text) {
			var xml = null;
			try {
				if (window.ActiveXObject) { // IE
					xml = new ActiveXObject('Microsoft.XMLDOM');
					xml.async = false;
					xml.loadXML(text);
				} else if (window.DOMParser) { // Все остальные
					var xml = (new DOMParser()).parseFromString(text, 'text/xml');
				}
				
				if (!xml || !xml.documentElement
						|| xml.documentElement.nodeName == 'parsererror'
						|| xml.getElementsByTagName('parsererror').length) {
					console.log(xml);
					return false;
				}
			} catch (error) {
				return false;
			}
			
			return xml;
		},
		
		/**
		 * Пробегаем по всему дереву документа или конкретного
		 * элемента. На каждом элементе выполняем callback-функцию <code>func</code>
		 * @param {Element} node Элемент, с которого начинать пробежку по дереву
		 * @param {Function} func
		 * @author Douglas Crockford 
		 */
		walkTheDOM: function(node, func) {
	        func(node);
	        node = node.firstChild;
	        while (node) {
	            this.walkTheDOM(node, func);
	            node = node.nextSibling;
	        }
	    },
	    
	    /**
	     * Нормализация строки: удаляются все переносы строк, несколько идущих 
	     * подряд пробелов заменяются на один, удаляются пробелы в начале 
	     * и в конце строки
	     * @param {String} str
	     * @return {String}
	     */
	    normalizeSpace: function(str){
 			// удаляем все переносы строк
 			str = str.replace(/[\n\r]/g, '');
 			
 			// все пробельные символы заменяем на один пробел
 			str = str.replace(/\s+/g, ' ');
 			
 			// удаляем проблелы в начале и в конце
 			str = $.trim(str);
 			
 			return str;
 		},
 		
 		/**
 		 * Рекурсивно удаляет все пробельные ноды у элемента и его потомков
 		 * @param {Element} element Элемент, у которого нужно удалить пробельные ноды  
 		 */
 		cleanWhitespace: function(element) { 
			// If no element is provided, do the whole HTML document 
			element = element || document;
			// Use the first child as a starting point 
			var cur = element.firstChild;
			// Go until there are no more child nodes 
			while ( cur != null ) {
				// If the node is a text node, and it contains nothing but whitespace 
				if ( cur.nodeType == 3 && ! /\S/.test(cur.nodeValue) ) {
					// Remove the text node 
					element.removeChild(cur); 
					// Otherwise, if it's an element 
				} else if ( cur.nodeType == 1 ) { 
					// Recurse down through the document 
					this.cleanWhitespace(cur); 
				}
				cur = cur.nextSibling; // Move through the child nodes 
			}
		},
		
		/**
 		 * Строит упрощенное дерево из определенных элементов документа. 
 		 * Необходимость добавления элемента в дерево определяется с помощью 
 		 * функции <code>compare</code>, которая должна вернуть <code>true</code>,
 		 * если элемент нужно добавить.<br><br>
 		 * 
 		 * Этим методом удобно пользоваться тогда, когда необходимо отфильтровать
 		 * определенные элементы дерева (например, удалить все текстовые ноды),
 		 * сохраняя порядок и структуру элементов документа.<br><br>
 		 * 
 		 * Результатом работы функции является новое дерево, построенное
 		 * из объектов класса <code>SimpleNode</code>.
		 * @param {Element} node Начальный элемент, от которого нужно строить дерево 
		 * @param {Function} compare Функция сравнения, которая должна вернуть true или false. В качестве аргумента приходит объект класса <code>Element</code>
		 * @return {SimpleNode}
		 */
		filterTree: function(node, compare, trace){
			var result;
			
	 		function buildResultTree(node, parent){
	 			if (compare(node)){
	 				if (!parent) {
	 					result = parent = new SimpleNode(node);
	 				} else {
			 			parent = parent.addChild(node);
	 				}
	 			}
	 			
		        node = node.firstChild;
		        while (node) {
		            buildResultTree(node, parent);
		            node = node.nextSibling;
		        }
	 		}
	 		
	 		buildResultTree(node);
	 		return result;
		},
		
		/**
		 * Строит XPath запрос для указанного узла <code>node</code>. 
		 * Если передан <code>parent</code>, то запрос будет построен 
		 * относительно этого элемента. Если необходимо строить запрос 
		 * для другого дерева, которая хранит другие названия элементов, удобно
		 * пользоваться функцией <code>translate</code>, которая возвращает 
		 * название элемента. Пример ее использования: для элемента 
		 * <LRE name="div"> нужно возвращать не название тэга (LRE), а значение 
		 * атрибута <code>name</code> (div)
		 * 
		 * @param {Element} node Узел, для которого нужно построить запрос
		 * @param {Function} [translate] Функция, которая возвращает название элемента 
		 * @param {Element} [context] Родительский узел, относительно которого нужно построить запрос
		 * @return {String}
		 */
		createXPath: function(node, context, translate){
			translate = translate || function(n){return n.nodeName};
			
			var parts = [];
			
			function walk(node){
				var _node = node;
				
				// тут нужно именно настоящее имя элемента
				var name = translate(node).toLowerCase();
				var count = 1;
				while (node = node.previousSibling) {
					if (node.nodeType == 1 && translate(node).toLowerCase() == name) {
						count++;
					}
				}
				
				parts.unshift(name + '[' + count + ']');
				if (_node.parentNode && _node.parentNode != context && _node.ownerDocument != _node.parentNode)
					walk(_node.parentNode);
			}
			
			walk(node);
			var result = parts.join('/');
			return (!context) ? '/' + result : result;
			
		},
		
		/**
		 * Простой поиск элемента с помощью простого XPath-запроса
		 * @param {String} xpath XPath-запрос
		 * @param {Element} context Элемент, с которого начинать поиск
		 * @result {Element}
		 */
		xpathFind: function(xpath, context){
			if (xpath.charAt(0) == '/') {
				// искать нужно от рута
				xpath = xpath.substr(1);
				if (context == 1)
					context = context.ownerDocument;
			}
			
			/** @type {String[]} */
			var parts = xpath.split('/');
			var part_ix = 0;
			var result;
			var re = /^([\w\:\-]+)(?:\[(\d+)\])?$/;
			
			function walkTree(/* Element[] */elems) {
				var m = re.exec(parts[part_ix]);
				if (!m || !elems)
					return null;
				
				var elem_name = m[1].toLowerCase(); 
				var elem_pos = (m[2]) ? parseInt(m[2], 10) : 1;
				var pos = 0;
				for (var i = 0; i < elems.length; i++) {
					if (elems[i].nodeName.toLowerCase() == elem_name) {
						pos++;
						if (pos == elem_pos) {
							// нашли нужный элемент в нужной позиции
							if (part_ix == parts.length - 1) {
								// это именно тот элемент, который искали
								return elems[i];
							} else {
								part_ix++;
								return walkTree(elems[i].childNodes);
							}
						}
					}
				}
				
			}
			return walkTree(context.nodeType == 9 ? [context.documentElement] : context.childNodes);
		}
	};
}();