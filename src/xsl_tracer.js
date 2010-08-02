/**
 * XSL-трэйсер. Помогает найти то, что скрыто.
 * 
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "EventDispatcher.js"
 * @include "xsl_tracer.utils.js"
 * @include "xsl_tracer.entity.js"
 * @include "JSON.js"
 *
 * TODO выводить комментарии в шаблонах
 * TODO Добавить call stack для соотвествия
 * TODO Добвить раскрытие/сворачивание энтити для шаблонов
 */
var xsl_tracer = function() {

	/** Диспетчер событий внутри дебаггера */
	var dispatcher = new EventDispatcher();
	
	/**
	 * Самая главная структура, которая хранит все связи между элементами 
	 * документов
	 */
	var deps = null;
	
	/** Базовый путь к загрузчику шаблонов */
	var template_path = '';
	
	var ns_map = {
		xsl: 'http://www.w3.org/1999/XSL/Transform',
		html: 'http://www.w3.org/1999/xhtml'
	};
	
	/**
	 * Index for XML/XSL elements built by element's line and column positions 
	 */
	var templates_line_index = {};
	
	function nsResolver(prefix){
		var ns = ns_map[prefix];
		if (!ns) {
			throw new Error('Can\'t find namespace URI for prefix ' + prefix);
		} else {
			return ns;
		}
	}

	/** Константы для событий */
	var EVENT = {
		/** Начало загрузки всех xml-документов, необходимых для дебага */
		LOAD_START : 'onLoadStart',

		/** Все xml-документы, необходимые для дебага, загружены */
		LOAD_COMPLETE : 'onLoadComplete',

		/**
		 * Начало загрузки одного файла. В свойство <code>data</code> события
		 * прийдет хэш с параметрами:<br>
		 * <b>url</b> : String — адрес загружаемого файла
		 */
		LOAD_FILE_START : 'onLoadFileStart',

		/**
		 * Файл загружен. В свойство <code>data</code> события прийдет хэш с
		 * параметрами:<br>
		 * <b>url</b> : String — адрес загруженного файла
		 */
		LOAD_FILE_COMPLETE : 'onLoadFileComplete',
		
		/**
		 * Ошибка при загрузке файла. В свойство <code>data</code> события 
		 * прийдет хэш с параметрами:<br>
		 * <b>url</b> : String — адрес загруженного файла<br>
		 * <b>error_code</b> : Number — Код ошибки<br>
		 * <b>error_status</b> : String — Текстовый статус ошибки
		 */
		LOAD_FILE_ERROR : 'onLoadFileError',
		
		/**
		 * Завершена инициализация, можно работать с ресурсами дебаггера
		 */
		INIT : 'onInit'
	};
	
	/**
	 * Вспомогательная структура для хранения файлов
	 */
	function fileContainer(){
		var files = {};
		var count = 0;
		
		return {
			/**
			 * Добавление нового файла
			 * 
			 * @param {String} name Название шаблона
			 * @param {Object} content Содержимое файла
			 */
			add : function(name, content) {
				files[name] = content;
				count++;
			},
	
			/**
			 * Поиск модуля по названию
			 * 
			 * @param {String} name Название модуля
			 * @return {Object}
			 */
			find : function(name) {
				return files[name];
			},
	
			/**
			 * Возвращает количество файлов в наборе
			 * 
			 * @return {Number}
			 */
			size : function() {
				return count;
			},
			
			/**
			 * Возвращает список названий модулей
			 * 
			 * @return {Array}
			 */
			getList: function() {
				var result = [];
			
				$.each(files, function(name, content){
					result.push(name);
				});
				
				return result;
			}
		};
	};
	
	/**
	 * Проходимся по трассировочному документу и выполняем функцию <code>callback</code> на каждом элементе.
	 * @param {Function} callback
	 * @param {Object} [doc]  
	 */
	function walkTraceDoc(callback, doc) {
		doc =  doc || docs.trace;
		try {
			function walk(elem) {
				for (var i = 0, il = elem.children.length; i < il; i++) {
					if (callback(elem.children[i]) === false)
						throw "StopWalking";
					if (elem.children[i].children.length)
						walk(elem.children[i]);
				}
			}
			
			walk(doc);
		} catch (e) {}
	}
	
	/**
	 * Дополнительная обработка трассировочного документа: добавляет ссылки на родителей
	 * для всех дочерних элементов
	 */
	function preprocessTraceDoc(doc) {
		function walk(elem, parent) {
			parent = parent || null;
			elem.parent = parent;
			for (var i = 0, il = elem.children.length; i < il; i++) {
				walk(elem.children[i], elem);
			}
		}
		
		walk(doc);
	}
	
	/**
	 * Контейнер шаблонов. Наследуется от <code>fileContainer()</code>
	 */
	function templateContainer(){
		var entities = {};
		var cont = fileContainer();
		
		var uber_add = cont.add;
		cont.add = function(/* String */name, /* String */content){
			/*
			 * Причина, по которой xsl-шаблон загружается именно как текст, 
			 * в том, что он может содержать в себе ссылку на энтити-файл, 
			 * который не собирается загружаться браузером. Поэтому нужно найти
			 * ссылку на этот файл, и, если она есть, вырезать ее 
			 * и самостоятельно загрузить энтити-файл.
			 */
			var real_name = name;
			name = name.substr(template_path.length);
			
			content = xsl_tracer.utils.markTagsPosition(content);
			
			// вырезаем ссылку на энтити
			content = xsl_tracer.entity.processModule(real_name, content);
			var doc = xsl_tracer.utils.toXML(content);
			if (!doc)
				console.error(name, real_name);
				
			indexTree(doc);
			rememberElementLines(real_name, doc);
			cleanupDocument(doc);
			
			uber_add(name, doc);
		}
		
		return cont;
	}
	
	/**
	 * Relement all element's line and column positions for faster lookup
	 * @param {String} name
	 * @param {Document} doc
	 * @return {Array} List of indexed tags 
	 */
	function rememberElementLines(name, doc) {
		var result = [];
		$('*', doc).each(function(i, n) {
			var lines = n.getAttribute('xsltrace-line').split('-'),
				cols = n.getAttribute('xsltrace-column').split('-')
				
			result.push({
				elem: n,
				start_line: parseInt(lines[0], 10),
				end_line: parseInt(lines[1] || lines[0], 10),
				start_column: parseInt(cols[0], 10),
				end_column: parseInt(cols[1] || cols[0], 10)
			});
		});
		
		result.sort(function(a, b) {
			return a.start_line - b.start_line
		});
		
		return templates_line_index[name] = result;
	}
	
	/**
	 * Search for element in XML file by its line and column
	 * @param {String} XML/XSL module name
	 * @param {Number} line Element's line
	 * @param {Number} col Element's column
	 * @return {Element}
	 */
	function searchTagByLineCol(name, line, col) {
		line = parseInt(line, 10);
		col = parseInt(col, 10);
		var result;
		if (name in templates_line_index) {
			$.each(templates_line_index[name], function(i, n) {
				if (line >= n.start_line && line <= n.end_line && col >= n.start_column && col <= n.end_column) {
					result = n.elem;
					return false;
				}
			});
		}
		
		return result;
	}
	
	/**
	 * Remove extra data from XML document added by XSL tracer
	 * @param {Document} doc
	 * @return {Document}
	 */
	function cleanupDocument(doc) {
		$('*', doc).removeAttr('xsltrace-line').removeAttr('xsltrace-column');
		return doc;
	}
	
	/** xml-документы, необходимые для дебага */
	var docs = {
		/**
		 * Трассировочная информация
		 * 
		 * @type {Document}
		 */
		trace : null,

		/**
		 * Источник данных для трансформа (xml)
		 * 
		 * @type {Document}
		 */
		source : null,

		/**
		 * Результат работы xsl-преобразования (как правило, это HTML-документ, 
		 * который видит пользователь)
		 * 
		 * @type {Document}
		 */
		result : null,

		/**
		 * Набор всех xsl-шаблонов, участвовавших в получении
		 * <code>docs.result</code>
		 */
		templates : templateContainer(),
		
		/**
		 * Набор всех entity-файлов. При добавлении файла он автоматически
		 * парсится, и сохраняется только набор entity 
		 */
		entities : null
	};
	
	var emptyFn = function(){return ''};
	
	/**
	 * Resolves path to file name, making it usable for downloading
	 * (i.e. make absolute path for document)
	 * @param {String} filename File name
	 * @param {String} type Document type (xsl, dtd, xml) to resolve path for
	 * @return {String}
	 */
	var resolvePath = function(filename, type) {
		return template_path + filename;
	}
	
	
	/**
	 * Индексирует дерево элементов. Индексация представляет 
	 * собой установку атрибута <b>xsldbg-id</b> с уникальным значением 
	 * для элемента. Значение этого атрибута затем используется
	 * внутри <code>SimpleNode.render</code> как атрибут <b>id</b> для
	 * для генерируемого элемента.
	 * 
	 * @param {Element} node Элемент, с которого начинать индексацию
	 */
	function indexTree(node){
		if (node) {
			$.each(node.getElementsByTagName('*'), function(i, /* Element */ n){
				var id = indexTree.id++;
				n.setAttribute('xsldbg-id', 'x' + id);
				indexTree.cache[id] = n;
			});
		}
		
		return node;
	};
	
	indexTree.id = 1;
	indexTree.cache = [];

	/**
	 * Функция, которая строит зависимости между итоговыми элементами,
	 * источником данных и шаблонами. В результате получается самая главная
	 * структура, позволающая определить, откуда пришел итоговый элемент.<br><br>
	 * 
	 * Метод бегает по <code>docs.trace</code> в поисках LRE-элементов (Literal Resource Element), 
	 * которые представляют собой итоговые элементы, попавшие в <code>docs.result</code>. 
	 * Для каждого элемента находится источник, из которого он пришел, а также шаблон,
	 * который его вывел. После этого LRE-элементам ставятся соответствия с элементами
	 * результатирующего документа.<br><br>
	 * 
	 * Функция возвращает массив хэшей со следующими параметрами:<br>
	 * <b>trace</b> : Element — трассировочный элемент из <code>docs.trace</code><br>
	 * <b>source</b> : Element — источник данных из <code>docs.source</code><br>
	 * <b>template</b> : Element — шаблон, которые вывел элемент<br>
	 * <b>result</b> : Element — результатирующий элемент из <code>docs.result</code><br>
	 * 
	 * @return {Array}
	 */
	function buildElementDependencyJSON(){
		/**
		 * Поиск тэга-источника данных для переданного элемента
		 * @param {Element} elem
		 * @param {Element} t_node
		 * @param {Element} template
		 * @return {Element}
		 */
		function findSource(template_node){
			if (!template_node || !template_node.src || !template_node.src.x) 
				return null;
			
			return  xsl_tracer.utils.xpathFind(template_node.src.x, docs.source);
		}
		
		/** Expand entity */
		function ee (str, name){
			if (!str)
				return '';
			str = xsl_tracer.entity.getEntity(str, resolvePath(name, 'xsl'));
			return xsl_tracer.utils.normalizeSpace(str);
		}
		
		/**
		 * Поиск xsl-шаблона
		 * @param {Element} elem
		 * @return {Element}
		 */
		function findTemplate(elem){
			if (!elem) 
				return null;
				
			return searchTagByLineCol(resolvePath(elem.meta.m, 'xsl'), elem.meta.l, elem.meta.c);
		}
	
		/**
		 * Поиск родителя с заданным названием тэга
		 * @param {Element} elem
		 * @param {String} node_name
		 * @return {Element}
		 */
		function findParent(elem, node_name) {
			var result = null;
			do{
				if (elem.tag == node_name) {
					result = elem;
					break;
				}
			}while(elem = elem.parent);
			
			return result;
		}
		
		var trace_deps = buildTraceDepsJSON();
		
		var result = [];
		var elems = [];
		walkTraceDoc(function(elem) {
			if (elem.tag === 'L' || elem.tag.toLowerCase() == 'xsl:element')
				elems.push(elem);
		});
		
		
		$.each(elems, function(i, /* Element */node){
			// TODO научиться работать с комментариями, пришедшими в результатирующий документ
			
			var r = trace_deps.findMatch(node, 'trace');
			
			var template_node = findParent(node, 'xsl:template');
			
			var d = {
				trace: node,
				source: findSource(template_node),
				module: template_node.meta.m,
				template: findTemplate(template_node),
				// FIXME в Опере результат всегда равен null, разобраться, почему
				result: r ? r.result : null
			};
			
			result.push(d);
		});
		
		return result;
	}
 	
	/**
	 * Строит зависимости между элементами трассировочного и результатирующего
	 * документа
	 * 
	 *  @return {Array}
	 */
	function buildTraceDepsJSON(){
		// сохраняем отдельно LRE-элементы
		var lre_elems = [];
		walkTraceDoc(function(elem) {
			if (elem.tag === 'L' || elem.tag.toLowerCase() == 'xsl:element')
				lre_elems.push(elem);
		});
		
		// если выбрать все элементы из DOM-дерева, то порядок следования
		// элементов должен совпадать с порядком LRE-элементов
		var result_elems = docs.result.getElementsByTagName('*'),
			elem_deps = [];
			
		for (var i = 0, il = result_elems.length; i < il; i++) {
			elem_deps.push({
 				result: result_elems[i],
 				trace: lre_elems[i]
 			});
		}
		
 		elem_deps.findMatch = function(node, type){
 			var result = null;
 			$.each(elem_deps, function(i, n){
 				if (n[type] == node) {
 					result = n;
 					return false;
 				}
 			});
 			return result;
 		}
 		
 		return elem_deps;
 	}
 	
 	/**
 	 * Search for distinct XSL modules in trace document and returns them.
 	 * @param {Object} doc Trace doc (JSON)
 	 * @return {Array}
 	 */
 	function findModules(doc) {
 		var _mod_lookup = {},
 			result = [];
 			
 		walkTraceDoc(function(elem) {
 			if (elem.meta && elem.meta.m && !(elem.meta.m in _mod_lookup)) {
				result.push(elem.meta.m);
				_mod_lookup[elem.meta.m] = true;
 			}
 		}, doc);
 		
 		return result;
 	}
 	
 	/**
	 * Вспомогательная функция для загрузки одного файла
	 * 
	 * @param {String} url Адрес файла
	 * @param {String} doc_type Тип документа
	 * @param {Function} [callback] Функция, выполняемая после загрузки файла
	 * @param {String} [data_type] Тип данных в загружаемом файле файла (xml, text)
	 */
	function loadFile(url, doc_type, data_type, callback) {
		if ($.inArray(url, loadFile.query_cache) != -1)
			return;
		
		loadFile.query_cache.push(url);
		loadFile.num_loading++;

		var evt_data = {
			url: url,
			doc_type: doc_type
		};
		
		dispatcher.dispatchEvent(EVENT.LOAD_FILE_START, evt_data);
		
		var loadSuccess = function(data) {
			
			if (data_type == 'json') {
				if (typeof data == 'string')
					data = JSON.parse(data);
			}
			
			if (doc_type == 'trace')
				preprocessTraceDoc(data);
			
			if (docs[doc_type] && docs[doc_type].add) {
				docs[doc_type].add(url, data);
			} else {
				docs[doc_type] = data;
			}
			
			if (data_type == 'xml')
				indexTree(data);

			dispatcher.dispatchEvent(EVENT.LOAD_FILE_COMPLETE, evt_data);
			if (callback) {
				callback(data, url);
			}
			loadFile.num_loading--;
		};
		
		/**
		 * Сообщение об ошибке загрузки файла
		 * @param {Number} code Код сообщения
		 * @param {String} status Текст ошибки
		 */
		function fileError(code, status){
			dispatcher.dispatchEvent(EVENT.LOAD_FILE_ERROR, 
				{
					url: url,
					error_code: code,
					error_status: status
				}
			);
			loadFile.num_error++;
			loadFile.num_loading--;
		}
		
		$.ajax({
			dataType : data_type || 'text',
			error : function(/* XmlHttpRequest*/xhr, text_status, error_thrown) {
				if (text_status == 'parsererror') {
					// ошибка парсинга часто возникает тогда, когда
					// не найден SYSTEM-доктайп, поэтому удалим ссылку
					// на его в файле и попытаемся заново распарсить
					var text_data =  xsl_tracer.entity.cleanup(xhr.responseText);
					
					var parsed_xml = xsl_tracer.utils.toXML(text_data);
					
					if (!parsed_xml && doc_type == 'result') {
						// после замены энтити файл все равно не распарсился.
						// возможно, к нам пришел вполне валидный html, попробуем
						// привести его в порядок
						parsed_xml = xsl_tracer.utils.toXML(HTMLtoXML(text_data));
					}
					
					// если и сейчас не смогли распарсить документ, значит,
					// он к нам пришел невалидным
					if (!parsed_xml) {
						fileError(-1, 'Invalid XML');
					} else {
						loadSuccess(parsed_xml);
					}
				} else {
					// произошла серверная ошибка (например, файл не найден)
					fileError(xhr.status, xhr.statusText);
				}
			},

			success : loadSuccess,

			type : 'get',
			url : url
		});
	}
	
	/** 
	 * Количество файлов, которые загружаются в данный момент 
	 * или находятся в очереди загрузки 
	 */
	loadFile.num_loading = 0;
	
	/**
	 * Количество ошибок, возникших при загрузке файлов.
	 * Ошибки могут быть связаны с транспортом (например, загружаемый файл не найден),
	 * а также с парсингом (например, пришел не валидный xml). 
	 * Если ошибок больше нуля, то дебаггер не проинициализируется.
	 */
	loadFile.num_error = 0;
	
	/** Кэш адресов загруженных документов */
	loadFile.query_cache = [];
	
	/**
	 * Загрузка всех xml-данных для дебаггера. Метод вызывается только один раз,
	 * при инициализации страницы. В хэше параметров могут быть следующие 
	 * значения: <br><br>
	 * 
	 * <b>source_url</b> : String —  Адрес источника xml-данных страницы<br>
	 * <b>template_path</b> : String — Путь к контейнеру шаблонов<br>
	 * <b>template_file</b> : String — Название файла-шаблона, через который прошла трансформация<br>
	 * <b>trace_url</b> : String — Адрес трассировочных данных<br>
	 * <b>result_url</b> : String — Адрес результата преобразования
	 * 
	 * @param {Object} params
	 */
	function load(params) {
		// начинаем загрузку
		dispatcher.dispatchEvent(EVENT.LOAD_START);

		template_path = params.template_path;
		
		loadFile(params.trace_url, 'trace', 'json', function(doc) {
			$.each(findModules(doc), function(i, n) {
				loadFile(resolvePath(n, 'xsl'), 'templates');
			});
		});
		loadFile(params.source_url, 'source', 'xml');
		loadFile(params.result_url, 'result', 'xml');
		
		// ожидаем завершения загрузки всех файлов
		var wait_timer = setInterval(function() {
			if (!loadFile.num_loading) {
				// все загрузилось
				clearInterval(wait_timer);
				dispatcher.dispatchEvent(EVENT.LOAD_COMPLETE);
			}
		}, 300);
	}

	return {
		/**
		 * Инициализация дебаггера.
		 * 
		 * @param {Object} params Хэш параметров дебаггера
		 */
		init : function(params) {
			this.addEventListener(EVENT.LOAD_COMPLETE, function(){
				if (!loadFile.num_error) {
					// нету ошибок, можем инициализироваться
					deps = buildElementDependencyJSON();
					dispatcher.dispatchEvent(EVENT.INIT);
				}
			});
			
			load(params);
		},

		EVENT : EVENT,

		/**
		 * Подписка на события дебаггера
		 * 
		 * @param {String} type Тип события (см. <code>xsl_tracer.EVENT</code>)
		 * @param {Function} listener
		 */
		addEventListener : function(type, listener) {
			dispatcher.addEventListener(type, listener);
		},

		/**
		 * Отписка от событий дебаггера
		 * 
		 * @param {String} type Тип события (см. <code>xsl_tracer.EVENT</code>)
		 * @param {Function} listener
		 */
		removeEventListener : function(type, listener) {
			dispatcher.removeEventListener(type, listener);
		},
		
		/**
		 * Возвращает документ, участвовавший в преобразовании.
		 * Параметр <code>type</code> может иметь одно из следующих значений:
		 * <b>trace, source, result, templates, entities</b>. Некоторые 
		 * документы могут состоять из нескольких файлов-модулей (например, 
		 * templates). В этом случае можно передать параметр <code>module</code>
		 * с названием модуля (как правило, это имя файла). Если параметр 
		 * <code>module</code> не передавать, вернется массив с наваниями модулей.
		 * 
		 * @param {String} type Тип документа
		 * @param {String} [module] Название модуля
		 * @return {Document, Array}
		 */
		getDocument: function(type, module){
			var d = docs[type];
			if (d.add) { // это контейнер
				return (module) ? d.find(module) : d.getList();
			} else {
				return d;
			}
		},
		
		/**
		 * Возвращает массив с зависимостями элементов
		 * @return {Array}
		 */
		getDependencies: function(){
			if (!deps)
				deps = buildElementDependencyJSON();
			return deps;
		},
		
		/**
		 * Возвращает элемент одного из трансформ-документов по его уникальному
		 * идентификатору. Все элементы из трансформ-документов получают свои 
		 * идентификаторы в методе <code>indexTree</code>
		 * 
		 * @param {String} id
		 * @return {Element}
		 */
		getElementById: function(id){
			id = parseInt(id.substr(1));
			return indexTree.cache[id];
		},
		
		/**
		 * Setup function that is used for path resolving. This function should
		 * accept two arguments: <code>filename</code> (file's name) and 
		 * <code>type</code> (document type: xsl, dtd, xml)
		 * @param {Function} fn
		 */
		setPathResolver: function(fn) {
			resolvePath = fn;
		},
		
		resolvePath: resolvePath,
		
		loadFile: loadFile
	}
}();