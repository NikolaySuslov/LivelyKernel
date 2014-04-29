var async    = require('async');
var util     = require('util');
var withDBDo = require('./ObjectRepositoryServer').withDBDo;
var http     = require("http");
var d        = require('domain').create();

var queue = {
    queues: {},

    nowRunning: function(ip) { this.queues[ip] = []; },
    taskIsRunning: function(ip) { return this.queues.hasOwnProperty(ip); },

    enqueue: function(ip, cb) { (this.queues[ip] = this.queues[ip] || []).push(cb); },
    clearQueue: function(ip) { var d = this.queues[ip]; delete this.queues[ip]; return d; },
    resolveQueue: function(ip, err, data, thenDo) {
        var q = this.clearQueue(ip), task;
        while (q && (task = q.pop())) task.call(null, err, data);
        thenDo && thenDo();
    }
}

var retrieveLocationInfo = d.bind(function(ip, thenDo) {

    if (queue.taskIsRunning(ip)) return queue.enqueue(ip, thenDo);
    queue.nowRunning(ip);

    async.waterfall([

        // 1. try to find ip in DB
        function(next) {
            retrieveLocationInfoFromDB(ip, function(err, data) {
                next(null, err ? null : data); });
        },

        // 2. if not in db, call webservice
        function(dbData, next) {
            if (dbData) next(null, true, dbData);
            else retrieveLocationInfoFromWeb(ip, function(err, data) { next(err, false, data); });
        },

        // 3. add additional info (addressString) to data if it doesn't have that
        function(fromCache, d, next) {
            if (!d || !d.location) return next(new Error('Could not retrieve ip location info'));
            if (d.locationString) return next(null, fromCache, d);
            d.locationString = printLocation(d);
            next(null, false, d);
        },

        // 4. store ip into DB
        function(fromCache, d, next) {
            if (fromCache) queue.resolveQueue(ip, null, d);
            else insertIPLocationIntoDB(d, function(err) {
                err && console.error(err);
                queue.resolveQueue(ip, null, d);
            });
            next(null, d);
        }

    ], function(err, data) {
        err && queue.resolveQueue(ip, err, d);
        thenDo(err, data);
    });

});

var insertIPLocationIntoDB = d.bind(function(d, thenDo) {
    async.waterfall([
        withDBDo,
        function(db, next) {
            db.run('INSERT INTO geo_ip '
                 + '(ip, location, source, locationString) '
                 + 'VALUES (?, ?, ?, ?);',
                 d.ip, JSON.stringify(d.location),
                 d.source, d.locationString, next);
        }
    ], thenDo);
});

var retrieveLocationInfoFromDB = d.bind(function(ip, thenDo) {
    // SELECT ip,location,source,date FROM geo_ip
    async.waterfall([
        withDBDo,
        function(db, next) {
            db.all(util.format(
                "SELECT ip,location,locationString,source,date "
              + "FROM geo_ip WHERE ip = '%s' "
              + "GROUP BY ip HAVING max(date) ", ip), next);
        },
        function(results, next) {
            var info = results && results[0];
            if (info) {
                try { info.location = JSON.parse(info.location); } catch (e) {}
            }
            next(null, info);
        }
    ], thenDo);

});

var retrieveLocationInfoFromWeb = d.bind(function(ip, thenDo) {
    var url = 'http://freegeoip.net/json/' + ip;
    http.get(url, function(res) {
        var data = '';
        res.on('data', function(d) { data += d; });
        res.on('end', function() {
            var result, err;
            try { result = JSON.parse(data); } catch (e) { err = e; }
            thenDo(err, {ip: ip, location: result, source: url});
        });
    });
});

function printLocation(locationInfo) {
    var l = locationInfo.location, locParts = [];
    if (l.city) locParts.push(l.city);
    if (l.region_code) locParts.push(l.region_code);
    else if (l.region_name) locParts.push(l.region_name);
    if (l.country_name) locParts.push(l.country_name);
    else if (l.country_code) locParts.push(l.country_code);
    return locParts.join(', ');
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

module.exports = function(route, app) {

    app.get(route + 'lookup/:ip', function(req, res) {
        var ip = req.params.ip,
            reqIp = req._remoteAddress;
        retrieveLocationInfo(ip, function(err, ipInfo) {
            if (err) { res.status(500).end(String(err)); return; }
            res.type('application/json');
            res.end(JSON.stringify(ipInfo));
        });
    });

    app.get(route, function(req, res) {
        res.end("GeoIPServer is running!");
    });
}

module.exports.getIPLocation = retrieveLocationInfo;
