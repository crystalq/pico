String.prototype.contains = function (sub){return(this.indexOf(sub)!=-1);};
if(!window.console) console = {'debug': function(x){}, 'log': function(x){}};
var pico = (function(){
    var _username;
    var _password;
    var inprogress_auth_gets = {};
    var pico = {};
    var scripts = document.getElementsByTagName("script");
    var src = scripts[scripts.length-1].src;
    pico.url = src.substr(0,src.indexOf("client.js")) || src.substr(0,src.indexOf("pico.js"));
    pico.urls = [];
    pico.cache = {};
    pico.cache.enabled = true;
    pico.debug = false;
    pico.td = 0;
    pico.on_error = function(e){console.error(e)};
    pico.on_authentication_failure = function(e, f){console.error("authentication_failure: " + e.exception);};
    pico.exception = function(e){
        e.url = scripts[scripts.length-1].src.split(e.url)[0] + e.url;
        if(e.exception.contains("password") || e.exception.contains("not authorised")){
            var f = function(username, password){
                _username = username;
                _password = hex_md5(password);
                var x = inprogress_auth_gets[e.params._key];
                pico.call_function(x.object, x.function_name, x.args, x.callback, x.use_cache, x.use_auth);
                delete inprogress_auth_gets[e.params._key];
            }
            pico.on_authentication_failure(e, f);
        }else if(e.exception.contains("nonce")){
            var td = e.exception.split(':')[1];
            pico.td += parseInt(td);
            var x = inprogress_auth_gets[e.params._key];
            pico.call_function(x.object, x.function_name, x.args, x.callback, x.use_cache, x.use_auth);
        }
        else{
            pico.on_error(e);
        }
    };
    pico.get_json = function(url, callback){
        return pico.xhr(url, undefined, callback);
    };
    pico.xhr = function(url, data, callback)
    {
        if(typeof(data) == "function" && typeof(callback) == "undefined"){
            callback = data;
            data = undefined;
        }
        if(typeof(data) == "undefined"){
            data = {};
        }
        if(typeof(callback) == "undefined"){
            callback = function(data){console.log(data)};
        }
        if(typeof(data) == "object"){
            data = urlencode(data);
        }
        data =  data.replace(/%20/g,"+");
        xhr = new XMLHttpRequest();
        xhr.open(data.length > 0 ? 'POST' : 'GET', url);
        xhr.resonseType="text";
        xhr.onload = function(e){
            if(xhr.status == 200){
                callback(JSON.parse(this.response), url);
            }
            else{
                pico.exception(JSON.parse(this.response));
            }
        };
        xhr.onerror = pico.exception;
        xhr.send(data);
        return xhr;
    };
    pico.get = function(url, data, callback)
    {
        if(document.getElementsByTagName("body").length > 0 && !url.contains('.js') && !url.contains('.css')){
            return pico.xhr(url, data, callback);
        }
        if(typeof(data) == "function" && typeof(callback) == "undefined"){
            callback = data;
            data = undefined;
        }
        if(typeof(data) == "undefined"){
            data = {};
        }
        if(typeof(data) == "object"){
            data = urlencode(data);
        }
        if(data){
            url += "&" + data;
        }
        if(callback)
        {
            var callback_name = 'jsonp' + Math.floor(Math.random()*10e10);
            window[callback_name] = function(result){callback(result, url); /*delete window[callback_name]*/};
            var params = {'_callback': callback_name};
            url += '&' + urlencode(params);
        }
        url = encodeURI(url);
        var elem;
        if(document.getElementsByTagName("body").length > 0)
        {
            elem = document.getElementsByTagName("body")[0];
            if(url.substr(-4) == '.css'){
                var style = document.createElement('link');
                style.type = 'text/css';
                style.src = url;
                style.rel = "stylesheet";
                style.onload = function(){document.getElementsByTagName("body")[0].removeChild(this)};
                elem.appendChild(style);
            }
            else{
                var script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = url;
                script.onload = function(){document.getElementsByTagName("body")[0].removeChild(this)};
                elem.appendChild(script);
            }
            if(pico.debug) console.log("pico.get in BODY " + url);
        }
        else
        {
            if(pico.debug) console.log("pico.get in HEAD " + url);
            if(url.substr(-4) == '.css'){
                document.write('<link type="text/css" href="' + url + '" rel="stylesheet" />');
            }
            else
            {
                document.write('<script type="text/javascript" src="' + url + '"></scr' + 'ipt>');
            }
        
        }
    };
    pico.call_function = function(object, function_name, args, callback, use_cache, use_auth)
    {
        var request = pico.prepare_request(object, function_name, args, use_cache, use_auth);
        var url = request.base_url;
        var data = request.data;
        if(use_auth){
            var f = callback;
            callback = function(response, url){delete inprogress_auth_gets[request.key]; f(response, url);};
            var x = {}
            x.object = object;
            x.function_name = function_name;
            x.args = args;
            x.callback = callback;
            x.use_cache = use_cache;
            x.use_auth = use_auth;
            inprogress_auth_gets[request.key] = x;
        }
        pico.get(url, data, callback);
    };
    pico.stream = function(object, function_name, args, callback, use_cache, use_auth)
    {
        var request = pico.prepare_request(object, function_name, args, use_cache, use_auth);
        if(!callback) callback = function(response){console.debug(response)};
        var stream = new EventSource(request.url);
        stream.onmessage = function(e){callback(JSON.parse(e.data))};
        return stream;
    };
    pico.prepare_request = function(object, function_name, args, use_cache, use_auth){
        var data = {};
        for(k in args){
            if(args[k] != undefined) data[k] = pico.json.dumps(args[k]);
        };
        var params = {};
        if('__class__' in object){
            params['_module'] = object.__module__;
            params['_class'] = object.__class__;
            params['_init'] = JSON.stringify(object.__args__);
            var url = window[object.__module__].__url__;
        }
        else{
            params['_module'] = object.__name__;
            var url = object.__url__;
        }
        params['_function'] = function_name;
        if(use_auth){
            var now = new Date();
            var time = Math.round((now.getTime() - now.getTimezoneOffset() * 60000) / 1000)
            params['_username'] = _username || '';
            params['_nonce'] = time + (pico.td || 0);
            params['_key'] = hex_md5(_password + params['_nonce']);
        }
        url += 'call/';
        if(!(pico.cache.enabled && use_cache) && !url.contains('?')){
            url += '?'
        }
        url += urlencode(params);
        var request = {};
        request.key = params['_key'];
        request.base_url = url;
        request.data = urlencode(data);;
        request.url = encodeURI(request.base_url + '&' + request.data);
        return request;
    };
    pico['import'] = function(){
        console.error("pico.import has been replaced with pico.load due to a reserved keyword conflict. You must update your code.")
    };
    pico.load = function(module, result_handler)
    {
        // var params = {};
        // if(module.substr(0, 7) != 'http://'){
        //     var url = pico.url + 'module/';
        //     params['_module'] = module;
        // }
        // else var url = module;
        var callback = function(result, url){
            var m = window;
            module_name_parts = module.split('.');
            for(var i in module_name_parts){
                var s = module_name_parts[i];
                m[s] = m[s] || {};
                m = m[s];
            }
            m.__name__ = module;
            m.__url__ = url.substr(0,url.indexOf("call/"));
            test = result;
            for(k in result){
                if(typeof(result[k].__class__) != "undefined"){
                    var cls = result[k];
                    var args = cls['__init__'].args.map(function(x){return x[0]});
                    var code = "m."+ k +" = (function(){";
                    code += "var "+ k + " = function("+ args +") {";
                    code += "    this.__args__ = Array.prototype.slice.call(arguments);";
                    code += "   this.__module__ = '"+ module +"';";
                    code += "   this.__class__ =  '"+ k +"';";
                    code += "};";
                    for(var f in cls){
                        if(f[0] != "_"){
                            code += k + ".prototype."+ f + "=" + func_code(cls[f], f, 'this').replace(/"'this'"/g, 'this');
                        }
                    }
                    code += " return "+ k +"; })();";
                }
                else{
                    var code = "m." + k + "=" + func_code(result[k], k, module);
                }
                eval(code);
            }
            if(result_handler) result_handler(m);
        }
        var obj = {'__name__': 'pico.server', '__url__': pico.url};
        pico.call_function(obj, 'load', {'module_name': module}, callback, false)
    };
    pico.authenticate = function(username, password, callback){
        _username = username;
        _password = hex_md5(password);
        var obj = {'__name__': 'pico', '__url__': pico.url};
        pico.call_function(obj, 'authenticate', {}, callback, false, true)
    };
    pico.unauthenticate = function(){
        _username = null;
        _password = null;
    };
    pico.main = function(){console.log('Pico: DOMContentLoaded')};
    pico.json = {};
    pico.json.dumps = function(obj){
        var extract = function(x){
            if(x == null || x == undefined){
                return x;
            }else if(x.json != undefined){
                return JSON.parse(x.json);
            }else if(typeof(x)=="object" && x.length != undefined){
                var d = [];
                x.forEach(function(v,i){
                    d[i] = extract(v);
                });
                return d;
            }else if(typeof(x)=="object"){
                var d = {};
                keys(x).forEach(function(k){
                    d[k] = extract(x[k]);
                });
                return d;
            }
            return x;
        }
        var d = extract(obj);
        return JSON.stringify(d);
    }
    pico.json.loads = JSON.parse;
    var func_code = function(f, name, module){
        var args = f.args.map(function(x){return x[0]});
        var args_dict = '{' + f.args.map(function(x){return '"' + x[0] + '":' + x[0]}).join(',') + '}';
        var use_cache = f['cache'] || false;
        var use_auth = f['protected'] || false;
        args.push('callback');
        code = "function(" + args + "){\n";
        code += "var args="+ args_dict +";\n";
        if(f['stream']){
            code += 'return pico.stream('+module+', "'+name+'", args, callback, '+use_cache+', '+use_auth+'); \n';
        }
        else{
            code += 'pico.call_function('+module+', "'+name+'", args, callback, '+use_cache+', '+use_auth+'); \n';
        }
        code += '}\n';
        return code;
    };
    return pico;
})();
document.addEventListener('DOMContentLoaded', function(){pico.main()}, false);

var urlencode = function (params){
    return keys(params).map(function(k){return k + "=" + params[k]}).join('&');
}
values = function (object){
    var result = [];
    for (var key in object)
        result.push(object[key]);
    return result;
}
keys = function(object){
    return Object.keys(object);
}

/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */
var hexcase=0;function hex_md5(a){return rstr2hex(rstr_md5(str2rstr_utf8(a)))}function hex_hmac_md5(a,b){return rstr2hex(rstr_hmac_md5(str2rstr_utf8(a),str2rstr_utf8(b)))}function md5_vm_test(){return hex_md5("abc").toLowerCase()=="900150983cd24fb0d6963f7d28e17f72"}function rstr_md5(a){return binl2rstr(binl_md5(rstr2binl(a),a.length*8))}function rstr_hmac_md5(c,f){var e=rstr2binl(c);if(e.length>16){e=binl_md5(e,c.length*8)}var a=Array(16),d=Array(16);for(var b=0;b<16;b++){a[b]=e[b]^909522486;d[b]=e[b]^1549556828}var g=binl_md5(a.concat(rstr2binl(f)),512+f.length*8);return binl2rstr(binl_md5(d.concat(g),512+128))}function rstr2hex(c){try{hexcase}catch(g){hexcase=0}var f=hexcase?"0123456789ABCDEF":"0123456789abcdef";var b="";var a;for(var d=0;d<c.length;d++){a=c.charCodeAt(d);b+=f.charAt((a>>>4)&15)+f.charAt(a&15)}return b}function str2rstr_utf8(c){var b="";var d=-1;var a,e;while(++d<c.length){a=c.charCodeAt(d);e=d+1<c.length?c.charCodeAt(d+1):0;if(55296<=a&&a<=56319&&56320<=e&&e<=57343){a=65536+((a&1023)<<10)+(e&1023);d++}if(a<=127){b+=String.fromCharCode(a)}else{if(a<=2047){b+=String.fromCharCode(192|((a>>>6)&31),128|(a&63))}else{if(a<=65535){b+=String.fromCharCode(224|((a>>>12)&15),128|((a>>>6)&63),128|(a&63))}else{if(a<=2097151){b+=String.fromCharCode(240|((a>>>18)&7),128|((a>>>12)&63),128|((a>>>6)&63),128|(a&63))}}}}}return b}function rstr2binl(b){var a=Array(b.length>>2);for(var c=0;c<a.length;c++){a[c]=0}for(var c=0;c<b.length*8;c+=8){a[c>>5]|=(b.charCodeAt(c/8)&255)<<(c%32)}return a}function binl2rstr(b){var a="";for(var c=0;c<b.length*32;c+=8){a+=String.fromCharCode((b[c>>5]>>>(c%32))&255)}return a}function binl_md5(p,k){p[k>>5]|=128<<((k)%32);p[(((k+64)>>>9)<<4)+14]=k;var o=1732584193;var n=-271733879;var m=-1732584194;var l=271733878;for(var g=0;g<p.length;g+=16){var j=o;var h=n;var f=m;var e=l;o=md5_ff(o,n,m,l,p[g+0],7,-680876936);l=md5_ff(l,o,n,m,p[g+1],12,-389564586);m=md5_ff(m,l,o,n,p[g+2],17,606105819);n=md5_ff(n,m,l,o,p[g+3],22,-1044525330);o=md5_ff(o,n,m,l,p[g+4],7,-176418897);l=md5_ff(l,o,n,m,p[g+5],12,1200080426);m=md5_ff(m,l,o,n,p[g+6],17,-1473231341);n=md5_ff(n,m,l,o,p[g+7],22,-45705983);o=md5_ff(o,n,m,l,p[g+8],7,1770035416);l=md5_ff(l,o,n,m,p[g+9],12,-1958414417);m=md5_ff(m,l,o,n,p[g+10],17,-42063);n=md5_ff(n,m,l,o,p[g+11],22,-1990404162);o=md5_ff(o,n,m,l,p[g+12],7,1804603682);l=md5_ff(l,o,n,m,p[g+13],12,-40341101);m=md5_ff(m,l,o,n,p[g+14],17,-1502002290);n=md5_ff(n,m,l,o,p[g+15],22,1236535329);o=md5_gg(o,n,m,l,p[g+1],5,-165796510);l=md5_gg(l,o,n,m,p[g+6],9,-1069501632);m=md5_gg(m,l,o,n,p[g+11],14,643717713);n=md5_gg(n,m,l,o,p[g+0],20,-373897302);o=md5_gg(o,n,m,l,p[g+5],5,-701558691);l=md5_gg(l,o,n,m,p[g+10],9,38016083);m=md5_gg(m,l,o,n,p[g+15],14,-660478335);n=md5_gg(n,m,l,o,p[g+4],20,-405537848);o=md5_gg(o,n,m,l,p[g+9],5,568446438);l=md5_gg(l,o,n,m,p[g+14],9,-1019803690);m=md5_gg(m,l,o,n,p[g+3],14,-187363961);n=md5_gg(n,m,l,o,p[g+8],20,1163531501);o=md5_gg(o,n,m,l,p[g+13],5,-1444681467);l=md5_gg(l,o,n,m,p[g+2],9,-51403784);m=md5_gg(m,l,o,n,p[g+7],14,1735328473);n=md5_gg(n,m,l,o,p[g+12],20,-1926607734);o=md5_hh(o,n,m,l,p[g+5],4,-378558);l=md5_hh(l,o,n,m,p[g+8],11,-2022574463);m=md5_hh(m,l,o,n,p[g+11],16,1839030562);n=md5_hh(n,m,l,o,p[g+14],23,-35309556);o=md5_hh(o,n,m,l,p[g+1],4,-1530992060);l=md5_hh(l,o,n,m,p[g+4],11,1272893353);m=md5_hh(m,l,o,n,p[g+7],16,-155497632);n=md5_hh(n,m,l,o,p[g+10],23,-1094730640);o=md5_hh(o,n,m,l,p[g+13],4,681279174);l=md5_hh(l,o,n,m,p[g+0],11,-358537222);m=md5_hh(m,l,o,n,p[g+3],16,-722521979);n=md5_hh(n,m,l,o,p[g+6],23,76029189);o=md5_hh(o,n,m,l,p[g+9],4,-640364487);l=md5_hh(l,o,n,m,p[g+12],11,-421815835);m=md5_hh(m,l,o,n,p[g+15],16,530742520);n=md5_hh(n,m,l,o,p[g+2],23,-995338651);o=md5_ii(o,n,m,l,p[g+0],6,-198630844);l=md5_ii(l,o,n,m,p[g+7],10,1126891415);m=md5_ii(m,l,o,n,p[g+14],15,-1416354905);n=md5_ii(n,m,l,o,p[g+5],21,-57434055);o=md5_ii(o,n,m,l,p[g+12],6,1700485571);l=md5_ii(l,o,n,m,p[g+3],10,-1894986606);m=md5_ii(m,l,o,n,p[g+10],15,-1051523);n=md5_ii(n,m,l,o,p[g+1],21,-2054922799);o=md5_ii(o,n,m,l,p[g+8],6,1873313359);l=md5_ii(l,o,n,m,p[g+15],10,-30611744);m=md5_ii(m,l,o,n,p[g+6],15,-1560198380);n=md5_ii(n,m,l,o,p[g+13],21,1309151649);o=md5_ii(o,n,m,l,p[g+4],6,-145523070);l=md5_ii(l,o,n,m,p[g+11],10,-1120210379);m=md5_ii(m,l,o,n,p[g+2],15,718787259);n=md5_ii(n,m,l,o,p[g+9],21,-343485551);o=safe_add(o,j);n=safe_add(n,h);m=safe_add(m,f);l=safe_add(l,e)}return Array(o,n,m,l)}function md5_cmn(h,e,d,c,g,f){return safe_add(bit_rol(safe_add(safe_add(e,h),safe_add(c,f)),g),d)}function md5_ff(g,f,k,j,e,i,h){return md5_cmn((f&k)|((~f)&j),g,f,e,i,h)}function md5_gg(g,f,k,j,e,i,h){return md5_cmn((f&j)|(k&(~j)),g,f,e,i,h)}function md5_hh(g,f,k,j,e,i,h){return md5_cmn(f^k^j,g,f,e,i,h)}function md5_ii(g,f,k,j,e,i,h){return md5_cmn(k^(f|(~j)),g,f,e,i,h)}function safe_add(a,d){var c=(a&65535)+(d&65535);var b=(a>>16)+(d>>16)+(c>>16);return(b<<16)|(c&65535)}function bit_rol(a,b){return(a<<b)|(a>>>(32-b))};
