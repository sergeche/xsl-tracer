/**
 * Extract, parse, load and resolve entities from XSL file
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 * 
 * @include "xsl_tracer.js"
 */xsl_tracer.entity = (function(){
	var re_system = /<\!DOCTYPE\s+xsl:stylesheet\s+SYSTEM\s+['"](.+?)['"]\s*>/i,
		re_inline = /<\!DOCTYPE\s+xsl:stylesheet\s+\[((?:.|[\r\n])+?)\]\s*>/i,
		re_inline_system = /<\!ENTITY\s+%\s+.+\s+SYSTEM\s+['"](.+?)['"]\s*>/i,
		re_entity = /<!ENTITY\s+([^%]+?)\s+['"](.+?)['"]\s*>/ig,
		re_entity_name = /&([^#]+?);/g,
		/** 
		 * List of entities defined in external files.
		 * Uses file name as a key for collection of entities
		 */
		external_entities = {},
		/**
		 * List of entities defined inline in XSL modules.
		 * Uses XSL module name as a key for collection of entities
		 */
		local_entities = {},
		/**
		 * XSL module's external entity references
		 */
		refs = {};
		
		
	/**
	 * Returns list of referenced DTD/entity files in XSL template
	 * @param {String} template XSL template
	 * @return {Array}
	 */
	function getEntityFiles(template) {
		var result = [], 
			m;
		
		// find system entities
		m = template.match(re_system);
		if (m && m[1])
			result.push(m[1]);
		
		// find inline entities
		m = template.match(re_inline);
		if (m && m[1]) {
			// search for inline entity references
			m[1].replace(re_inline_system, function(str, file) {
				result.push(file);
			});
		}
		
		return result;
	}
	
	/**
	 * Search and parse entities from text (DTD file)
	 * @param {String} text Text to parse
	 * @return {Object} Hash of parsed entites
	 */
	function parseEntities(text){
		var m,
			result = {};
		
		// search for entities 
		while ((m = re_entity.exec(text))) {
			result[m[1]] = m[2];
		}
		
		return result;
	}
	
	/**
	 * DTD file load complete callback
	 * @param {String} data File's content
	 * @param {String} File's url
	 */
	function onLoadComplete(data, url) {
		external_entities[url] = parseEntities(data);
	}
	
	/**
	 * Returns entiny definition for XSL module
	 * @param {String} name Entity name
	 * @param {String} module XSL module
	 * @throws exception
	 * @return {String}
	 */
	function getEntity(name, module) {
		// search for entity starting from local ones
		if (local_entities[module] && local_entities[module][name])
			return local_entities[module][name];
			
		// search for definition in external files, bottom-up
		var _refs = refs[module];
			
		if (_refs) {
			for (var i = _refs.length - 1; i >= 0; i--) {
				if (external_entities[_refs[i]] && external_entities[_refs[i]][name])
					return external_entities[_refs[i]][name];
			}
		}
		
		// nothing found, throw exception
		throw "Can't find entity \"" + name + "\" for module \"" + module + "\"";
	}
	
	/**
	 * Expands entity for XSL module
	 * @param {String} name Entity name 
	 * @param {String} module XSL module
	 * @return {String}
	 */
	function expandEntity(name, module) {
		var entity = getEntity(name, module),
			re_name = /&([^#]+?);/; // without g flag!
			
		while (re_name.test(entity)) {
			entity = entity.replace(re_name, function(str, n) {
				return getEntity(n, module);
			});
		}
		
		return entity;
	}
	
	function stripEntity(entity) {
		return entity.replace(/^&|;$/g, '')
	}
	
	return {
		/**
		 * Process XSL module: finds all entity references, parses and removes
		 * them.
		 * @param {String} name Module's name
		 * @param {String} content Module's content
		 * @return {String} XSL module content without entity references
		 */
		processModule: function(name, content) {
			// find external entities
			var files_to_load = [];
			$.each(getEntityFiles(content), function(i, n) {
				n = xsl_tracer.resolvePath(n, 'dtd');
				if (!(n in external_entities))
					files_to_load.push(n);
					
				if (!refs[name])
					refs[name] = [];
				refs[name].push(n);
			});
			
			// find local entities
			var m = content.match(re_inline);
			if (m && m[1]) {
				// search for inline entity references
				local_entities[name] = parseEntities(m[1]);
			}
			
			
			// load entity files
			$.each(files_to_load, function(i, n) {
				xsl_tracer.loadFile(n, 'entities', 'text', onLoadComplete);
			});
			
			return this.cleanup(content);
		},
		
		/**
		 * Remove entity definitions and escape entity names so they don't
		 * break XML parsing
		 */
		cleanup: function(text) {
			return text
				.replace(re_system, '')
				.replace(re_inline, '')
				.replace(/&(?!#|x\d)/gi, '&amp;');
		},
		
		/**
		 * Returns expanded entity value for XSL modue
		 * @param {String} name Entity name
		 * @param {String} module XSL module
		 * @return {String} 
		 */
		getEntity: function(name, module) {
			if (re_entity_name.test(name)) {
				var r = expandEntity(stripEntity(name), module)
				console.log(name, r);
				return r;
			} else {
				// it's not an entity, return as is
				return name;
			}
		}
	}
})();