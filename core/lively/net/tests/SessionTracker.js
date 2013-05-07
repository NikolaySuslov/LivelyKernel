module('lively.net.tests.SessionTracker').requires('lively.TestFramework', 'lively.net.SessionTracker').toRun(function() {

AsyncTestCase.subclass('lively.net.tests.SessionTracker.Register',
'running', {
    setUp: function($super) {
        $super();
        this.serverURL = URL.create(Config.nodeJSURL+'/SessionTrackerUnitTest/')
        lively.net.SessionTracker.createSessionTrackerServer(this.serverURL);
        this.sut = new lively.net.SessionTrackerConnection({
            sessionTrackerURL: this.serverURL,
            username: 'SessionTrackerTestUser'
        });
    },

    tearDown: function($super) {
        $super();
        this.sut.unregister();
        this.sut.resetConnection();
        lively.net.SessionTracker.removeSessionTrackerServer(this.serverURL);
    }
},
'testing', {
    testRegisterCurrentWorld: function() {
        this.sut.register();
        this.sut.getSessions(function(sessions) {
            var expected = [{
                id: this.sut.sessionId,
                worldURL: URL.source.toString(),
                user: "SessionTrackerTestUser"
            }];
            this.assertEqualState(expected, sessions.local);
            this.done();
        }.bind(this));
    },

    testUnregister: function() {
        // second Connection for getting sessions
        var secondSession = new lively.net.SessionTrackerConnection({
            sessionTrackerURL: this.serverURL,
            username: 'SessionTrackerTestUser2'
        });
        this.sut.register();
        this.delay(function() {
            secondSession.register();
            this.sut.unregister();
            secondSession.getSessions(function(sessions) { 
                var expected = [{
                    id: secondSession.sessionId,
                    worldURL: URL.source.toString(),
                    user: "SessionTrackerTestUser2"
                }];
                secondSession.unregister();
                this.assertEqualState(expected, sessions.local);
                this.done();
            }.bind(this));
        }, 50);
    },

    testRemoteEval: function() {
        this.sut.register();
        this.sut.openForRemoteEvalRequests();
        Global.remoteEvalHappened = false;
        var expr = 'Global.remoteEvalHappened = true; 1 + 3';
        this.sut.remoteEval(this.sut.sessionId, expr, function(result) {
            this.assertEquals('4', result);
            this.assert(Global.remoteEvalHappened, 'remoteEvalHappened no set');
            delete Global.remoteEvalHappened;
            this.done();
        }.bind(this));
    }

});

AsyncTestCase.subclass('lively.net.tests.SessionTracker.SessionFederation',
'running', {
    setUp: function($super) {
        $super();
        this.serverURL1 = URL.create(Config.nodeJSURL+'/SessionTrackerFederationTest1/');
        this.serverURL2 = URL.create(Config.nodeJSURL+'/SessionTrackerFederationTest2/');
        lively.net.SessionTracker.createSessionTrackerServer(this.serverURL1);
        lively.net.SessionTracker.createSessionTrackerServer(this.serverURL2);
        this.client1 = new lively.net.SessionTrackerConnection({
            sessionTrackerURL: this.serverURL1, username: 'SessionTrackerTestUser1'});
        this.client2 = new lively.net.SessionTrackerConnection({
            sessionTrackerURL: this.serverURL2, username: 'SessionTrackerTestUser2'});
    },

    tearDown: function($super) {
        $super();
        this.client1.unregister();
        this.client2.unregister();
        lively.net.SessionTracker.removeSessionTrackerServer(this.serverURL1);
        lively.net.SessionTracker.removeSessionTrackerServer(this.serverURL2);
    }
},
'testing', {
    testRegisterCurrentWorld: function() {
        var c1 = this.client1, c2 = this.client2;
        c1.register(); c2.register();
        this.waitFor(function() { return c1.isConnected() && c2.isConnected(); }, 50, function() {
            c1.initServerToServerConnect(this.serverURL2);
            connect(c1.webSocket, 'initServerToServerConnectResult', this, 'serverToServerConnectDone');
        });
        this.waitFor(function() { return !!this.serverToServerConnectDone; }, 100, function() {
            c1.getSessions(function(sessions) {
                var remoteSessions = sessions[this.serverURL2.toString().replace(/^http/, 'ws') + 'connect'],
                    expected = [{id: c2.sessionId, worldURL: URL.source.toString(), user: 'SessionTrackerTestUser2'}];
                this.assertEqualState(expected, remoteSessions);
                this.done();
            }.bind(this));            
        });
    }

});

}) // end of module