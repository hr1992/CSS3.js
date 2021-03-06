/* global seajs, define */
(function(window, seajs) {
	"use strict";
	var document = window.document;
	var core = "stylefix";
	var msie = document.querySelector ? document.documentMode : ("XMLHttpRequest" in window ? 7 : 6);
	seajs.config({
		// 别名配置
		alias: {
			placeholder: (!("placeholder" in document.createElement("input")) || msie || +navigator.userAgent.replace(/.*(?:\bA\w+WebKit)\/?(\d+).*/i, "$1") < 536) ? "placeholder" : core,
			PIE: msie < 9 ? "PIE_IE678" : (msie < 11 ? "PIE_IE9" : core),
			selectivizr: document.querySelector ? core : "selectivizr",
			matchmedia: window.matchMedia ? core : "matchmedia",
			mOxie: window.FileReader ? core : "moxie.js",
			prefixfree: msie < 9 ? core : "prefixfree",
			cssprops: msie < 11 ? "cssprops" : core,
			"es5-shim": "es5-shim.min",
			cssunits: "cssunits",
			stylefix: core
		}
	});
	define.cmd = true;
})(window, seajs);