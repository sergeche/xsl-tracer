/**
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "xsl_tracer.js"
 * @include "xsl_tracer.utils.js"
 */

/**
 * Работа с пользовательским интерфейсом дебаггера
 */
xsl_tracer.ui = function(){
	/** Текущий шаблон, который отображается на странице */
	var current_template;
	
	/** 
	 * Выбиралка шаблонов
	 * @type {jQuery} 
	 */
	var template_selector
	
	/**
	 * Последнее найденное совпадение
	 * @type {Object}
	 */
	var last_match;
	
	/**
	 * Последний элемент, на который наводили курсор
	 * @type {jQuery}
	 */
	var last_hover;
	
	/**
	 * Отрисовка секции с шаблонами
	 */
	function drawTemplates(){
		var section = $('#xsldbg-template');
		
		// сначала получаем список шаблонов
		/** @type {Array} */
		var templates = xsl_tracer.getDocument('templates');
		
		// делаем выбиралку шаблонов
		template_selector = $('<select name="xsldbg-template">');
		$.each(templates, function(i, n){
			template_selector.append('<option>' + n +' </option>');
		});
		
		section.find('.xsldbg-header').append(template_selector);
		template_selector.change(function(){
			showTemplate(this.value);
		});
		
		showTemplate(templates[0]);
	}
	
	/**
	 * Отрисовка источника данных
	 */
	function drawSource(){
		var sources = xsl_tracer.getDocument('source');
		$('#xsldbg-source .xsldbg-content').empty()
			.append(drawXml(xsl_tracer.getDocument('source', sources[0])));
	}
	
	/**
	 * Отрисовка результатирующего html-документа
	 */
	function drawResult(){
		$('#xsldbg-result .xsldbg-content').empty()
			.append(drawXml(xsl_tracer.getDocument('result')))
			.click(function(/* Event */ evt){
				var obj = $(evt.target);
				if (obj.hasClass('xsldbg-switcher'))
					return;
				
				if (!obj.hasClass('xsldbg-element'))
					obj = obj.parents('.xsldbg-element:first');
				
				var ref = xsl_tracer.getElementById(obj.attr('id'));
				
				$.each(xsl_tracer.getDependencies(), function(i, o){
					if (ref == o.result) {
						markMatch(o);
						return false;
					}
				});
			});
	}
	
	/**
	 * Возвращает указатель на элемент, который отображает переданный элемент 
	 * на странице
	 * @param {Element} ref
	 * @return {jQuery}
	 */
	function getElementFromReference(ref){
		var id = ref.getAttribute('xsldbg-id');
		return $('#'+id);
	}
	
	/**
	 * Помечает элемент на странице как выделенный (означает, что элемент 
	 * участвовал в трансформации) 
	 * @param {Element} elem Элемент из дерева трансформаций (см. <code>xsl_tracer.getDocument()</code>), который нужно подсветить
	 * @param {Boolean} [dont_scroll] Не скроллить к указанному элементу  
	 */
	function markElement(elem, dont_scroll){
		var page_elem = getElementFromReference(elem);
		page_elem.addClass('marked').parents('.xsldbg-element').removeClass('collapsed');
		
		// если элемент еще не подсвечен — подсвечиваем и строим крошки
		if (!page_elem.hasClass('selected')) {
			hiliteElement(elem, dont_scroll);
			buildCrumbs(elem);
		}
	}
	
	/**
	 * Подсвечивает элемент на странице и автоматически «докручивает» контейнер 
	 * до его позиции
	 * @param {Element} elem Элемент из дерева трансформаций (см. <code>xsl_tracer.getDocument()</code>), который нужно подсветить
	 * @param {Boolean} [dont_scroll] Не скроллить к указанному элементу
	 * @return {jQuery} Возвращает элемент на странице, представляющий переданный элемент
	 */
	function hiliteElement(elem, dont_scroll){
		var page_elem = getElementFromReference(elem);
		// снимаем выделение с предыдущего элемента
		page_elem.parents('.xsldbg-section').find('.selected').removeClass('selected');
		
		page_elem.addClass('selected');
		if (!dont_scroll) {
			page_elem.get(0).scrollIntoView();
		}
		
		return page_elem;
	}
	
	/**
	 * Снимает выделение с элемента на странице
	 * @param {Element} elem Элемент из дерева трансформаций (см. <code>xsl_tracer.getDocument()</code>)
	 */
	function unmarkElement(elem){
		getElementFromReference(elem).removeClass('marked selected');
	}
	
	function markMatch(obj){
		unmarkLastMatch();
		
		showTemplate(obj.module);
		
		markElement(obj.result, true);
		markElement(obj.template);
		markElement(obj.source);
		
		last_match = obj;
	}
	
	function unmarkLastMatch(){
		if (last_match) {
			unmarkElement(last_match.result);
			unmarkElement(last_match.source);
			unmarkElement(last_match.template);
		}
	}
	
	function showTemplate(name){
		if (current_template != name) {
			var ix = parseInt(name);
			if (!isNaN(ix))
				name = ix;
			
			$('#xsldbg-template .xsldbg-content').empty()
				.append(drawXml(xsl_tracer.getDocument('templates', name)));
			
			template_selector.find('option').each(function(){
				if (this.value == name) 
					this.selected = true;
			});
			
			current_template = name;
		}
	}
	
	/**
	 * Строит структуру из «хлебных крошек» для элемента: набор родительских 
	 * элементов
	 * @param {Element} elem Элемент из дерева трансформаций (см. <code>xsl_tracer.getDocument()</code>), который нужно подсветить
	 * @return {jQuery}
	 */
	function buildCrumbs(elem){
		var crumbs = '';
		
		/**
		 * Возвращает набор атрибутов у элемента <code>elem</code>. 
		 * Необязательная функция <code>callback(name, value)</code>, формирует 
		 * значение, попавшее в результат 
		 * @param {Element} elem Элемент, у которого нужно получить атрибуты 
		 * @param {String, Array} attrs Атрибут или массив атрибутов, которые нужно получить
		 * @param {Function} [callback]
		 * @return {Array}
		 */
		function getAttrs(elem, attrs, callback) {
			if (typeof attrs == 'string')
				attrs = [attrs];
			callback = callback || function(name, value){ return name + '=' + value};
			var result = [];
			for (var i = 0; i < attrs.length; i++) {
				var a = elem.getAttribute(attrs[i]);
				if (a) {
					result.push(callback(attrs[i], a));
				}
			}
			
			return result;
		}
		
		function htmlCallback(name, value) {
			switch (name) {
				case 'id':
					return '#' + value;
				case 'class':
					return '.' + value;
				default:
					return name + '=' + value;
			}
		}
		
		do{
			var label = elem.nodeName;
			switch (label) {
				case 'xsl:template':
					label += '[' + getAttrs(elem, ['name', 'match']).join(' ') + ']';
					break;
				default:
					label += getAttrs(elem, ['id', 'class'], htmlCallback).join('');
			}
			
//			crumbs += '<li xpath="' + xsl_tracer.utils.createXPath(elem) + '">' + label + '</li>';
			crumbs += '<li ref="' + elem.getAttribute('xsldbg-id') + '">' + label + '</li>';
			if (elem.parentNode == elem.ownerDocument)
				break;
		}while(elem = elem.parentNode);
		
		crumbs = $('<ul class="xsldbg-crumbs">' + crumbs + '</ul>');
		crumbs.find('li').click(navigateFromCrumb).eq(0).addClass('selected').end();
		
		getElementFromReference(elem)
			.parents('.xsldbg-section')
			.find('.xsldbg-status')
			.empty()
			.append(crumbs);
		
		//crumbs.data('xsldbg-doc', elem.ownerDocument);
		
		return crumbs;
	}
	
	/**
	 * Подсветка элемента при клике на «хлебную крошку»
	 * @param {Event} evt 
	 */
	function navigateFromCrumb(evt){
		var elem = $(this);
		
		if (elem.hasClass('selected'))
			return;
		
		/** @type {Document} */
		var ref = xsl_tracer.getElementById(elem.attr('ref'));
		
		// посвечиваем выбранную «крошку»
		elem.addClass('selected').siblings().removeClass('selected');
		
		hiliteElement(ref);
	}
	
	/**
	 * Отрисовка xml-документа
	 * @param {Document} doc
	 * @return {Element}
	 */
	function drawXml(doc){
		var struct = xsl_tracer.utils.filterTree(doc.documentElement, function(node){
			return (node.nodeType == 1 || node.nodeType == 3);
		}).render('text');
		
		// быстрый и грязный способ преобразовать html-текст в DOM-дерево
		var _e = document.createElement('div');
		_e.innerHTML = struct;
		struct = _e.firstChild;
		
		$(struct).find('.xsldbg-element:has(.xsldbg-element)').prepend('<span class="xsldbg-switcher"></span>');
		
		return struct;
	}
	
	/**
	 * Стандартные события, обрабатываемые на всех секциях
	 * @param {Event} evt
	 */
	function sectionEvents(evt){
		var elem = $(evt.target);
		if (!elem.hasClass('xsldbg-element'))
			elem = elem.parents('.xsldbg-element:first');
			
		switch (evt.type) {
			case 'mouseover':
				elem.addClass('hover');
				last_hover = elem;
				break;
			case 'mouseout':
				if (last_hover) {
					last_hover.removeClass('hover');
					last_hover = null;
				}
				elem.removeClass('hover');
				break;
			case 'click':
				if ($(evt.target).hasClass('xsldbg-switcher')) {
					elem.toggleClass('collapsed');
				} else {
					var ref = xsl_tracer.getElementById(elem.attr('id'));
					hiliteElement(ref, true);
					buildCrumbs(ref);
				}
				break;
		}
	}
	
	/**
	 * Функция строит пользовательский интерфейс
	 */
	function buildUI(){
		function section(title, id){
			var result = $('<div id="' + id +'" class="xsldbg-section">' +
				'<div class="xsldbg-header"><h2>' + title + '</h2><span class="xsldbg-window-sw"></span></div>' +	
				'<div class="xsldbg-content"></div>' +
				'<div class="xsldbg-status"></div>' +
			'</div>');
			
			result.find('.xsldbg-content')
				.mouseover(sectionEvents)
				.mouseout(sectionEvents)
				.click(sectionEvents);
			
			result.find('.xsldbg-window-sw')
				.click(function(){
				$(this).parent().parent().toggleClass('expanded');
				})
				.attr('title', 'Свернуть/развернуть окно');
			
			return result;
		}
		
		$(document.body)
			.append(section('Шаблон', 'xsldbg-template'))
			.append(section('Источник', 'xsldbg-source'))
			.append(section('Результат', 'xsldbg-result'))
	}
	
	/**
	 * Инициализация рюшечек для загрузчика. Показывает,
	 * какие файлы чейчас грузятся, какие загрузились, а на
	 * каких появились ошибки. Самоликвидируется, если дебаггер
	 * успешно загрузился и проинициализировался.
	 */
	function initLoader(){
		var loader_ui = $('<div id="xsldbg-load"></div>');
		var header = $('<h2>Загрузка файлов</h2>');
		var file_list = $('<ul class="file-list"></ul>');
		
		/**
		 * Создает текстовое сообщение об ошибке
		 * @param {Event} evt Событие, пришедшее из <code>xsl_tracer</code>
		 * @return {String} Отформатированное сообщение
		 */
		function createErrorMessage(evt){
			return '<div class="reason">Error ' + evt.data.error_code + ': ' + evt.data.error_status + '</div>';
		}
		
		var loading_files = [];
		
		xsl_tracer.addEventListener(xsl_tracer.EVENT.LOAD_START, function(){
			$(document.body).append(loader_ui);
		});
		
		xsl_tracer.addEventListener(xsl_tracer.EVENT.INIT, function(){
			loader_ui.remove();
		});
		
		xsl_tracer.addEventListener(xsl_tracer.EVENT.LOAD_COMPLETE, 
			function(/* Event */evt){
				header.addClass('loaded');
			}
		);
		
		xsl_tracer.addEventListener(xsl_tracer.EVENT.LOAD_FILE_START, 
			function(/* Event */evt){
				loading_files.push(evt.data.url);
				file_list.append('<li><span>' + evt.data.url + '</span></li>');
			}
		);
		
		xsl_tracer.addEventListener(xsl_tracer.EVENT.LOAD_FILE_ERROR, 
			function(/* Event */evt){
				var ix = $.inArray(evt.data.url, loading_files);
				file_list.find('li').eq(ix)
					.addClass('load-error')
					.append(createErrorMessage(evt))
					.find('>span').click(function(){
						$(this).parent().toggleClass('expanded');
					});
			}
		);
		
		xsl_tracer.addEventListener(xsl_tracer.EVENT.LOAD_FILE_COMPLETE, 
			function(/* Event */evt){
				var ix = $.inArray(evt.data.url, loading_files);
				file_list.find('li').eq(ix).addClass('load-ok');
			}
		);
		
		loader_ui.append(header).append(file_list);
	}
	
	function init(){
		buildUI();
			
		drawTemplates();
		drawSource();
		drawResult();
	}
	
	// начинаем работу только после того, как проинициализируется дебаггер
	xsl_tracer.addEventListener(xsl_tracer.EVENT.INIT, init);
	
	initLoader();
	
	return {};
}();