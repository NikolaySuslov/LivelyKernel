var async = require("async");
var util = require("util");
var d = require('domain').create();
var withDBDo = require('./ObjectRepositoryServer').withDBDo;
var geoIp = require('./GeoIPServer');

global.dateString = function dateString(d) {
    if (d.constructor === Date) return d.toISOString();
    if (typeof d === "number") return dateString(new Date(d));
    if (typeof d === "string" && /^[0-9]+$/.test(d)) return dateString(Number(d));
    return d;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// see https://developers.google.com/chrome-developer-tools/docs/network

global.relativeTimings = function relativeTimings(obj) {
    return Object.keys(obj)
        .filter(function(key) { return /Start$/.test(key) && key.replace(/Start$/, 'End') in obj; })
        .map(function(key) { return key.replace(/Start$/, '')})
        .reduce(function(relative, timing) {
            var diff = obj[timing + 'End'] - obj[timing + 'Start'];
            if (diff > 0) relative[timing] = diff;
            return relative;
        }, {});
}

global.reportResource = function reportResource(obj) {
    return util._extend({
        name: obj.name,
        type: obj.initiatorType,
        duration: obj.duration,
        request: obj.responseStart - obj.requestStart,
        network: obj.requestStart - obj.startTime
    }, relativeTimings(obj));
}

global.reportPageTime = function reportPageTime(obj) {
    return {
        duration: obj.loadEventEnd - obj.navigationStart
    }
}

global.colorFor = function colorFor(entry, entries) {
    var max = Math.max.apply(Math, entries),
        colors = ["FF3300","ff6600","ff9900","FFCC00","FFFF00","ccff00","99ff00","66ff00","33ff00","00FF00"].reverse(),
        idx = Math.round((100 * Math.log(entry) / Math.log(max))/10)-1;
    return colors[idx] || colors[0];
}

global.createReportHeader = function createReportHeader(entries, thenDo) {
    async.waterfall([
        function(next) { next(null, []); },
        function(parts, next) {
            parts.push("<style>\n"
                     + "  * { font-family: sans-serif; } "
                     + "  table {  border-collapse:collapse; border: solid 1px black } "
                     + "  table.info { margin-bottom: 10px } "
                     + "  th { padding: 5px; border: solid 1px black; } "
                     + "  td.timing { text-align: right; } "
                     + "  td.url { white-space: nowrap; max-width: 500px; overflow: hidden; } "
                     + "  td.info { padding: 3px; } "
                     + "</style>");
            next(null, parts);
        },
        function(parts, next) {
            parts.push("<h1>Network performance of page visits to lively-web.org</h1>");
            next(null, parts);
        },
        function(parts, next) {
            parts.push('<ul>');
            parts.push(entries.map(function(entry, i) {
                return util.format('<li><a href="#%s_%s">%s</a> (%sms, %s, %s)</li>',
                    'entry', i, entry.worldName.replace('http://lively-web.org/', ''),
                    Math.round(reportPageTime(entry.pageTiming).duration),
                    entry.user, entry.date)
            }).join(''));
            parts.push('</ul>');
            parts.push('<hr/>');
            next(null, parts);
        }, function(parts, next) { next(null, parts.join('\n')); }
    ], thenDo);
}

global.createReportEntry = function createReportEntry(entry, i, thenDo) {
    async.waterfall([

        geoIp.getIPLocation.bind(geoIp, entry.ip),

        function(location, next) {
            var parts = [];
            parts.push(util.format(
                '<div id="entry_%s">'
                + '<h2><a href="%s" target="_blank">%s</a></h2>'
                + "<table class=\"info\">\n"
                + "  <tr>"
                + "    <th>user</th>"
                + "    <th>date</th>"
                + "    <th>location</th>"
                + "  </tr>"
                + "  <tr>"
                + "    <td class=\"info\">%s</td>"
                + "    <td class=\"info\">%s</td>"
                + "    <td class=\"info\">%s</td>"
                + "  </tr>"
                + "</table>\n",
                i, entry.worldName, entry.worldName.replace('http://lively-web.org/', ''),
                entry.user,
                entry.date,
                location.locationString));
            next(null, parts);
        },

        function(parts, next) {
            parts.push("<table class=\"timing\">"
                     + "<thead>"
                     + "<tr>"
                     + "  <th>Resource</th>"
                     + "  <th>duration</th>"
                     + "  <th>network</th>"
                     + "  <th>request</th>"
                     + "  <th>response</th>"
                     + "</tr>"
                     + "</thead>");
            next(null, parts);
        },

        function(parts, next) {
            parts.push(util.format(
                '<tr>'
                + '<td>whole page</td>'
                + '<td class="timing">%s</td>'
                + '<td class="timing">-</td>'
                + '<td class="timing">-</td>'
                + '<td class="timing">-</td>'
                + '</tr>',
                (reportPageTime(entry.pageTiming).duration || 0).toFixed(2)));
            next(null, parts);
        },

        function(parts, next) {
            var resourceTimings = entry.resourceTimings.map(reportResource),
                networks = resourceTimings.map(function(ea) { return ea.network || 0; }),
                durations = resourceTimings.map(function(ea) { return ea.duration || 0; }),
                responses = resourceTimings.map(function(ea) { return ea.response || 0; }),
                requests = resourceTimings.map(function(ea) { return ea.request || 0; });
            parts.push(resourceTimings.map(function(resTime, i) {
                return util.format(
                    '<tr>'
                    + '<td class="url"><a href=\"%s\" target=\"_blank\">%s</a></td>'
                    + '<td class="timing" style="background-color: #%s">%s</td>'
                    + '<td class="timing" style="background-color: #%s">%s</td>'
                    + '<td class="timing" style="background-color: #%s">%s</td>'
                    + '<td class="timing" style="background-color: #%s">%s</td>',
                    resTime.name, resTime.name.replace('http://lively-web.org/', ''),
                    colorFor(resTime.duration, durations), (resTime.duration || 0).toFixed(2),
                    colorFor(resTime.network, networks), (resTime.network || 0).toFixed(2),
                    colorFor(resTime.request, requests), (resTime.request || 0).toFixed(2),
                    colorFor(resTime.response, responses), (resTime.response || 0).toFixed(2));
            }).join('\n'));
            next(null, parts);
        },

        function(parts, next) { parts.push("</table></div>"); next(null, parts); },

        function(parts, next) { next(null, parts.join('\n')); }

    ], thenDo);
}

global.createReport = function createReport(entries, thenDo) {
    async.waterfall([
        function(next) {
            next(null, entries.map(function(entry) {
                if (typeof entry.resourceTimings === 'string')
                    entry.resourceTimings = JSON.parse(entry.resourceTimings);
                if (typeof entry.pageTiming === 'string')
                    entry.pageTiming = JSON.parse(entry.pageTiming);
                return entry;
            }));
        },
        function(entries, next) { createReportHeader(entries, function(err, header) { next(err, header, entries); }); },
        function(header, entries, next) {
            var i = 0;
            async.map(entries, function(entry, next) { createReportEntry(entry, i++, next); }, function(err, body) {
                next(err, header, body);
            });
        },
        function(header, body, next) { next(null, header + '\n' + body); }
    ], thenDo);
}

global.getWorldLoadAnalyticsSince = function getWorldLoadAnalyticsSince(since, thenDo) {
    console.log('analytics: getting since %s', since);
    withDBDo(function(err, db) {
        if (err) { thenDo(err, null); return; }
        db.all("SELECT * FROM world_load_analytics "
             + "WHERE date > '" + dateString(since) + "' "
             + "ORDER BY date DESC", thenDo);
    });
}

global.getWorldLoadAnalyticsN = function getWorldLoadAnalyticsN(n, thenDo) {
    console.log('analytics: getting last %s', n);
    withDBDo(function(err, db) {
        if (err) { thenDo(err, null); return; }
        db.all("SELECT * FROM world_load_analytics "
             + "ORDER BY date DESC "
             + "LIMIT " + n, thenDo);
    });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// extracing data from server log
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
global.LogEntryParser = {

    logEntriesMatchingToHTMLTable: function(options, thenDo) {
        // options = {
        //     grepMatch: STRING,
        //     fields: [STRING],
        //     convertIpToLocation: BOOL,
        //     lineParser: function(lines, callback)
        // }
            
        async.waterfall([getLogEntries, parseLogEntries, createTable], thenDo);

        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

        function getLogEntries(thenDo) {
            var cmd = util.format("logs=`ls -t ~/.forever | grep log | head -n5`\n"
                    + "for log in $logs; do grep -e \"%s\" ~/.forever/$log | tail -n 500 | sort -r; done;", options.grepMatch);
            var exec = require("child_process").exec;
            exec(cmd, {maxBuffer: 5000*1024}, function(code, out, err) { thenDo(code, out); });
        }

        function parseLogEntries(logString, thenDo) {
            async.waterfall([
                function(next) { next(null, logString.split('\n')); },
                options.lineParser,
                function(logData, next) { async.mapLimit(logData, 5, addLocation, next); },
                createTableRows
            ], thenDo);
            // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
            function addLocation(logData, thenDo) {
                if (!options.convertIpToLocation) thenDo(null, logData);
                else if (!logData.ip) { logData.location = 'unknown'; thenDo(null, logData); }
                else geoIp.getIPLocation(logData.ip, function(err, loc) {
                    if (!err) logData.location = loc.locationString;
                    thenDo(err, logData)
                });
            }
        
            function createTableRows(logData, thenDo) {
                thenDo(null, logData.map(createTableRow));
                // .-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
                function createTableRow(d) {
                    return "<tr><td>"
                         + options.fields.map(function(f) { return d[f]; }).join('</td><td>')
                         + "</tr></td>";
                }
            }
        }

        function createTable(tableRows, thenDo) {
            var css = "<style>\n"
                + "  table { border-collapse: collapse; }\n"
                + "  th, td { padding: 4px; }\n"
                + "  tr:nth-child(even) { padding: 4px; background-color: rgb(238, 238, 238); }\n"
                + "</style>";
            thenDo(null, util.format('%s<table style="white-space: nowrap;">%s</table>', css, tableRows.join('\n')));
        }

    }
}

module.exports = function(route, app) {

    app.post(route + 'worldLoadReport', function(req, res) {
        var report = req.body;
        if (!req.body) {
            res.status(400).end('No report attached?');
            return;
        }

        try {
            // 1. access the DB
            withDBDo(function(err, db) {
                if (err) { res.status(500).end('DB not accessible?'); return; }

                // 2. gather data
                var user = report.user,
                    ip = req._remoteAddress,
                    worldName = req.get('referer'),
                    pageTiming = JSON.stringify(report.pageTiming),
                    resourceTimings = JSON.stringify(report.resourceTimings);

                // 3. insert into DB
                var sqlInsertStmt = 'INSERT INTO world_load_analytics '
                                  + '(user, ip, worldName, pageTiming, resourceTimings) '
                                  + 'VALUES (?, ?, ?, ?, ?);'

                db.run(sqlInsertStmt, user, ip, worldName, pageTiming, resourceTimings, function(err) {
                    if (err) { res.status(500).end(String(err)); }
                    else res.status(200).end();
                });

            });
        } catch(e) {
            res.status(400).end('No report attached?');
        }

    });

    app.get(route + 'worldLoadReport', function(req, res) {

        // error handling
        function fail(code, err) {
            console.error("anaytics: ", err);
            res.status(code || 500).end(String(err) || "Failure");
        }

        // query extraction
        var q = req.query,
            since = q.since,
            last = parseInt(q.last);

        // when called with no query params, redirect to ?last=10
        if (!since && !last) {
            res.status(303);
            var redirUrl = util.format(
                '%s://%s%sworldLoadReport?last=%s',
                req.protocol, req.headers.host, route, 10);
            res.set('Location', redirUrl);
            res.end();
            return;
        }

        // res.type('application/json');
        function respond(err, analytics) {
            if (err) fail(500, err);
            else createReport(analytics, function(err, report) {
                if (err) fail(500, err);
                else res.type('text/html').end(report);
            });
        }
        if (since) getWorldLoadAnalyticsSince(since, respond);
        else getWorldLoadAnalyticsN(last, respond);
    });

    app.get(route + 'visits', function(req, res) {
        getWorldVisits(function(err, html) {
            if (err) res.status(500).end(err + html);
            else res.type('text/html').end(html);
        });

        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

        function getWorldVisits(thenDo) {
            LogEntryParser.logEntriesMatchingToHTMLTable({
                grepMatch: "logged\\sin",
                fields: ["date", "user", "url", "ip", "location"],
                convertIpToLocation: true,
                lineParser: function parseLines(lines, thenDo) {
                    thenDo(null, lines
                        .map(parseLine)
                        .filter(function(ea) { return ea && ea.url; }));
                    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
                    function parseLine(line, thenDo) { return {date: date(line), user: username(line), url: url(line), ip: ip(line)}; }
                    function date(line) { var m = line.match(/32m\[([0-9-\s:]+)/); return m && m[1]; }
                    function username(line) { var m = line.match(/user (.*) logged/); return m && m[1]; }
                    function url(line) { var m = line.match(/ at '?([^\s']+)'?/); return m && m[1]; }
                    function ip(line) { var m = line.match(/ ip ([0-9\.]+)$/); return m && m[1]; }
                }
            }, thenDo);
        }
    });

    app.get(route + 'l2l', function(req, res) {
        getLively2LivelyConnections(function(err, html) {
            if (err) res.status(500).end(err + html);
            else res.type('text/html').end(html);
        });

        function getLively2LivelyConnections(thenDo) {
            LogEntryParser.logEntriesMatchingToHTMLTable({
                grepMatch: "l2l\\s\\(de\\)\\?registration",
                fields: ["date","type", "user", "url", "id", "ip", "location"],
                convertIpToLocation: true,
                lineParser: function parseLines(lines, thenDo) {
                    thenDo(null, lines
                        .map(parseLine)
                        .filter(function(ea) { return ea && ea.url; }));
                    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
                    function date(line) { var m = line.match(/32m\[([0-9-\s:]+)/); return m && m[1]; }
                    function parseLine(line, thenDo) {
                        var parts = line.split(' ');
                        return {
                            date: date(line), 
                            type: parts[6], user: parts[7], url: parts[8],
                            id: parts[9], ip: parts[10]
                        };
                    }
                }
            }, thenDo);
        }

    });

    app.get(route, function(req, res) {
        res.end("AnalyticsServer is running!");
    });
}

