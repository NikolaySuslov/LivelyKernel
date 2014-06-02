module.exports = function(route, app) {
    app.get('/', function(req, res, next) {
        res.redirect('/welcome.html');
    });
}
