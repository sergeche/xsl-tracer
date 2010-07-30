/**
 * XSL-трэйсер. Помогает найти то, что скрыто.
 * 
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "EventDispatcher.js"
 * @include "xsl_tracer.utils.js"
 * @include "JSON.js"
 *
 * TODO выводить комментарии в шаблонах
 * FIXME баг при клике на <div class="r"> http://sweets.dev.design.ru/centre/awards/?mode=xsltrace
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
	 * Returns list of referenced DTD/entity files in XSL template
	 * @param {String} template XSL template
	 * @return {Array}
	 */
	function getEntityFiles(template) {
		var result = [], 
			m;
		
		// find system entities
		m = template.match(/<\!DOCTYPE\s+xsl:stylesheet\s+SYSTEM\s+['"](.+?)['"]\s*>/i);
		if (m && m[1])
			result.push(m[1]);
		
		// find inline entities
		m = template.match(/<\!DOCTYPE\s+xsl:stylesheet\s+\[(.+?)\]\s*>/i);
		if (m && m[1]) {
			// search for inline entity references
			m[1].replace(/<\!ENTITY\s+%\s+.+\s+SYSTEM\s+['"](.+?)['"]\s*>/, function(str, file) {
				result.push(file);
			});
		}
		
		return result;
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
			
			var entity_file;
			// вырезаем ссылку на энтити
			var text_data = escapeEntity(content, function(str, p1){
				// грузим файл с энтити
				entity_file = p1;
				loadFile(resolvePath(entity_file, 'dtd'), 'entities');
				return '';
			});
			
			// запоминаем ссылку на энтити-файл
			entities[name] = entity_file;
			
			var doc = xsl_tracer.utils.toXML(text_data);
			if (!doc)
				console.log(name, real_name);
				
			indexTree(doc);
			
			uber_add(name, doc);
		}
		
		/**
		 * Возвращает название энтити-файла, привязанного к шаблону 
		 * <code>name</code>
		 * 
		 * @param {String} name Название шаблона
		 * @return {String}
		 */
		cont.getEntityFileName = function(name){
			return entities[name];
		}
		
		return cont;
	}
	
	/**
	 * Контейнер энтити. Наследуется от <code>fileContainer()</code>
	 */
	function entityContainer(){
		/**
 		 * Раскрывает строку с энтитями — заменяет все энтити на их значения
 		 * @param {String} str Строка с энтити
 		 * @param {String, Object} module Хэш значений энтити. Можно передать название уже существующего модуля в виде строки
 		 * @return {String}
 		 */
 		function expandEntity(str, module){
 			var re_entity = /&([^#]+?);/g;
 			
 			var struct = (typeof module == 'string') ? this.find(module) : module;
 			return str.replace(re_entity, function(str, p1){
				return struct[p1];
			});
 		}
		
		/**
		 * Находит все описания энтити и сохраняет их в хэш.
		 * Энтити, ссылающиеся на дргие энтити, автоматически раскрываются.
		 * @param {String} text Содержимое DTD-файла
		 * @return {Object}
		 */
 		function parse(text){
			var re_entity_def = /<!ENTITY\s+([^%]+?)\s+['"](.+?)['"]\s*>/ig;
			var re_entity = /&([^#]+?);/g;
			var m;
			var result = {};
			
			// ищем определения энтитей 
			while ((m = re_entity_def.exec(text))) {
				result[m[1]] = m[2];
			}
			
			//раскрываем энтити, ссылающиеся на другие энтити
			$.each(result, function(ent, /* String */value){
				result[ent] = xsl_tracer.utils.normalizeSpace(expandEntity(value, result));
			});
			
			return result;
		}
		
		var cont = fileContainer();
		
		var uber_add = cont.add;
		cont.add = function(name, content){
			uber_add(xsl_tracer.utils.getFileName(name), parse(content));
		}
		
		cont.expandEntity = expandEntity;
		
		return cont;
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
		entities : entityContainer()
	};
	
	var emptyFn = function(){return ''};
	
	/**
	 * Убирает энтити из текста, тем самым подготавливая его для нормального 
	 * парсинга в xml. Необязательный параметр <code>callback</code> 
	 * используется как функция замены ссылок на энтити-файл
	 * @param {String} text   
	 * @param {Function} [callback]
	 * @return {String}   
	 */
	function escapeEntity(text, callback) {
		callback = callback || emptyFn;
		// replace system entities
		text = text.replace(/<\!DOCTYPE\s+xsl:stylesheet\s+SYSTEM\s+['"](.+?)['"]>/i, callback);
		
		// replace inline entities
		text = text.replace(/<\!DOCTYPE\s+xsl:stylesheet\s+\[(.+?)\]>/i, callback);
		// эскейпим энтити, чтоб не мешали в преобразовании в xml
		return text.replace(/&(?!#|x\d)/gi, '&amp;');
	}
	
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
			str = docs.entities.expandEntity(str, docs.templates.getEntityFileName(name));
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
				
			
			/** Название шаблона, в котором ведется поиск */
			var module_name = elem.meta.m;
			
			/** 
			 * Документ шаблона, в котором ведется поиск
			 * @type {Document} 
			 */
			var module = docs.templates.find(module_name);
			if (!module) {
                throw new Error('Не могу найти модуль ' + module_name)
			}
			
			var params = elem.attrs || {}; 
			var result = null;
			
			$.each(module.getElementsByTagNameNS(ns_map.xsl, 'template'), function(i, /* Element */node){
				if (params.name && node.getAttribute('name') != params.name) return;
				if (params.match && ee(node.getAttribute('match'), module_name) != params.match) return;
				if (params.mode && node.getAttribute('mode') != params.mode) return;
				
				// если дошли до этого места — мы нашли нужный нам шаблон, 
				// поэтому прекращаем поиски 
				result = node;
				return false;
			});
			
			return result;
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
			var template = findTemplate(template_node);
			
			var d = {
				trace: node,
				source: findSource(template_node),
				module: template_node.meta.m,
				template: template,
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

        EVENT.LOAD_FILE_START

		dispatcher.dispatchEvent(EVENT.LOAD_FILE_START, {url : url});
		
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

			dispatcher.dispatchEvent(EVENT.LOAD_FILE_COMPLETE, {url : url});
			if (callback) {
				callback(data);
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
					var text_data = escapeEntity(xhr.responseText);
					
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
		}
	}
}();