# Factory Module Definition

Requirements:
* Node.js
* npm (Node.js package manager)

## Install

```bash
npm install fmd
```

## Use

```javascript
var Fmd = require("fmd");
```

## Quick start

```javascript
require("fmd")({
    target: "dist/lib",
    trim_whitespace: true,
    new_line: "unix",
    indent: 2
  })
  .vendor("bar", "Bar")
  .define("foo", ["source/foo.js"], {
    depends: {
      "bar": "Baz"
    },
    exports: "Foo",
    global: "Foo"
  })
  .build();
```

**Files:**

Input: "source/foo.js"
```javascript
function Foo () {

}

Foo.prototype = new Baz();

Foo.prototype.qux = "foo";

Foo.prototype.bar = function () {

};

Foo.prototype.baz = function () {

};
```

Output: "dist/lib/foo.js"
```javascript
;(function (root, factory) {
  if (typeof exports === "object") {
    // CommonJS
    module.exports = exports = factory(require("bar"));
  }
  else if (typeof define === "function" && define.amd) {
    // AMD
    define(["bar"], factory);
  }
  else {
    // Global (browser)
    root.Foo = factory(root.Bar);
  }
}(this, function (Baz) {

  function Foo () {

  }

  Foo.prototype = new Baz();

  Foo.prototype.qux = "foo";

  Foo.prototype.bar = function () {

  };

  Foo.prototype.baz = function () {

  };

  return Foo;

}));
```

## Usage

### New Factory Module Definition object

```javascript
var fmd = require("fmd")(settings);
```

* **settings.target** destination directory of modules
* **settings.factories** *(optional)* orderd array of definition types to use, at least one type is required *Default:* ```["commonjs", "amd", "global"]```
* **settings.trim_whitespace** *(optional)* boolean indication whether to trim trailing whitespace *Default:* ```null```
* **settings.new_line** *(optional)* new line char type ```"unix"```, ```"mac"```, ```"windows"```, ```"\n"```, ```"\r"```, ```"\r\n"``` (null: don't change) *Default:* ```null```
* **settings.indent** *(optional)* ```"\t"```, ```"  "```, ```1```, ```2, ```3, ```...``` (null: don't add indent, number: count of spaces) *Default:* ```null```
* **settings.amd_not_anonymous** *(optional)* boolean indication whether to define amd not anonymous *Default:* ```null```

### Factory

Factory adds a "Factory Module Definition" handle.
Predefined: ```commonjs```, ```amd``` and ```global```.

```javascript
.factory( name, when, define )
```

* **name** name/identifier of the factory definiton handle
* **when** method which returns the if condition to check the enviroment
* **define** method which returns the definition

#### Example:
```javascript
fmd
  .factory("commonjs", function () {
    return "typeof exports === \"object\""
  }, function () {
    var depends = [],
      requires = this.getModule().require;

    // Compose dependencies
    _.each(requires, function (require) {
      depends.push("require(\"" + require + "\")");
    });

    return "// CommonJS\nmodule.exports = exports = " + this.factory() + "(" + depends.join(", ") + ");";
  });
// Or multiple factory definition
fmd
  .factory({
    "commonjs": [
      function () {
        return "typeof exports === \"object\""
      },
      function () {
        var depends = [],
          requires = this.getModule().require;

        // Compose dependencies
        _.each(requires, function (require) {
          depends.push("require(\"" + require + "\")");
        });

        return "// CommonJS\nmodule.exports = exports = " + this.factory() + "(" + depends.join(", ") + ");";
      }
    ]
  });
```

### Vendor

Vendor doesn't create/build files, it adds just the ability to inherit (especially for global mode) from modules I don't want to create/build by my self.

```javascript
.vendor( module [, global] )
```

* **module** path/name of the module
* **global** *(optional)* name of the global provided variable

#### Example:
```javascript
fmd
  .vendor("foo", "Foo");
  .vendor("foo/bar", "FooBar");
// Or multiple vendor definition
fmd
  .vendor({
    "foo": ["Foo"],
    "foo/bar": ["FooBar"]
  });
```

### Import

Import loads/copies modules which include a definiton already.

```javascript
.import( module, sources [, global] [, concat(source1, sourceN)] )
```

* **module** path/name of the module
* **sources** array of file paths or (local, http or https locations), at least one source is required
* **global** *(optional)* name of the global provided variable
* **concat** *(optional)* an own method to concat the received contents of sources

#### Example:
```javascript
fmd
  .import("foo/bar", ["http://example.com/foo/bar.js", "/soruces/foo/bar-extension.js"], "FooBar", function (base, ext) {
    return base + "\n\n/* Special extension */\n\n" + ext;
  })
  .import("foo", ["/soruces/foo.js"], "Foo")
  .import("bar", ["/soruces/bar.js"]);
// Or multiple import
fmd
  .import({
    "foo/bar": [
      ["http://example.com/foo/bar.js", "/soruces/foo/bar-extension.js"],
      "FooBar",
      function (base, ext) {
        return base + "\n\n/* Special extension */\n\n" + ext;
      }
    ],
    "foo": [
      ["/soruces/foo.js"],
      "Foo"
    ],
    "bar", [
      ["/soruces/bar.js"]
    ]
  });
```

### Define

Define loads/copies scripts and wraps them in a factory module definition.

```javascript
.define( module, sources, options [, concat] )
```

* **module** path/name of the module
* **sources** array of file paths or (local, http or https locations)
* **options.depends** *(optional)* key / value (module / local variable name) paired dependencies
* **options.exports** *(optional)* name of the variable to expose
* **options.global** *(optional)* name of the property to expose on global object *(window in browser)*
* **concat** *(optional)* an own method to concat the received contents of sources

#### Example:
```javascript
fmd
  .define("bar", ["/soruces/bar.js"], {
    exports: "Bar",
    global: "Bar"
  })
  .define("foo", ["/soruces/foo.js"], "Foo", {
    exports: "Foo",
    global: "Foo"
  })
  .define("foo/bar", ["http://example.com/foo/bar.js", "/soruces/foo/bar-extension.js"], {
    depends: {
      "foo": "Foo",
      "bar": "Bar"
    },
    exports: "FooBar",
    global: "FooBar"
  }, function (base, ext) {
    return base + "\n\n/* Speciale extension */\n\n" + ext;
  });
// Or multiple define
fmd
  .define({
    "bar": [
      ["/soruces/bar.js"],
      {
        exports: "Bar",
        global: "Bar"
      }
    ],
    "foo": [
      ["/soruces/foo.js"],
      {
        exports: "Foo",
        global: "Foo"
      }
    ],
    "foo/bar": [
      ["http://example.com/foo/bar.js", "/soruces/foo/bar-extension.js"],
      {
        depends: {
          "foo": "Foo",
          "bar": "Bar"
        },
        exports: "FooBar",
        global: "FooBar"
      },
      function (base, ext) {
        return base + "\n\n/* Speciale extension */\n\n" + ext;
      }
    ]
  });
```

### Build

Build starts the (async) process of creating defined modules and copying imported modules.

```javascript
.build( [callback(createdFiles)] )
```

* **callback**  *(optional)* a callback handle which receive a list of the created file (relative to the target path)

#### Example:
```javascript
fmd
  .build(function (createdFiles) {
    // Log the list of created files
    console.log(createdFiles);
  });
```