var execFile = require('child_process').execFile;
var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');
var async = require('async');
var shelljs = require('shelljs');

/*
 * makes the PartsBin at lively-web.org/PartsBin downloadable as a zip file.
 * This is automatically used by the bin/lk-server.js start script to
 * automatically download a PB if there is none in the Lively directory
 */
var copyState = {writeInProgress: false};
var livelyFolder = process.env.WORKSPACE_LK;
var zipTargetDir = 'PartsBin';
var partsbinCopyDir = path.join(livelyFolder, 'PartsBin-copies');

function ensureCopyDir(next) {
    shelljs.mkdir('-p', partsbinCopyDir);
    next();
}

function removeOldZipFiles(zipFile, next) {
    fs.readdirSync(partsbinCopyDir)
        .map(function(fn) { return path.join(partsbinCopyDir, fn); })
        .filter(function(fn) { return fn !== zipFile; })
        .forEach(function(fn) { shelljs.rm(fn); });
    next && next();
}

function writeZipFile(zipFile, next) {
    if (fs.existsSync(zipFile)) {
        if (copyState.writeInProgress) {
            setTimeout(writeZipFile.bind(null, zipFile, next), 10*1000);
        } else { next(); }
        return;
    }
    copyState.writeInProgress = true;
    console.log("writing zipfile ", zipFile);
    var proc = spawn('zip', ['-q', '-r', '--exclude=*.svn*', zipFile, zipTargetDir], {cwd: livelyFolder});
    proc.on('close', function(code) { copyState.writeInProgress = false; next(code); });
    proc.on('error', function(err) { copyState.writeInProgress = false; next(err); });
}

function sendZipFile(zipFile, res, next) {
    console.log('Sending zipfile');
    res.header('Content-Type', 'application/zip');
    res.header('Content-Disposition', 'attachment; filename="PartsBinCopy.zip"');
    var readS = fs.createReadStream(zipFile);
    readS.pipe(res);
    readS.on('end', next);
}

function zipPartsBin(res) {
    var dateString = new Date().toISOString().split('T')[0],
        zipFile = path.join(partsbinCopyDir, 'PartsBinCopy' + dateString + '.zip');
    async.series([
        ensureCopyDir,
        removeOldZipFiles.bind(null, zipFile),
        writeZipFile.bind(null, zipFile),
        sendZipFile.bind(null, zipFile, res)
    ], function(err) {
        console.log('Done sending zipfile');
        if (err) {
            res.status(500).end(String(err));
            console.error(err);
        }
    });
}

module.exports = function(route, app) {
    app.get(route, function(req, res) {
        zipPartsBin(res)
    });
}