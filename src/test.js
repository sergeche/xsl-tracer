/**
 * @author Sergey Chikuyonok (sc@design.ru)
 * @copyright Art.Lebedev Studio (http://www.artlebedev.ru)
 * 
 * @include "/xsl-debug/src/js/xsl-debugger.js"
 * @include "/xsl-debug/src/js/htmlparser.js"
 */
 
 $(function(){
	
 	function escapeEntity(text, callback) {
		callback = callback || function(){return '';};
		text = text.replace(/<\!DOCTYPE\s+.+?\s+SYSTEM\s+['"](.+?)['"]>/i, callback);
		// эскейпим энтити, что не мешали в преобразовании в xml
		return text.replace(/&([^#]+?);/gi, '&amp;$1;');
	}
 	
 	$.ajax({
		dataType : 'xml',
		error : function(/* XmlHttpRequest*/xhr, text_status, error_thrown) {
			console.log('got error');
			if (text_status == 'parsererror') {
				var text_data = escapeEntity(xhr.responseText);
				
				text_data = HTMLtoXML(text_data);
				
//				var parsed_xml = false;
				var parsed_xml = xsl_debugger.utils.toXML(text_data);
				
				// если и сейчас не смогли распарсить документ, значит,
				// он к нам пришел невалидным
				if (!parsed_xml) {
					alert('still invalid')
				} else {
					alert('file became valid');
				}
			} else {
				alert('unknown error');
			}
		},

		success : function(){ alert('load ok'); },

		type : 'get',
		url : 'test.html'
	});
 });