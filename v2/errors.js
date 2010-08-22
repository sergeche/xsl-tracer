/**
 * List of throwable errors
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 */function XmlParsingError(doc) {
	this.doc = doc;
}

XmlParsingError.prototype = {
	toString: function() {
		return 'XmlParsingError';
	}
}