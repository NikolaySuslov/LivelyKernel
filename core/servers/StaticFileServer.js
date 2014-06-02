var path = require("path");
var expressPath = path.join(require.resolve('life_star'), '../node_modules/express');
var express = require(expressPath);
var url = require("url");
var fs = require("fs");


var basePath = path.join(process.env.HOME, 'web/');

module.exports = function(route, app) {

    // app.use('stuff', express.static(path.join(process.env.HOME, 'web/')))

    
    app.get('/stuff', function(req, res) {
        var p = url.parse(req.url).pathname.replace(/^\/stuff\/?/, '');
        var fn = path.join(basePath, p);
        if (!fs.existsSync(fn)) {
            res.status(404).end('Not found');
            return;
        }
        var readS = fs.createReadStream(fn);
        // fn = '/home/lively/web/vwf/vwf-raring.box'
        // var stat = fs.statSync(fn);
        res.writeHead(200, {
            'Content-Type': "application/octet-stream",
            'Content-Length': String(stat.size || 0)
        });
        // readS.pipe(res);
        
        readS.on('open', function () { readS.pipe(res); });
        readS.on('error', function(err) { res.end(err); });
    });
}
