/**
 * Utility functions for XSL tracer
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "xsl_tracer.js"
 */
var utils = function(){
	/**
	 * Split text into lines. Set <code>remove_empty</code> to true to filter
	 * empty lines
	 * @param {String} text
	 * @param {Boolean} [remove_empty]
	 * @return {Array}
	 */
	function splitByLines(text, remove_empty) {
		// IE fails to split string by regexp, 
		// need to normalize newlines first
		// Also, Mozilla's Rhiho JS engine has a wierd newline bug
		var nl = '\n';
		var lines = (text || '')
			.replace(/\r\n/g, '\n')
			.replace(/\n\r/g, '\n')
			.replace(/\n/g, nl)
			.split(nl);
		
		if (remove_empty) {
			for (var i = lines.length; i >= 0; i--) {
				if (!trim(lines[i]))
					lines.splice(i, 1);
			}
		}
		
		return lines;
	}
	
	function startsWith(str, chars) {
		return str.indexOf(chars) === 0;
	}
	
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
		 * Конвертирует текст в XML
		 * 
		 * @param {String}
		 *            text
		 * @return {Document}
		 */
		toXML : function(text) {
			var xml = null;
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
						
				
				throw new XmlParsingError(xml);
			}
//			try {
//			} catch (error) {
//				return false;
//			}
			
			return xml;
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
			
			// remove internal wrapper, if any
			result = result.replace(/^xsl\-tracer\[1\]\/?/i, '');
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
		},
		
		/**
		 * 
		 * @param {String} dirname
		 * @param {String} file
		 */
		resolvePath: function(dirname, file) {
			if (file.charAt(0) == '/') // absolute path
				return file;
			
			if (dirname.charAt(dirname.length - 1) != '/')
				dirname += '/';
				
			var path = dirname + file;
			
			// took from Python
			var initial_slashes = startsWith(path, '/');
//			POSIX allows one or two initial slashes, but treats three or more
//			as single slash.
			if (initial_slashes && startsWith(path, '//') && !startsWith(path, '///'))
				initial_slashes = 2;
				
			var comps = path.split('/'),
				new_comps = [];
				
			for (var i = 0, il = comps.length; i < il; i++) {
				var comp = comps[i];
				if (comp == '' || comp == '.')
					continue;
					
				if (comp != '..' || (!initial_slashes && !new_comps.length) || 
					(new_comps.length && new_comps[new_comps.length - 1] == '..'))
					new_comps.push(comp);
				else if (new_comps.length)
					new_comps.pop();
					
			}
			
			comps = new_comps;
			path = comps.join('/');
			if (initial_slashes) {
				var prefix = '';
				do {
					prefix += '/';
				} while (--initial_slashes);
				
				path = prefix + path;
			}
			
			return path || '.';
		},
		
		/**
		 * Adds line and column positions for every tag in document
		 * @param {String} XHTML document
		 * @return {String} Same document with <code>xsltrace-line</code> and
		 * <code>xsltrace-column</code> in every tag
		 */
		markTagPositions: function(content) {
			var line = 1,
				column = 0,
				ch = 0,
				l = content.length,
				buffer = [],
				buf_start = 0,
				m,
				re_tag = /^<([\w\:\-]+)((?:[\s\n\r]+[\w\-:]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)[\s\n\r]*(\/?)>/;
				
			while (ch < l) {
				column++;
				switch (content.charAt(ch)) {
					case '<':
						if (m = content.substr(ch, 300).match(re_tag)) {
							// found tag, remember its line and column
							buffer.push(content.substring(buf_start, ch));
							var line_count = splitByLines(m[0]).length,
								cur_line = line + (line_count > 1 ? '-' + (line + line_count) : ''),
								cur_column = column + '-' + (column + m[0].length);
								
							buffer.push(m[0].replace(/(\s*\/?>)$/, 
								' xsltrace-line="' + cur_line +'"' +
								' xsltrace-column="' + cur_column + '"$1'));
								
							buf_start = ch + m[0].length;
							ch += m[0].length - 1;
						}
						break;
					case '\n':
						if (content.charAt(ch + 1) == '\r')
							ch++;
						
						line++;
						column = 0;
						break;
				}
				
				ch++;
			}
			
			buffer.push(content.substr(buf_start));
			return buffer.join('');
		},
		
		/**
		 * Helper function to traverse all elements in array
		 * @param {Array} ar Array to traverse
		 * @param {Function} fn Function called on each element. If it returns
		 * <code>false</code> — iteration stops
		 */
		each: function(ar, fn) {
			for (var i = 0, il = ar.length; i < il; i++) {
				if (fn(i, ar[i]) === false)
					break;
			}
		},
		
		/**
		 * Create small flash that alows user to copy text into buffer by 
		 * clicking on this movie
		 * @param {String} text Text to copy
		 * @return {Element} Flash object redy to be inserted into document
		 */
		createClippy: function(text) {
			var div = document.createElement('div');
			text = encodeURIComponent(text);
			div.innerHTML = '<object classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000" width="14" height="14">' +
			    '<param name="movie" value="./i/clippy.swf"/>' +
			    '<param name="allowScriptAccess" value="always" />'+
			    '<param name="quality" value="high" />' +
			    '<param name="scale" value="noscale" />' +
			    '<param name="FlashVars" value="text=' + text + '" />' +
			    '<param name="bgcolor" value="#ffffff" />' +
			    '<embed src="./i/clippy.swf" width="14" height="14" scale="noscale" quality="high" allowScriptAccess="always" type="application/x-shockwave-flash" pluginspage="http://www.macromedia.com/go/getflashplayer" FlashVars="text=' + text + '" bgcolor="#ffffff" />' +
			'</object>';
			
			return div.firstChild;
		},
		
		/**
		 * Removes trailing whitespace
		 * @param {String} text
		 * @return {String}
		 */
		trim: function(text) {
			return (text || '').replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '');
		},
		
		unescapeHTML: function(text) {
			var chars = {
				'&lt;': '<',
				'&gt;': '>',
				'&amp;': '&',
				'&quot;': '"',
				'&apos;': '\''
			};
			
			text = this.trim(text);
			
			return text.replace(/&(lt|gt|amp|apos|quot);/g, function(str) {
				return chars[str];
			});
		},
		
		/**
		 * Escapes unsafe HTML characters
		 * @param {String} str
		 * @return {String}
		 */
		escapeHTML: function(str) {
			var charmap = {
				'<': '&lt;',
				'>': '&gt;',
				'&': '&amp;'
			};
			
			return str.replace(/[<>&]/g, function(s) {
				return charmap[s] || s;
			});
		}

	};
}();