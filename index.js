(function () {

	// Factory Module Definition (fmd)

	var _ = require("underscore"),

		fs = require("fs"),

		fsx = require("fs.extra"),

		cp = require("colorplus"),

		async = require("async"),

		http = require('client-http'),

		factories = {
			"commonjs": {
				when: function () {
					return "typeof exports === \"object\"";
				},
				define: function () {
					var depends = [],
						requires = this.getModule()
							.require;

					// Compose dependencies
					_.each(requires, function (require) {
						depends.push("require(\"" + require + "\")");
					});

					return "// CommonJS\nmodule.exports = exports = " + this.factory() + "(" + depends.join(", ") + ");";
				}
			},

			"amd": {
				when: function () {
					return "typeof define === \"function\" && define.amd";
				},
				define: function () {
					var anonym = this.getOption("amd_not_anonymous") ? ("\"" + this.module() + "\", ") : "",
						depends = [],
						requires = this.getModule()
							.require;

					// Compose dependencies
					_.each(requires, function (require) {
						depends.push("\"" + require + "\"");
					});

					return "// AMD\ndefine(" + anonym + "[" + depends.join(", ") + "]" + ", " + this.factory() + ");";
				}
			},

			"global": {
				when: function () {
					return "typeof window !== \"undefined\" && window === " + this.root();
				},
				define: function () {
					var depends = [],
						lastNoGlobal = 0,
						requires = this.getModule()
							.require,
						global = this.getModule()
							.global;

					// Compose global exports
					global = global ? (this.root() + FactoryModuleDefinition.securePropertyName(global) + " = ") : "";

					// Compose dependencies
					_.each(requires, function (require, i) {
						var requireGlobal = this.getModule(require)
								.global;

						if (requireGlobal) {
							lastNoGlobal = i + 1;
						}

						depends.push(requireGlobal ? (this.root() + FactoryModuleDefinition.securePropertyName(requireGlobal)) : this.undef());
					}, this);

					// Right trim undefined global dependencies
					depends.splice(lastNoGlobal, depends.length);

					return "// Global (browser)\n" + global + this.factory() + "(" + depends.join(", ") + ");";
				}
			}
		};

	/*
	 * HELPER
	 */

	function multiSetter(handle) {
		return function (name) {
			if (typeof name === "object") {
				for (var i in name) {
					name[i].unshift(i);
					handle.apply(this, name[i]);
				}
			}
			else {
				handle.apply(this, arguments);
			}

			return this;
		};
	}

	function warn(msg) {
		console.log(cp.yellow, msg, cp.r);
	}

	function error(msg) {
		console.log(cp.red, msg, cp.r);
		process.kill();
	}

	function defineContext(context) {
		var undef = false;

		return {
			undef: function (is) {
				return is ? undef : ((undef = true), context.undef);
			},

			root: function () {
				return context.root;
			},

			factory: function () {
				return context.factory;
			},

			module: function () {
				return context.module;
			},

			getModule: function (path) {
				if (!path) {
					path = context.module;
				}
				else if (/^\./.test(path)) {
					path = (context.module + "/../" + path)
						.replace(/[^\/]+\/\.\.\//g, "/")
						.replace(/\/\.\//g, "/")
						.replace(/\/\//g, "/")
						.replace(/^\//, "");
				}

				if (!context.mfd.modules[path]) {
					error("Can't load '" + path + "' in '" + context.module + "'. Module '" + path + "' is not defined.");
				}

				return context.mfd.modules[path];
			},

			getOption: function (option) {
				return context.mfd.options[option];
			}
		};
	}

	function helpers(self) {
		var o = self.options;

		return {
			// Correct new line char for each line of code
			rtrim: function (code, force) {
				var trim = o.trim_whitespace || force;

				return !trim ? code : code.replace(/[\t ]+(\r\n|\r|\n|$)/g, "$1");
			},

			// Correct new line char for each line of code
			fixNewline: function (code, force) {
				var new_line = o.new_line,
					pattern = new_line + "";

				if (new_line === "mac") {
					pattern = "\r";
				}
				else if (new_line === "win" || new_line === "windows") {
					pattern = "\r\n";
				}
				else if (new_line === "unix" || force) {
					pattern = "\n";
				}

				// Ensure onle new line chars are allowed
				pattern = pattern.replace(/[^\r\n]/g, "");

				return !pattern ? code : code.replace(/(\r\n|\r|\n)/g, pattern);
			},

			// Add indent for each line of code
			addIndent: function (code, size, force) {
				var indentPattern = o.indent || (force ? "\t" : null),
					indentSize = 1,
					indent = "",
					i;

				if (_.isNumber(indentPattern)) {
					indentSize = indentPattern;
					indentPattern = " ";
				}

				if (!indentPattern) {
					return code;
				}

				size = size * indentSize;

				for (i = 0; i < size; i++) {
					indent += indentPattern;
				}


				return code.replace(/(^|\r\n|\r|\n)/g, "$1" + indent);
			},

			// Get correct local file path
			getFilePath: function (path, base) {
				return /^\//.test(path) ? path : (base + "/" + path)
					.replace(/[^\/]+\/\.\.\//g, "/")
					.replace(/\/\.\//g, "/")
					.replace(/\/\//g, "/");
			},

			// Async read of file content (local or from http / https)
			readFile: function (path, callback) {
				if (/^https?:\/\//.test(path)) {
					http.get(path, function (data, error, cookie) {
						if (error) {
							warn(error);
							callback(true, "");
						}
						else {
							callback(false, data.toString());
						}
					});
				}
				else {
					fs.readFile(path, function (error, data) {
						if (error) {
							warn(error);
							callback(true, "");
						}
						else {
							callback(false, data.toString());
						}
					});
				}
			},

			// Sync write of file (create folder path automatically)
			writeFile: function (path, content) {
				path = this.getFilePath(path, o.target);

				fsx.mkdirpSync(path.replace(/[^\/]+\/?$/, ""));
				fs.writeFileSync(path, content);
			}
		};
	}

	function Initialize() {

	}

	/*
	 * FactoryModuleDefinition
	 */

	function FactoryModuleDefinition() {
		var instance = this;

		if (!(instance instanceof FactoryModuleDefinition)) {
			instance = new FactoryModuleDefinition(new Initialize());
			instance.constructor.apply(instance, arguments);
		}
		else if (!(arguments[0] instanceof Initialize)) {
			instance.constructor.apply(instance, arguments);
		}

		return instance;
	}

	// Secure property access string
	FactoryModuleDefinition.securePropertyName = function (name) {
		return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? ("." + name) : ("[\"" + name.replace(/"/g, "\\\"") + "\"]");
	};

	// Proto methods
	FactoryModuleDefinition.prototype = {
		constructor: function (options) {
			var o = this.options = _.extend({

					target: null, // Destination directory of modules

					factories: ["commonjs", "amd", "global"], // false, true (check and define as node module)

					trim_whitespace: null, // true, false

					new_line: null, // null, "unix", "mac", "windows", "\n", "\r", "\r\n" (null: don't change)

					indent: null, // null, "\t", "  ", 1, 2, 3, ... (null: don't add indent, number: count of spaces)

					amd_not_anonymous: null // true if amd definition should not be anonymous

				}, options || {});

			this.factories = _.extend({}, factories);

			this.modules = {};

			// Ensure using define once
			o.factories = _.uniq(o.factories);

			// Stop on options error
			if (o.factories.length < 1) {
				error("Options: At least one type of 'factories' needs to be specified.")
			}

			if (!o.target) {
				error("Options: No 'target' directory specified.")
			}
		},

		// Add a module define processor
		factory: multiSetter(function (factory, when, define) {
			this.factories[factory] = {
				when: when,
				define: define
			};
		}),

		// Do nothing, just add ability to require vendors
		vendor: multiSetter(function (module, global) {
			var settings = this.modules[module] = {
					type: "vendor",
					module: module
				};

			if (global) {
				settings.global = global;
			}
		}),

		import: multiSetter(function (module, sources, global, concat) {
			var settings = this.modules[module] = {
					type: "import",
					module: module,
					sources: sources,
					concat: function () {
						return _.toArray(arguments)
							.join("\n\n");
					}
				};

			if (typeof global === "string") {
				settings.global = global;
			}

			if (typeof global === "function") {
				settings.concat = global;
			}
			else if (typeof concat === "function") {
				settings.concat = concat;
			}

			if (sources.length < 1) {
				error("At least one source is required for module '" + module + "'.");
			}
		}),

		// Convert script into module and copy to specified destination
		define: multiSetter(function (module, sources, options, concat) {
			var settings = this.modules[module] = {
					type: "define",
					module: module,
					sources: sources,
					require: [],
					arguments: [],
					concat: function () {
						return _.toArray(arguments)
							.join("\n\n");
					}
				};

			if (typeof concat === "function") {
				settings.concat = concat;
			}

			if (options.global) {
				settings.global = options.global;
			}

			if (options.exports) {
				settings.exports = options.exports;
			}

			if (options.depends) {
				_.each(_.pairs(options.depends), function (pair) {
					if (pair[1]) {
						settings.require.unshift(pair[0]);
						settings.arguments.unshift(pair[1]);
					}
					else {
						settings.require.push(pair[0]);
					}
				});
			}
		}),

		// Run copy/converting process (async)
		build: function (complete) {
			var self = this,

				h = helpers(self),

				pairs = _.pairs(self.modules)
					.filter(function (pair) {
						return pair[1].type !== "vendor"
					}),

				completeResult = [];

			// Module processor
			function eachModule(pair, callback) {
				var module = pair[0],
					settings = pair[1];

				// Load and concat source files to single one
				function loadModuleSource(callback) {
					if (settings.sourceScript) {
						// Next step
						callback(null);
					}
					else {
						async.concatSeries(settings.sources, h.readFile, function (error, result) {
							if (!error) {
								settings.sourceScript = settings.concat.apply(self, result);
							}

							// Next step
							callback(error);
						});
					}
				}

				// Copy/modularize source
				function buildModule(callback) {
					if (settings.type === "import") {
						settings.sourceContent = settings.sourceScript;
					}
					else {
						var defines = [],

							factorySingle = self.options.factories.length <= 1,
							factoryLast = self.options.factories.length - 1,

							context = defineContext({
								mfd: self,
								module: module,
								undef: "undef",
								root: "root",
								factory: "factory"
							}),

							content = "";

						_.each(self.options.factories, function (name, factoryIndex) {
							var code = "",

								// Get factory composer
								factory = self.factories[name];

							if (factory) {
								if (factorySingle) {
									code += factory.define.call(context); // Build module defintion code
								}
								else {
									if (factoryIndex !== factoryLast) {
										code += "if (" + factory.when.call(context) + ") {\n"; // Build if condition
									}
									else {
										code += "{\n";
									}
									code += h.addIndent(factory.define.call(context), 1, true); // Build module defintion code
									code += "\n}";
								}

								// Push to stack
								defines.push(code);
							}
						});

						content += ";(function (" + context.root() + ", " + context.factory() + (context.undef(true) ? ", " + context.undef() : "") + ") {\n";
						content += h.rtrim(h.addIndent(defines.join("\nelse "), 1, true), true);
						content += "\n}(this, function (";
						content += settings.arguments.join(", ");
						content += ") {";
						content += h.rtrim(settings.sourceScript ? h.addIndent("\n\n" + settings.sourceScript, 1) : "", true);
						content += h.rtrim(settings.exports ? h.addIndent("\n\nreturn " + settings.exports + ";", 1) : "", true);
						content += "\n\n}));";

						// Join wrap stack to content
						settings.sourceContent = content;
					}

					// Beautify code
					settings.sourceContent = h.fixNewline(settings.sourceContent);
					settings.sourceContent = h.rtrim(settings.sourceContent);

					// Next step
					callback(null);
				}

				// Write module file to destination
				function writeModule(callback) {
					h.writeFile(module + ".js", settings.sourceContent);

					completeResult.push(module + ".js");

					// Next step
					callback(null);
				}

				function moduleDone(error) {
					callback(null);
				}

				// Start waterfall process
				async.waterfall([loadModuleSource, buildModule, writeModule], moduleDone);
			}

			function eachDone(error) {
				// RESET modules stack
				self.modules = {};

				if (_.isFunction(complete)) {
					complete(completeResult);
				}
			}

			// Process all modules
			async.each(pairs, eachModule, eachDone);
		}
	};

	/*
	 * Expose
	 */

	module.exports = exports = FactoryModuleDefinition;

}());