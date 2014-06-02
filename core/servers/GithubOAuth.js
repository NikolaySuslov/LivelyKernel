var codes = {};
var oAuthHTML = ""
+ "<html>\n"
+ "    <body>\n"
+ "        <div>Successfully logged into Github!</div>\n"
+ "        <div id=\"close-in-message\">This window will close in 3 seconds</div>\n"
+ "        <script type=\"text/javascript\">\n"
+ "            setInterval(function() {\n"
+ "                var el = document.getElementById(\"close-in-message\");\n"
+ "                el.textContent = el.textContent.replace(/[0-9]+/,\n"
+ "                    function(match) { return Number(match) - 1; });\n"
+ "            }, 1000);\n"
+ "            setTimeout(close, 3*1000)\n"
+ "        </script>\n"
+ "    </body>\n"
+ "</html>\n";

module.exports = function(route, app) {
    app.all(route + 'oauth/callback', function(req, res) {
        console.log('got oauth callback: ' + req.url);
        console.log(req.query);
        codes[req.query.state] = req.query.code;
        'Github authentication'
        res.end(oAuthHTML);
    });
    
    app.get(route + 'code/:id', function(req, res) {
        res.end(codes[req.params.id] || 'not found');
    });
}
