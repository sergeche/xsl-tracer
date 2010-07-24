/**
 * Константы для событий
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 */	/** Начало загрузки всех xml-документов, необходимых для дебага */
var EVT_LOAD_START = 'onLoadStart',

	/** Все xml-документы, необходимые для дебага, загружены */
	EVT_LOAD_COMPLETE = 'onLoadComplete',

	/**
	 * Начало загрузки одного файла. В свойство <code>data</code> события
	 * прийдет хэш с параметрами:<br>
	 * <b>url</b> : String — адрес загружаемого файла
	 */
	EVT_LOAD_FILE_START = 'onLoadFileStart',

	/**
	 * Файл загружен. В свойство <code>data</code> события прийдет хэш с
	 * параметрами:<br>
	 * <b>url</b> : String — адрес загруженного файла
	 */
	EVT_LOAD_FILE_COMPLETE = 'onLoadFileComplete',
	
	/**
	 * Ошибка при загрузке файла. В свойство <code>data</code> события 
	 * прийдет хэш с параметрами:<br>
	 * <b>url</b> : String — адрес загруженного файла<br>
	 * <b>error_code</b> : Number — Код ошибки<br>
	 * <b>error_status</b> : String — Текстовый статус ошибки
	 */
	EVT_LOAD_FILE_ERROR = 'onLoadFileError',
	
	/**
	 * Завершена инициализация, можно работать с ресурсами дебаггера
	 */
	EVT_INIT = 'onInit';
