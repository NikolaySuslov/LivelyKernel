var fs = require('fs'),
    path = require('path'),
    lkDir = process.env.WORKSPACE_LK,
    imageFolder = path.join(lkDir, "org", "images"),
    defaulUserImage = path.join(lkDir, "org", "media", "person.png"),
    userServerDomain = require('domain').createDomain();

userServerDomain.on('error', function(err) {
    console.error('Error in UserServer: ', err);
});

var serverURL = 'http://live.krestianstvo.org'
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// avatars
function findUserImage(username, cb) {
    var userImage = path.join(imageFolder, username);
    fs.readdir(imageFolder, function(err, files) {
        if (err) { cb(err); return; }
        var imageFile = files.filter(function(fn) {
            var basename = fn.slice(0, fn.lastIndexOf(path.extname(fn)));
            return basename === username ? fn : null;
        })[0];
        cb(null, serverURL + '/' + path.relative(lkDir, imageFile ? path.join(imageFolder, imageFile) : defaulUserImage))
    });
}

module.exports = userServerDomain.bind(function(route, app) {
    app.get(route, function(req, res) {
        res.end("UserServer is running!");
    });
    app.get(route + 'avatar/:username', function(req, res) {
        var name = req.params.username;
        if (!name) { res.status(400).end(); return; }
        findUserImage(name, function(err, url) {
            res.end(url);
        })
    });
})
