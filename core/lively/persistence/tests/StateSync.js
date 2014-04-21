module('lively.persistence.tests.StateSync').requires('lively.TestFramework', 'lively.persistence.StateSync').toRun(function() {

AsyncTestCase.subclass('lively.persistence.tests.StateSync.StoreHandle', 
'preparation', {
    setUp: function($super) {
        $super();
        this._store = new lively.persistence.Sync.LocalStore();
        this._root = new lively.persistence.StateSync.StoreHandle(this._store)
    },
    tearDown: function($super) {
        $super();
    },
},
'tests', {
    test01pathAndTreeFunctions: function() {
        var root = this._root,
            c1 = root.child("a");
        var cs = [root, c1, root.child("b"), c1.child("a"), root.child("a.a")];
        this.assert(cs.all(function(ea) { return ea instanceof lively.persistence.StateSync.StoreHandle}),
            "class changed");
        this.assertEquals(cs[0].fullPath().toString(), "", "wrong path");
        this.assertEquals(cs[1].fullPath().toString(), "a", "wrong path 1");
        this.assertEquals(cs[2].fullPath().toString(), "b", "wrong path 2");
        this.assertEquals(cs[3].fullPath().toString(), "a.a", "wrong path 3");
        this.assertEquals(cs[4].fullPath().toString(), "a.a", "wrong path 4");
        this.assertEquals(cs[0], cs[1].parent(), "parent");
        this.assertEquals(cs[0], cs[2].parent(), "parent 1");
        this.assertEquals(cs[1], cs[3].parent(), "parent 2");
        
        this.assertEquals(cs[4].parent().fullPath().toString(), "a", "wrong path 5");
        this.assert(root.isRoot());
        this.assert(root.child("").isRoot())

        this.done()
    },
    test02SettingAndInforming: function() {
        var c = this._root.child("a.a"),
            cc = c.child("a"),
            values = [{value: "123"}, {value: "123", a: 1}], self = this;
        c.overwriteWith({value: "123"});
        c.get(function(err, val) { 
            self.assert(Objects.equal(val, values.shift()));
            if(values.length == 0) self.done()
        })
        cc.set(function(old, newV, cb) { cb(newV) }, function(err, val) { self.assert(val == 1) }, 1)
    },
    test03Updating: function() {
        var c = this._root.child("a.a"),
            cc = c.child("a"),
            values = [],
            updateSupplies = [],
            self = this;
        c.overwriteWith({foo: "123", bar: "234"});
        c.update({foo: "321"}, function(oldV, newV, cb) {
            self.assert(Objects.equal(oldV, {foo: "123"}), "wrong old value");
            self.assert(Objects.equal(newV, {foo: "321"}), "new value not correctly propagated");
            cb(newV)
        }, function(err, curV) {
            self.assert(Objects.equal(curV, {foo: "321"}) 
                    ||  Objects.equal(curV, {foo: "321", bar: "234"}), "new value not saved");
        });
        c.update(null, function(oldV, newV, cb) {
            self.assert(Objects.equal(oldV, {foo: "321", bar: "234"}), "not all values contributed, when none is specified");
            cb(1)
        }, function(err, curV) {
            self.assert(curV == 1, "'number' did not overwrite object");
            self.done()
        })
    },
    test04SettingAndIgnoringCallbacks: function() {
        var c = this._root.child("a"),
            values = [],
            updateSupplies = [],
            self = this;
        c.overwriteWith(2, function() {
            var cb = c.get(function(err, val) {
                values.push(val)
                if (values.length == 3) {
                    self.assertEquals(values[0], 2, "get should be called with the initial value, which was not set, yet");
                    self.assert(values[1] != 4, "this value might be 3 or 5, depending on the scheduling sequence, but not 4");
                    self.assertEquals(values[2], 5, "reported too many values");
                    self.done();
                }
            });
            c.overwriteWith(3, function(err, val) {
                c.overwriteWith(4, function(err, val) {
                    c.overwriteWith(5);
                }, cb)
            });
        })
    },
    test05falseContent: function() {
        var c = this._root.child("falseTest"),
            self = this;
        c.get(function(err, newV) {
            if (newV === undefined) return;
            if (newV === false){
                self.done()
            } else {
                self.assertEquals(newV, false, "Value not updated.")
            }
        });
        c.overwriteWith(false);
    },
})
lively.persistence.tests.StateSync.StoreHandle.subclass('lively.persistence.tests.StateSync.L2LHandle', 
'preparation', {
    setUp: function($super) {
        $super();
        // create a new root, to be able to reliably remove all callbacks in tearDown
        this._root = new lively.persistence.StateSync.L2LHandle()
    },
    tearDown: function($super) {
        // lively.persistence.StateSync.L2LHandle.rootHandles = []
        $super();
        lively.persistence.StateSync.L2LHandle.rootHandles = lively.persistence.StateSync.L2LHandle.rootHandles.without(this._root)
    }
,
},
'tests', {
    test01informingSubscribers: function() {
        var root = this._root,
            c1 = root.child("test"),
            self = this;
        self.recordedValues = []
        c1.overwriteWith(0, function(err, value) {
            if (err) self.assert(false)
            self.assertEquals(value, 0)
            
            c1.get(function(err, value) {
                if (err) self.assert(false, "Get: There should be no error when being informed of changes...");
                self.recordedValues.push(value)
                if (self.recordedValues.length == 2) {
                    self.assertEquals(self.recordedValues, [0, 10])
                    self.done()
                }
            });
            c1.overwriteWith(10, function(err, value) { 
                if (err) self.assert(false)
                self.assertEquals(10, value)
            });
        });
    },
    test04SettingAndIgnoringCallbacks: function($super) {
        $super();
    },
})

AsyncTestCase.subclass('lively.persistence.tests.StateSync.MorphMixin', 
'preparation', {
    setUp: function($super) {
        $super();
        this.trait = Trait('lively.persistence.StateSync.SynchronizedMorphMixin');
        
        this._store = new lively.persistence.Sync.LocalStore();
        this.handle = new lively.persistence.StateSync.StoreHandle(this._store)
    },
    tearDown: function($super) {
        $super();
    },
    startSynchronizing: function(someObject) {
        var name = someObject.name,
            slot = this._store.db[name] && this._store.db[name].length ? this._store.db[name].length : 0;
        var syncHandle = this.handle.child(name + "." + slot);
        if (Object.isArray(someObject.synchronizationHandles)) {
            someObject.synchronizationHandles.push(syncHandle);
        } else {
            someObject.synchronizationHandles = [syncHandle];
        }
        if (!this._store.db[name]) this._store.db[name] = {}
        this._store.db[name].length = slot + 1;
        this.trait.mixInto(someObject, syncHandle, false);
        someObject.save();
        return syncHandle
    },
},
'tests', {
    testNamesRemainTheSame: function() {
        var gunieaPig = new lively.morphic.Morph();
        gunieaPig.setName("gunieaPig");
        this.startSynchronizing(gunieaPig);
        
        var controlGroup = gunieaPig.copy();
        this.assertEquals(controlGroup.getName(), gunieaPig.getName(), 'copies should retain the same naming scheme');
        this.done();
    },
    testCopiesAreNotSynchronized: function() {
        var gunieaPig = new lively.morphic.Morph()
        gunieaPig.setName("gunieaPig");
        this.startSynchronizing(gunieaPig);

        var self = this;
        this.handle.child(gunieaPig.name).push(
            gunieaPig.getModelData(),
            function(err, handle, curV) {
                gunieaPig.synchronizationHandles.push(handle);
                self.assertEquals(gunieaPig.synchronizationHandles.length, 2);
                var controlGroup = gunieaPig.copy();
                self.assert(!controlGroup.synchronizationHandles || controlGroup.synchronizationHandles.length == 0, "the synchronization handles should be lost when copying");
                self.done();
            });
    },
    testRemove: function() {
        var gunieaPig = new lively.morphic.Morph(),
            self = this;
        this.testBeingDropped(gunieaPig, function() {
            gunieaPig.remove();
            // based on the fact that bath [] and undefined are falsy
            self.assert(!self.handle.child("gunieaPig.0")._callbacks, "synchronization not stopped");
            self.assert(gunieaPig.synchronizationHandles != [], "callbacks are lost, but synchronization should not be stopped altogether")
            self.done()
        })
    },
    testBeingDropped: function(aMorph, thenDo) {
        var gunieaPig = aMorph || new lively.morphic.Morph(),
            self = this;
        gunieaPig.setName("gunieaPig");
        var syncHandle = this.startSynchronizing(gunieaPig);
        
        gunieaPig.mergeWithModelData = function(newV) {
            if (Objects.equal(newV, this.getModelData())) return;
            self.assertEquals("endIt", newV, "wrong value supplied");
            (thenDo && thenDo()) || self.done()};
        
        var foo = new lively.morphic.Morph();
        foo.openInWorld()
        gunieaPig.dropOn(foo);
        this.assertEquals(foo.submorphs[0], gunieaPig, "morph not added to scenegraph");
        this.assertEquals(syncHandle._callbacks[0], gunieaPig.synchronizationGet, "morph did not register update routines");
        this.assert(!gunieaPig.synchronizedValues);
        syncHandle.overwriteWith("endIt");
        foo.remove();
    },
    testAddingSubmorph: function() {
        var gunieaPig = new lively.morphic.Morph(),
            self = this;
        gunieaPig.setName("gunieaPig");
        var syncHandle = this.startSynchronizing(gunieaPig);
        debugger;
        syncHandle.get(function(err, value) {
            if (value == "endIt") return self.done();
            var model = gunieaPig.getModelData();
            self.assert(Objects.equal(value, model), "The saved value is not equal to the model: " + Objects.inspect(value) + Objects.inspect(model));
        });
        var foo = new lively.morphic.Morph();
        foo.setName('foo');
        foo.getModelData = function() { return "foo" };
        gunieaPig.addMorph(foo);
        this.assertEquals(gunieaPig.submorphs[0], foo, "morph not added to scenegraph");

        var model = gunieaPig.getModelData();
        this.assert(model.foo && model.foo == "foo", 'foo is not available in the model');
        syncHandle.overwriteWith("endIt")
    },
    
})

lively.persistence.tests.StateSync.MorphMixin.subclass('lively.persistence.tests.StateSync.StickyNote', 
'preparation', {
    setUp: function($super) {
        $super();
    },
    tearDown: function($super) {
        $super();
    },
    getStickyNote: function() {
        var background = new lively.morphic.Box(lively.rect(0, 0, 200, 150)),
            content = new lively.morphic.Text(lively.rect(5, 5, 190, 140), "");
        background.setName("stickyNote");
        content.setName("content");
        content.fixedHeight = true;
        background.addMorph(content);
        return background;
    },
},
'tests', {
    testGetModelData: function( thenDo ) {
        // background morph named stickyNote with one text submorph named content
        var gunieaPig = this.getStickyNote();
        gunieaPig.submorphs[0].textString = "some text";
        this.startSynchronizing(gunieaPig);
        
        var model = gunieaPig.getModelData();
        this.assert(model.content && Object.isNumber(model.changeTime), "for texts, there is no change changeTime-ing");
        model.changeTime = 10;
        this.assertEqualState(model, {changeTime: 10, content: "some text", shortString: model.shortString}, "model generation not successful");
        
        (thenDo && thenDo.call(this, gunieaPig)) || this.done()
    },
    testGetModelDataConnections: function() {
        this.testGetModelData(function(gunieaPig) {
        
        gunieaPig.submorphs[0].textString = "some different text";
        var model = gunieaPig.getModelData()
        this.assertEqualState(model, {changeTime: gunieaPig.changeTime || 0, content: "some different text", shortString: model.shortString}, "model not updated successful")
        
        this.epsilon = 100
        this.assertEqualsEpsilon(model.changeTime, Date.now(), "changing the text should change the last update timestamp")
        
        this.done();
        return true;
        })
    },
    testSaveForm: function(json) {
        var note = this.getStickyNote();
        this.startSynchronizing(note);
        connect(note.form, "json", this, "testSaveForm", {updater: function($upd, val) {
            var test = this.targetObj,
                form = this.sourceObj;
                test.assert(form, "form information not saved");
                test.assert(form.json !== "", "form information (json) not updated");
                test.assert(form.cb, "form not registered");
                test.assert(form.handle && form.handle.parent() === note.synchronizationHandles[0].parent(), "note is interesseted in the wrong form...");
                test.done();
        }, varMapping: {note: note}});
        debugger;
        note.saveForm();
    },
})

}) // end of module
