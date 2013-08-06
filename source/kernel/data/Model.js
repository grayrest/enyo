(function (enyo) {

	//*@public
	/**
		Returns a Boolean true or false indicating whether the passed-in object is
		an _enyo.Model_ or a subkind of _enyo.Model_.
	*/
	enyo.isModel = function (obj) {
		return !! (obj && obj.__isModel);
	};
	
	//*@protected
	var isModel = enyo.isModel;
	
	//*@public
	/**
		The status of an _enyo.Model_ will be one of values defined in the _STATES_
		hash. A Model's status may be checked explicitly against these status
		globals (e.g., _enyo.Model.ERROR.TYPE_).
	*/
	var STATES = {};

	//*@public
	/**
		There are multiple error states, each with a different meaning
	*/
	var ERROR = STATES.ERROR = {};

	/**
		The state of a model when an attribute is set with a defined type, but fails
		to be or become (after being run through the typeWrangler) the correct type
	*/
	ERROR.TYPE =						0x01;

	/**
		The state of a model when an error occurs during initialization because the
		model cannot determine the schema for attributes directly from a definition
		or by inference from defaults or data supplied to the constructor
	*/
	ERROR.SCHEMA =						0x02;

	/**
		The state of a model that receives a bad response from the _enyo.Source_ for
		the application
	*/
	ERROR.RESPONSE =					0x03;

	/**
		The state of a model that attempts to execute an action against a remote
		when the store does not exist or the source is unavailable
	*/
	ERROR.SOURCE =						0x04;

	//*@public
	/**
		When the model is attempting to fetch, commit, or destroy, it will be in one
		of the _BUSY_ states.
	*/
	var BUSY = STATES.BUSY = {};

	/**
		The state of a model that is in the process of fetching data from the
		_enyo.Source_ for the application
	*/
	BUSY.FETCHING		=				0x11;

	/**
		The state of a model that is in the process of committing data to the
		_enyo.Source_ for the application
	*/
	BUSY.COMMITTING		=				0x12;

	/**
		The state of a model that is in the process of being destroyed
	*/
	BUSY.DESTROYING		=				0x13;

	//*@public
	/**
		The state of a model that has had values applied to it, but only values that
		are synchronized with the given source and do not need to be committed. For
		example, this will be the state of a model whose values have just been set
		during construction, or one to which default values have just been applied.
	*/
	var CLEAN = STATES.CLEAN =			0x21;

	//*@public
	/**
		The state of a model that has been destroyed.  It will no longer exist in
		the	_enyo.Store_ or in the remote, and changes will not be tracked.
	*/
	var DESTROYED = STATES.DESTROYED =	0x31;

	//*@public
	/**
		The state of a recently-created model, to which no values have been applied
		(either explicitly via attributes or implicitly via	defaults/initial
		values). If default values are used during setup or values are applied
		later, the model will not be in the _NEW_ state.
	*/
	var NEW = STATES.NEW =				0x41;

	//*@public
	/**
		The state of a model that has a defined schema with an attribute that has
		been modified and needs to be synchronized. The only exception is a
		recently-created model that still retains default values; it will not be in
		the _DIRTY_ state until a modification takes place.
	*/
	var DIRTY = STATES.DIRTY =			0x51;
	
	//*@protected
	/**
		Without interfering with the construction chain, we need to register
		the record with the store. This cannot be done during the construction
		chain.
	*/
	enyo.kind.postConstructors.push(function () {
		if (this.__isModel) {
			enyo.models.queue(this);
		}
	});
	
	//*@protected
	/**
		As seen at https://gist.github.com/jcxplorer/823878, by jcxplorer.
		TODO: replace with faster implementation
	*/
	var uuid = function () {
		var uuid = "", idx = 0, rand;
		for (; idx < 32; ++idx) {
			rand = Math.random() * 16 | 0;
			if (idx == 8 || idx == 12 || idx == 16 || idx == 20) {
				uuid += "-";
			}
			uuid += (idx == 12? 4: (idx == 16? (rand & 3 | 8): rand)).toString(16);
		}
		return uuid;
	};
	
	enyo.kind({
		
		//*@public
		name: "enyo.Model",
		
		//*@protected
		kind: "enyo.Object",

		//*@public
		/**
		*/
		attributes: null,

		//*@public
		/**
			The hash of default values to be supplied to the model upon instantiation.
		*/
		defaults: null,

		//*@public
		/**
			A static root for this particular model. In a system with a simple REST
			backend with a 1 to 1 mapping of client model to backend server/service,
			the _url_ could be of the form `/models/artist`. It may also be used in
			more complex scenarios. Note that this property is appended to the domain
			url generated by the _enyo.Source_ for the _enyo.Store_ of the current
			application. If the _noUrl_ property is set to false and no _url_ is
			specified, it will be automatically generated based on the name of the
			model kind.
		*/
		url: "",

		//*@public
		/**
			The _status_ of the model is defined by a fixed set of enumerated
			values. (See the documentation for _enyo.Model_ states).
		*/
		status: NEW,

		//*@public
		/**
			String representing which attribute to use as the indexable
			primary key for this model. The default is _"id"_.
		*/
		primaryKey: "id",
		
		//*@public
		noFetchId: true,

		//*@public
		/**
			In some cases, correct remote calls are generated by some means other than
			the normal url generation. In these cases, this Boolean flag needs to be
			set to true. The default is false.
		*/
		noUrl: false,
		
		//*@public
		/**
			For cases in which the _url_ is arbitrarily set and must be used as-is,
			set this flag to true. This setting will ignore the value of the _noUrl_
			property.
		*/
		rawUrl: false,
		
		//*@public
		/**
			In cases where the commit body should be a subset of the attributes
			explicitly or implicitly defined by the schema, set this property to
			an array of the keys that should be included. For a programmatic way
			of filtering payload data, use the _filterData()_ method and watch for
			the second parameter to be _commit_.
		*/
		includeKeys: null,
		
		//*@public
		/**
			An optional validation entry function. If the options provided to `set`
			or `commit` include the flag `validate` and it is `true` this method
			will be handed the entire dataset. If this method returns anything `truthy`
			then the model will go into an error-state.
		*/
		validate: null,
		
		//*@public
		/**
		*/
		isValid: true,
		
		//*@public
		/**
			Used internally by _enyo.Source_ to generate an appropriate request url.
			Overload this method in custom setups.
		*/
		query: enyo.computed(function () {
			if (!this.noUrl && !this.rawUrl) {
				return this.get("url") + "/" + this.get(this.primarykey);
			} else if (this.rawUrl) {
				return this.get("url");
			} else {
				return "";
			}
		}),

		//*@public
		/**
			Overload this method to conditionally mutate data for incoming and
			outgoing payloads. The _data_ parameter is the data to be mutated. The
			value of _direction_ will be either _"fetch"_ or "commit", denoting
			incoming and outgoing data, respectively. Returns the data presented to
			the _didFetch()_ method and the payload included in commits, when
			appropriate.
		*/
		filterData: function (data, direction) {
			return data;
		},

		//*@public
		/**
			When the _enyo.Source_ is constructing the request for this model
			(regardless of the action), it calls this method. You may overload the
			method to add custom parameters to the _queryParams_ hash of the
			_options_ parameter. These parameters are key-value pairs used to generate
			the options in a query string in default setups. They may also be used for
			other purposes in overloaded and custom setups.
		*/
		buildQueryParams: function (model, options) {
			// the options parameter will have a hash at property queryParams
			// that can be modified directly by adding properties or using
			// enyo.mixin for example
		},

		//*@public
		/**
			Executes a commit of the model's current state. The optional _options_
			hash may include _success()_ and/or _error()_ methods, to be executed
			asynchronously in response to the respective results.
		*/
		commit: function (options) {
			var $options = options? enyo.clone(options): {};
			this.set("status", BUSY.COMMITTING);
			$options.postBody = this.filterData(this.raw(), "commit");
			this.exec("commit", $options);
		},

		//*@public
		/**
			Executes a fetch. The optional _options_ hash may include _success()_
			and/or _error()_ methods, to be executed asynchronously in response to the
			respective results.
		*/
		fetch: function (options) {
			this.set("status", BUSY.FETCHING);
			this.exec("fetch", options);
		},

		//*@public
		/**
			Executes a destroy operation that destroys the model in the client and
			also (by default) sends a _DELETE_ request to the source. The optional
			_options_ hash may include _success()_ and/or _error()_ methods, to be
			executed asynchronously in response to the respective results.
		*/
		destroy: function (options) {
			this.set("status", BUSY.DESTROYING);
			this.exec("destroy", options);
		},

		//*@public
		/**
			This method should not be executed directly, but may be overloaded in
			custom setups.
		*/
		exec: function (action, options) {
			if (enyo.store) {
				var $options = options? enyo.clone(options): {};
				$options.success = this.bindSafely("did" + enyo.cap(action), options || {});
				$options.error = this.bindSafely("didFail", action, options || {});
				enyo.store[action](this, $options);
			} else {
				this.set("status", ERROR.SOURCE);
			}
		},
		
		//*@public
		/**
			This method should not be executed directly, but may be overloaded in
			custom setups. Note that many of the details of this implementation
			are needed to make models work properly; great care should be taken when
			making modifications, or you may encounter unexpected or unpredictable
			results.
		*/
		didFetch: function (options, result) {
			if (result && "object" == typeof result) {
				this.set(result, options);
			}
			if (this.isValid) {
				this.set("status", CLEAN);
				if (options && options.success) {
					options.success(result, this, options);
				}
			} else if (options && options.error) {
				options.error(result, this, options);
			}
		},

		//*@public
		/**
			This method should not be executed directly, but may be overloaded in
			custom setups.
		*/
		didCommit: function (options, result) {
			if (result && "object" === typeof result) {
				this.set(result);
			}
			this.set("status", CLEAN);
			this.__changed = {};
			if (options && options.success) {
				options.success(result, this, options);
			}
		},

		//*@public
		/**
			This method should not be executed directly, but may be overloaded in
			custom setups.
		*/
		didDestroy: function (options, result) {
			this.set("status", DESTROYED);
			enyo.Component.prototype.destroy.call(this);
			if (options && options.success) {
				options.success(result, this, options);
			}
		},

		//*@public
		/**
			This method should not be executed directly, but may be overloaded in
			custom setups. The _action_ parameter will be one of _"fetch"_,
			_"destroy"_, _"commit"_, or _"update"_, depending on which action failed.
		*/
		didFail: function (action, options, result) {
			this.set("status", ERROR.RESPONSE);
			if (options && options.error) {
				options.error(result, this, options);
			}
		},
		
		//*@public
		/**
			Returns an _Object_ literal that represents the JSON-parseable form
			of the model in its current state.
		*/
		raw: function () {
			var $a = this.attributes;
			return this.includeKeys? enyo.only(this.includeKeys, $a): enyo.clone($a);
		},
		
		
		//*@public
		/**
		*/
		set: function (props, options) {
			// handle the case where props is a string so the remainder
			// of the method can resume unchanged
			if (enyo.isString(props)) {
				var o$ = props;
				props = {};
				prop[o$] = options;
				if (arguments[2] !== undefined) {
					options = arguments[2];
				}
			}
			var $o = options || {},
				$p = props,
				$a = this.attributes,
				$r = this.__previous,
				$c = this.__changed,
				c$ = false, v$;
			if ($o.validate && enyo.isFunction(this.validate)) {
				if (!this.__validate($p, $o)) { return false; }
			}
			for (var k in $p) {
				v$ = $p[k];
				if (v$ !== $a[k]) {
					// update previous to current value
					$r[k] = $a[k];
					// update actual value
					$a[k] = v$;
					// update the changed hash
					$c[k] = v$;
					c$ = true;
				}
			}
			if (c$ && this._allowNotifications) {
				for (k in $c) {
					this.notifyObservers(k, $r[k], $c[k]);
				}
			}
		},

		//*@public
		/**
			Returns the JSON parsed string value for this model in its current state,
			as would be appropriate to send in a payload to the source.
		*/
		toJSON: function () {
			return enyo.json.stringify(this.raw());
		},
		
		//*@public
		/**
		*/
		constructor: function (attributes, options) {
			var $a = attributes || {},
				$d = this.defaults,
				$o = options || {};
			this.attributes = {};
			this.__previous = {};
			this.__changed = {};
			if ($d) { $a = enyo.mixin($a, $d, {ignore: true}); }
			if ($o.filter) { $a = this.filterData($a, "fetch"); }
			this.euuid = uuid();
			attributes = undefined;
			options = undefined;
			this.inherited(arguments);
			this.set($a, $o);
		},

		//*@protected
		__validate: function (data, options) {
			// TODO:
		},
		
		__isModel: true,
		__previous: null,
		__changed: null,
		__noApplyMixinDestroy: true
	});
	
})(enyo);