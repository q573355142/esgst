const { Cu } = require("chrome");
var buttons = require("sdk/ui/button/action");
var data = require("sdk/self").data;
var packageJson = require("./package.json");
var setTimeout = require("sdk/timers").setTimeout;
var tabs = require("sdk/tabs");
var PageMod = require("sdk/page-mod").PageMod;
var Request = require("sdk/request").Request;
var Services = require("resource://gre/modules/Services.jsm").Services;
var FileUtils = require("resource://gre/modules/FileUtils.jsm").FileUtils;
