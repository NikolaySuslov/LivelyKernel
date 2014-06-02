var httpProxy = require('http-proxy');
var proxy = new httpProxy.RoutingProxy();
var url=require('url');
var fs=require('fs');
var path=require('path');

function cors(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS, PROPFIND, REPORT');
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Depth, Cookie, Set-Cookie, Accept, Access-Control-Allow-Credentials, Origin, Content-Type, Request-Id , X-Api-Version, X-Request-Id, Authorization");
    res.header("Access-Control-Expose-Headers", "Date, Etag, Set-Cookie");
    next();
}    

module.exports = function(route, app) {
    app.get(route + '*', function(req, res) {
        cors(req, res, function() {
            var fn = req.url.split(route)[1];
            fn = path.join(process.env.WORKSPACE_LK, fn);
            fs.readFile(fn, function(err, content) {
                res.write(content);
                res.end();
            })
        });
    });
}
