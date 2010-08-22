/**
 * List of event names broadcasted by XSL tracer.
 * You can subscribe to any of these events by calling
 * <code>xsl_tracer.addListener(event_name, listener)</code>
 * 
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 *//** Start loading external documents */
var EVT_LOAD_START = 'onloadstart',

	/** All external documents are loaded */
	EVT_LOAD_COMPLETE = 'onloadcomplete',

	/**
	 * Start loading a single document. The <code>data</code> event's property
	 * contains hash with the following properties:<br><br>
	 * <b>url</b> : String — URL of loading file
	 */
	EVT_LOAD_FILE_START = 'onloadfilestart',

	/**
	 * Single file is loaded. The <code>data</code> event's property
	 * contains hash with the following properties:<br><br>
	 * <b>url</b> : String — URL of loaded file
	 */
	EVT_LOAD_FILE_COMPLETE = 'onloadfilecomplete',
	
	/**
	 * Error while loading file. The <code>data</code> event's property
	 * contains hash with the following properties:<br><br>
	 * <b>url</b> : String — URL of loaded file<br>
	 * <b>error_code</b> : Number — Code error<br>
	 * <b>error_data</b> : String — Error description
	 */
	EVT_LOAD_FILE_ERROR = 'onloadfileerror',
	
	/**
	 * Start XSL tracer initialization
	 */
	EVT_INIT = 'oninit',
	
	/**
	 * This event is broadcasted whenever tracer error occures. 
	 * The <code>data</code> event's property
	 * contains hash with the following properties:<br><br>
	 * <b>error_name</b> : String — Error name<br>
	 * <b>error_data</b> : Object — Additional error data 
	 */
	EVT_ERROR = 'onerror',
	
	/**
	 * XSL tracer is completely initiated, you can start working now.
	 */
	EVT_COMPLETE = 'oncomplete',
	
	/** 
	 * User wants to trace element (e.g. clicked on element of result document).
	 * The <code>data</code> event property contains tracing object 
	 */
	EVT_TRACE = 'ontrace',
	
	/**
	 * Switch document in main content pane<br><br>
	 * Event data:<br>
	 * <code>type</code> : String – Document type ('xml', 'xsl', etc.)<br>
	 * <code>name</code> : String – Document name or index<br>
	 * <code>hl</code> : Element|String – Highlight specified element when 
	 * document is rendered. Could be element or line-column pair
	 */
	EVT_SWITCH_DOCUMENT = 'onswitchdoc';