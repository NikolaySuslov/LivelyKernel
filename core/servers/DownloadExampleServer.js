module.exports = function(route, app) {

    // GET http://lively-web.org/nodejs/DownloadExampleServer/callmeanything.txt/this%20is%20the%20file%20content    
    // donwloads a file named callmeanything.txt with "this is the file content"

    app.get(route + ':name/:content', function(req, res) {
        res.set("Content-Disposition", "attachment; filename='" + req.params.name + "';");
        res.set("Content-Type", "application/octet-stream");
        res.end(req.params.content || 'no content specified');
    });

}
