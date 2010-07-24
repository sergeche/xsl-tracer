/**
 * @author 		Matthew Foster
 * @date		June 6th 2007
 * @purpose		To have a base class to extend subclasses from to inherit event dispatching functionality.
 * @procedure	Use a hash of event "types" that will contain an array of functions to execute.  The logic is if any function explicitally returns false the chain will halt execution.
 */

var EventDispatcher = function(){};

EventDispatcher.prototype = {
	buildListenerChain : function(){
		if(!this.listenerChain)
			this.listenerChain = {};
	},

	/**
	 * Добавляет слушатель события
	 * @param {String} type Название события
	 * @param {Function} listener Слушатель
	 */
	addEventListener : function(type, listener){
		if(!listener instanceof Function)
			throw { message : "Listener isn't a function" };

		this.buildListenerChain();

		if(!this.listenerChain[type])
			this.listenerChain[type] = [listener];
		else
			this.listenerChain[type].push(listener);
	},

	/**
	 * Проверяет, есть ли у такого события слушатели
	 * @param {String} type Название события
	 * @return {Boolean}
	 */
	hasEventListener : function(type){
		return (typeof this.listenerChain[type] != "undefined");
	},

	/**
	 * Удаляет слушатель события
	 * @param {String} type Название события
	 * @param {Function} listener Слушатель, который нужно удалить
	 */
	removeEventListener : function(type, listener){
		if(!this.hasEventListener(type))
			return false;

		for(var i = 0; i < this.listenerChain[type].length; i++)
			if(this.listenerChain[type][i] == listener)
				this.listenerChain.splice(i, 1);
	},

	/**
	 * Инициирует событие
	 * @param {String} type Название события
	 * @param {Object} [args] Дополнительные данные, которые нужно передать слушателю
	 */
	dispatchEvent : function(type, args){
		this.buildListenerChain();

		if(!this.hasEventListener(type))
			return false;

		/** @type {Array} */
		var lst = this.listenerChain[type];

		for(var i = 0, il = lst.length; i < il; i++){
			lst[i](new CustomEvent(type, this, args));
		}
	}
};

/**
 * Произвольное событие. Создается в EventDispatcher и отправляется всем слушателям
 * @constructor
 * @param {String} type Тип события
 * @param {Object} target Объект, который инициировал событие
 * @param {Object} [data] Дополнительные данные
 */
function CustomEvent(type, target, data){
	this.type = type;
	this.target = target;
	if(data){
		this.data = data;
	}
}

/**
 * Класс Delegate создает обертку для функции, позволяя выполнять ее
 * в контексте переданного объекта.
 */
var Delegate = {};

/**
 * Создает обертку для функции, позволяя выполнять в ее
 * контексте переданного объекта.
 * @param {Object} target Объект, в контексте которого нужно выполнить функцию
 * @param {Function} func Функция
 * @param {Array} [args] Аргументы функции
 * @return {Function}
 */
Delegate.create = function(target, func, args){
	args = args || [];
	return function(){
		var _args = [];
		if(arguments.length){
			_args.push.apply(_args, arguments);
		}
		if(args.length){
			_args.push.apply(_args, args);
		}
		return func.apply(target, _args);
	};
};
