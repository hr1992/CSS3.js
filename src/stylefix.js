/**
 * StyleFix 1.0.3
 * @author Lea Verou
 * MIT license
 */

"use strict";
/* global ActiveXObject */
(function(window, undefined) {
	var setTimeout = window.setTimeout,
		selectorEngines = {
			"NW": "*.Dom.select",
			"MooTools": "$$",
			"DOMAssistant": "*.$",
			"Prototype": "$$",
			"YAHOO": "*.util.Selector.query",
			"Sizzle": "*",
			"jQuery": "*",
			"dojo": "*.query"
		},
		document = window.document,
		XDomainRequest = window.XDomainRequest,
		XMLHttpRequest = window.XMLHttpRequest,
		ieVersion = document.querySelector ? document.documentMode : document.compatMode === "CSS1Compat" ? "XMLHttpRequest" in window ? 7 : 6 : 5,
		cors = document.querySelector || XDomainRequest,
		// 缓存已经ajax获取的内容
		responseCache = {},
		// 缓存ajax请求
		requestCache = {},
		ready = [],
		fixers = [],
		self;

	/**
	 * @class CSS3
	 * @static
	 * @description js
	 */

	function noop() {

	}

	/**
	 * @description 查找DOM元素
	 * @function query
	 * @param {String} expr css选择符
	 * @param {Element || HTMLDocument} [con] 查找DOM元素的根节点
	 * @return {HTMLElement[]} 查找到的元素
	 */
	function query(expr, con) {
		// 上下文对象
		con = con || document;
		var nodeList = [];
		// 遍历selectorEngines找到可用的外部DOM选择器
		for (var engine in selectorEngines) {
			var members, member, context = window;
			if (window[engine]) {
				members = selectorEngines[engine].replace("*", engine).split(".");
				while ((member = members.shift()) && (context = context[member])) {}
				// 找到可用的DOM选择器
				if (typeof context === "function") {
					try {
						nodeList = context(expr, con);
						if (nodeList && nodeList.length) {
							break;
						}
					} catch (ex) {}
				}
			}
		}
		// 返回外部DOM选择器找到的DOM或者使用querySelectorAll方法找到的DOM元素
		try {
			nodeList = [].slice.call(nodeList || con.querySelectorAll(expr), 0);
		} catch (ex) {

		}

		return nodeList;
	}

	/**
	 * @description 跨域ajax请求函数
	 * @function get
	 * @async
	 * @param {String} url 请求地址
	 * @param {Function} callback 用于接收ajax返回内容的回调函数
	 */
	function get(url, callback, error) {
		cors = false;
		var xhr,
			mOxie,
			process,
			request,
			response,
			recursive,
			rorigin = /^\w+:\/\/[^\/]+/;
		error = error || noop;
		// 优先使用缓存中的内容
		if (response = responseCache[url]) {
			setTimeout(function() {
				callback(response);
			}, 0);
			// 同一个url的并发请求优先使用缓存而非另外发请求
		} else if (request = requestCache[url]) {
			request.push(callback);
		} else {

			// 创建请求缓存
			requestCache[url] = [callback];

			// 创建ajax对象
			xhr = XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
			xhr.onreadystatechange = function() {
				if (xhr.readyState === 4) {
					process();
				}
			};

			// 用于接收ajax返回内容的函数
			process = function() {
				var response = xhr.responseText.replace(/(^\s+|\s+$)/g, "");
				if (response && (!xhr.status || xhr.status < 400 || xhr.status > 600)) {
					responseCache[url] = response;
					requestCache[url].forEach(function(callback) {
						callback(response);
					});
				} else {
					error(xhr);
				}
			};

			try {
				// 尝试使用普通ajax
				xhr.open("GET", url);
				xhr.send();
			} catch (e) {
				// 跨域时尝试使用IE专有的XDomainRequest
				if (XDomainRequest) {
					xhr = new XDomainRequest();
					xhr.onerror = error;
					xhr.onprogress = noop;
					xhr.onload = process;
					xhr.open("GET", url);
					xhr.send();
				} else {
					recursive = function(m) {
						XMLHttpRequest = (mOxie || m).XMLHttpRequest;
						get(url, callback, error);
					};
					if (mOxie = window.mOxie) {
						recursive();
					} else if (require) {
						// 原版IE7与IE7以下下无XDomainRequest，尝试mOxie方式加载
						require.async(["mOxie"], recursive);
					} else if (rorigin.test(url)) {
						// 原版IE7与IE7下无XDomainRequest，尝试本地加载
						get(url.replace(rorigin, ""), callback, error);
					} else {
						error(xhr);
					}
				}
			}
		}
	}

	/**
	 * @description 兼容IE与非IE的Style标签内容读、写
	 * @function cssContent
	 * @styleElement {HTMLStyleElement} styleElement 要读、写css的style标签
	 * @param  {[String]} 要写入的css
	 * @return {[String]} 读取出的css
	 */
	function cssContent(styleElement, css) {
		var textContent = styleElement.textContent;
		if (css === undefined) {
			// 低版本IE，除首次外可能无法访问原始的css内容，故保存起来
			return textContent || (styleElement.textContent = styleElement.innerText);
		} else {
			// IE下写入css内容，注意若先写内容后插入文档会报错
			// IE下频繁写入会导致白屏等bug，所以写入前检查已有内容是否相同
			if (styleElement.styleSheet && css !== textContent) {
				styleElement.styleSheet.cssText = css;
			}
			// 非IE下写入css内容
			styleElement.textContent = css;
		}
	}

	/**
	 * 读取css文件
	 * @function load
	 * @async
	 * @param {String} url css文件地址
	 * @param {Object} opt 接收css内容的回调、style标签插入位置
	 */
	function load(url, opt) {
		opt = opt || {};
		var base = url.replace(/[^\/]+$/, ""),
			base_scheme = (/^[a-z]{3,10}:/.exec(base) || [""])[0],
			base_domain = (/^[a-z]{3,10}:\/\/[^\/]+/.exec(base) || [""])[0],
			base_query = /^([^?]*)\??/.exec(url)[1],
			callback = opt.callback,
			before = opt.before;
		get(url, function(css) {
			// Convert relative URLs to absolute, if needed
			if (base) {
				css = css.replace(/url\(\s*?((?:"|')?)(.+?)\1\s*?\)/gi, function($0, quote, url) {
					if (/^([a-z]{3,10}:|#)/i.test(url)) {
						// Absolute & or hash-relative
						return $0;
					} else if (/^\/\//.test(url)) {
						// Scheme-relative
						// May contain sequences like /../ and /./ but those DO work
						return "url(\"" + base_scheme + url + "\")";
					} else if (/^\//.test(url)) {
						// Domain-relative
						return "url(\"" + base_domain + url + "\")";
					} else if (/^\?/.test(url)) {
						// Query-relative
						return "url(\"" + base_query + url + "\")";
					} else {
						// Path-relative
						return "url(\"" + base + url + "\")";
					}
				});
			}

			// behavior URLs shoudn’t be converted (Issue #19)
			// base should be escaped before added to RegExp (Issue #81)
			var escaped_base = base.replace(/([\\\^\$*+[\]?{}.=!:(|)])/g, "\\$1");
			css = css.replace(new RegExp("\\b(behavior:\\s*?url\\('?\"?)" + escaped_base, "gi"), "$1");
			var style = document.createElement("style");
			style.setAttribute("data-href", url);
			if (before && before.parentNode) {
				// 如果设置了插入位置，则插入该位置之后
				before.parentNode.insertBefore(style, before);
			} else {
				// 如果为设置插入位置，则插入head
				document.documentElement.childNodes[0].appendChild(style);
			}
			css = fix(css, true, style);
			cssContent(style, css);
			if (callback) {
				callback(style);
			}
		}, function() {
			if (!before) {
				var link = document.createElement("link");
				link.rel = "stylesheet";
				link.href = url;
				document.documentElement.childNodes[0].appendChild(link);
			}
		});
	}

	/**
	 * @description 修正link标签链接的css样式
	 * @function link
	 * @param {HTMLLinkElement} link 需要修正css样式的link元素
	 */
	function linkElement(link) {
		if (link["data-ignore"]) {
			return;
		}

		link["data-ignore"] = true;
		load(link.href, {
			callback: function(style) {
				style.media = link.media;
				style.disabled = link.disabled;
			},
			before: link
		});
	}

	/**
	 * @description 修正style标签内的css样式
	 * @function styleElement
	 * @param {HTMLStyleElement} style 需要修正css样式的style元素
	 */
	function styleElement(style) {
		var disabled = style.disabled;
		cssContent(style, fix(cssContent(style), true, style));
		style.disabled = disabled;
	}

	/**
	 * @description 修正元素的style属性
	 * @function styleAttribute
	 * @param {HTMLElement} element 需要修正style属性的HTML元素
	 */
	function styleAttribute(element) {
		var oldCss,
			newCss;
		if (ieVersion < 8) {
			oldCss = element.style.cssText;
			newCss = fix(oldCss, false, element);
			if (oldCss !== newCss) {
				element.style.cssText = newCss;
			}
		} else {
			oldCss = element.getAttribute("style");
			newCss = fix(oldCss, false, element);
			if (oldCss !== newCss) {
				element.setAttribute("style", newCss);
			}
		}
	}

	/**
	 * 修正整页所有css
	 * @function process
	 */
	function process() {
		if (fixers.length) {
			// Linked stylesheets
			query("link[rel=\"stylesheet\"]").forEach(linkElement);
			// Inline stylesheets
			query("style").forEach(styleElement);
			// Inline styles
			query("[style]").forEach(styleAttribute);
		} else {
			setTimeout(process, 50);
		}
	}

	/**
	 * @description 注册修正css属性的函数
	 * @function register
	 * @param {Function} fixer 要注册的函数
	 * @param {[Int]} index 插入在数组CSS3.fixers中的位置
	 */
	function register(fixer, index) {
		fixers.splice(index === undefined ? fixers.length : index, 0, fixer);
	}

	/**
	 * @description 调用已注册的所有css修正函数
	 * @function fix
	 * @param {String} css css内容
	 * @param {Boolean} raw 是否修正css选择器
	 * @param {HTMLElement} element DOM元素
	 * @return {String} 修正后的css
	 */
	function fix(css, raw, element) {
		fixers.forEach(function(fixer) {
			css = fixer(css, raw, element) || css;
		});
		return css;
	}

	/**
	 * @description 调用已注册的所有css修正函数
	 * @function fix
	 * @param {String} css css内容
	 * @param {Boolean} raw 是否修正css选择器
	 * @param {HTMLElement} element DOM元素
	 * @return {String} 修正后的css
	 */
	function init() {
		contentLoaded(function() {
			ready.forEach(function(fn) {
				fn();
			});
			setTimeout(process, 0);
		});
	}

	register(function(css) {
		return css.replace(/(\/\*[^*]*\*+([^\/][^*]*\*+)*\/)\s*?/g, "");
	});

	/*!
	 * ContentLoaded.js by Diego Perini, modified for IE<9 only (to save space)
	 *
	 * Author: Diego Perini (diego.perini at gmail.com)
	 * Summary: cross-browser wrapper for DOMContentLoaded
	 * Updated: 20101020
	 * License: MIT
	 * Version: 1.2
	 *
	 * URL:
	 * http://javascript.nwbox.com/ContentLoaded/
	 * http://javascript.nwbox.com/ContentLoaded/MIT-LICENSE
	 *
	 */

	// @w window reference
	// @f function reference
	var isReady = false;

	function contentLoaded(fn) {
		function completed() {
			// readyState === "complete" is good enough for us to call the dom ready in oldIE
			if (!isReady) {
				isReady = true;
				fn();
			}
		}
		try {
			return $(completed);
		} catch (ex) {}

		if (isDocComplete()) {
			// Handle it asynchronously to allow scripts the opportunity to delay ready
			setTimeout(completed, 0);

			// Standards-based browsers support DOMContentLoaded
		} else if (document.addEventListener) {
			// Use the handy event callback
			document.addEventListener("DOMContentLoaded", completed, false);

			// If IE event model is used
		} else {
			// Ensure firing before onload, maybe late but safe also for iframes
			document.attachEvent("onreadystatechange", function() {
				if (isDocComplete()) {
					completed();
				}
			});

			// If IE and not a frame
			// continually check to see if the document is ready
			var top;

			try {
				top = !window.frameElement && document.documentElement;
			} catch (e) {}

			if (top && top.doScroll) {
				(function doScrollCheck() {
					if (!isReady) {
						try {
							// Use the trick by Diego Perini
							// http://javascript.nwbox.com/IEContentLoaded/
							top.doScroll("left");
						} catch (e) {
							return setTimeout(doScrollCheck, 50);
						}

						// and execute any waiting functions
						completed();
					}
				})();
			}
		}
	}

	if (require && ![].filter) {
		require.async(["es5-shim"], init);
	} else {
		init();
	}


	function isDocComplete() {
		return /^(complete|interactive)$/.test(document.readyState);
	}

	self = {
		query: query,
		get: get,
		cssContent: cssContent,
		load: load,
		linkElement: linkElement,
		styleElement: styleElement,
		styleAttribute: styleAttribute,
		ieVersion: ieVersion,
		process: process,
		register: register,
		fix: fix,
		ready: function(fn) {
			if (isReady) {
				fn();
			} else {
				ready.push(fn);
			}
		}
	};

	try {
		module.exports = self;
	} catch (e) {
		window.stylefix = self;
	}
})(window);