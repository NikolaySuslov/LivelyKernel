var expressPath = path.join(process.env.LK_SCRIPTS_ROOT, 'node_modules/life_star/node_modules/express'),
    serve = require(expressPath).static;

module.exports = function(route, app) {
    
    // serve('/tmp/Rtmp6IhV5z/gigvis536d15793eaa/plot.html')
    
    app.get(route, function(req, res, next) {
        var dir = req.query.dir;
        console.log(dir)
        try {
            serve(dir)(req, res, next);
            
        } catch (e) { console.error(e)}
    });
}
