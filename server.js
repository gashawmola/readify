var system    = require("system"),
    webserver = require("webserver"),
    webpage   = require("webpage");

var config     = require("./config.js"),
    readify = require('./readify'),
    redirectingUrls = require('./redirecting_urls'),
    rewriteUrls = require('./rewrite_urls'),
    benchmark = require('./benchmark');

function onRequest(req, res) {
  var page          = webpage.create(),
      requestServed = false;

  if (req.method != "GET") {
    return send(405, toHTML("Method not accepted."));
  }

  var url = parse(req.url);

  if(url.pathname == "/test"){
    return send(200, toHTML("Test is OK"));
  } else if (url.pathname != "/") {
    return send(404, toHTML("Not found."));
  }

  var query = url.query,
      href  = query.href;

  if (!href) {
    return send(400, toHTML("`href` parameter is missing."));
  }

  var maxTime = 10000//config.maxTime;
  if(isUrlRedirecting(href)){
    maxTime = 2*maxTime;
  }
  var timeout = setTimeout(function(){
    console.log("page readify timeout (" + maxTime + "ms)");
    send(502, toHTML("page readify timeout"));
  }, maxTime);

  var configPage = function(page){

    var iframeUrls = [];

    page.settings.userAgent = "Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2049.0 Safari/537.36";

    page.viewportSize = {
      width: 1920,
      height: 1080
    }

    page.onInitialized = function() {

      page.evaluate(onInit, config.readyEvent);

      function onInit(readyEvent) {
        window.addEventListener(readyEvent, function() {
          setTimeout(window.callPhantom, 0);
        })
      }
    }

    page.onResourceRequested = function(requestData, networkRequest){
      if(page.url != 'about:blank' && !/(\.css|\.js|\.png|\.gif|\.jpe?g)(\?.*)?$/.test(requestData.url)){
         var index = iframeUrls.indexOf(requestData.url);
         if(index != -1){
          // console.log("aborting: "+ requestData.url.substring(0, 256));
          networkRequest.abort();
         }
      }
    }

    page.onCallback = function() {
      send(200, JSON.stringify(out), true);
    }

    page.onConsoleMessage = function(msg) {
      if((/^(Readify|Benchmark)/).test(msg)){
        console.log('page: ' + msg);
      }
    };

    page.onNavigationRequested = function(url, type, willNavigate, main){
      var openNewPage = function(newUrl){
        console.log("navigating... : " + page.url + " > " + newUrl);
        page.close();
        openPageAndReadify(newUrl);
      }
      // console.log("nav req: " + page.url + " > " + url);
      var rewritedUrl = findRewriteUrl(url);
      if(rewritedUrl){
        openNewPage(rewritedUrl);
      } else if (page.url != 'about:blank' && page.url != "" && page.url != url && main){
        openNewPage(url);
      }
      if(!main){
        iframeUrls.push(url);
      }
    }
  }

  var out;

  var openPageAndReadify = function(url){
    var page = webpage.create();
    configPage(page);
    var startedAt = new Date;
    page.open(url, function(status){
      console.log("Benchmark - " + page.url + " open: " + ( (new Date).getTime() - startedAt.getTime() ) + "ms");
      if(!isUrlRedirecting(page.url)){
        page.render("webpage.png");
        page.injectJs('benchmark.js');
        out = page.evaluate(readify);
      }
    });
  }

  openPageAndReadify(href);

  function send(statusCode, data, isJson) {
    if(!requestServed){
      clearTimeout(timeout);

      res.statusCode = statusCode;
      if(isJson){
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      } else {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
      }
      res.setHeader("Content-Length", byteLength(data));

      res.write(data);
      res.close();
      res = null;

      page.close();
      page = null;

      requestServed = true;
    }
  }
}

function isUrlRedirecting(url){
  var i, l, matching = false;
  for(i = 0, l = redirectingUrls.length; i < l; ++i){
    if(redirectingUrls[i].test(url)){
      matching = true;
      break;
    }
  }
  return matching;
}

function findRewriteUrl(url){
  var i, l, match = null, newUrl = null;
  for(i = 0, l = rewriteUrls.length; i < l; ++i){
    match = rewriteUrls[i].exec(url);
    if(match){
      newUrl = match[1];
      break;
    }
  }
  return newUrl;
}

function byteLength(str) {
  return encodeURIComponent(str).match(/%..|./g).length;
}

function toHTML(message) {
  return "<!DOCTYPE html><html><head><title>Readify</title></head><body>" + message + "</body></html>\n";
}

function parse(url) {
  var anchor = document.createElement("a");

  anchor.href = url;
  anchor.query = {};

  anchor.search.slice(1).split("&").forEach(function(pair) {
    pair = pair.split("=").map(decodeURIComponent);
    anchor.query[pair[0]] = pair[1];
  })

  return anchor;
}

if (!config.port) {
  console.error("No port specified in config.js");
  phantom.exit(1);
}

var server    = webserver.create();
var port = Number(system.env.PORT || system.args[1]) || config.port;
var listening = server.listen(port, onRequest);

if (!listening) {
  console.error("Could not bind to port " + port);
  phantom.exit(1);
}
console.log("Listening on port " + port);
