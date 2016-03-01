var
	director = require('./Director'),
	editor = require('./Editor'),
	animation = require('../animation'),
	utils = require('../utils');

var _ts, _wasts, _framerate = 16.6;

/**
 * Function to construct all the scenes instantiated from the Scene
 * @memberOf module:enyo/AnimationSupport/Scene
 * @private
 * @param  {number} id - id of the scene generated when created
 * @return {object} Constructed instance
 */
var Actor = module.exports = function(prop, actor) {

	var scene = Actor.makeScene(actor), fn;
	utils.mixin(scene, editor);

	fn = prop.isScene ? createFromScene : create;
	fn.call(scene, prop);
	return scene;
};


Actor.makeScene = function(actor) {
	var
		_req,

		_prevDur = 0,

		/**
		 * Holds refereneces of the all animations added to this scene.
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @private
		 * @type {Array}
		 */
		_poses = [],

		_actor = actor,

		/**
		 * Returns animation pose index for a particular 
		 * instance of time from the list of 
		 * animations added to the scene.
		 * @param  {number} span - Time span from the animation timeline
		 * @return {number}      - index of the animation
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @private
		 */
		animateAtTime = function(span) {
			var startIndex = 0,
				stopIndex = _poses.length - 1,
				middle = Math.floor((stopIndex + startIndex) / 2);

			if (span === 0) {
				return startIndex;
			}

			while (_poses[middle].span != span && startIndex < stopIndex) {
				if (span < _poses[middle].span) {
					stopIndex = middle;
				} else if (span > _poses[middle].span) {
					startIndex = middle + 1;
				}

				middle = Math.floor((stopIndex + startIndex) / 2);
			}
			return (_poses[middle].span != span) ? startIndex : middle;
		},

		action = function(ts, pose) {
			var past, index, tm,
				dur = this.span;

			if (_actor && _actor.generated && this.speed) {
				tm = this.rolePlay(ts);
				if (isNaN(tm) || tm < 0) return pose;
				else if (tm <= dur) {
					index = animateAtTime(tm);
					pose = this.getAnimation(index);
					past = index ? this.getAnimation(index - 1).span : 0;
					director.action(pose, _actor, tm - past, pose.span - past);
					this.step && this.step(_actor);
				} else {
					this.timeline = dur;
					this.speed = 0;
					this.active = false;
					this.actorCompleted && this.actorCompleted(_actor);
				}
			}
			return pose;
		};

	return {

		id: utils.uid("@"),

		isScene: true,

		/**
		 * An exposed property to know if know the animating state of this scene.
		 * 'true' - the scene is asked for animation(doesn't mean animation is happening)
		 * 'false' - the scene is not active(has completed or its actors are not visible)
		 * @type {Boolean}
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 */
		animating: false,

		/**
		 * An exposed property to know if the scene is ready with actors performing action.
		 * 'true' - the scene actors are ready for action
		 * 'false' - some or all actors are not ready
		 * @type {Boolean}
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 */
		active: false,

		/**
		 * Holds refereneces of complete time span for this scene.
		 * @type {Number}
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 */
		span: 0,

		/**
		 * This function initiates action on the animation
		 * from the list of animations for a given scene.
		 * @param  {number} ts   - timespan
		 * @param  {Object} pose - pose from the animation list
		 * @return {Object}      - pose
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @private
		 */
		action: action,

		/**
		 * Cancel the animation
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 */
		cancel: function() {
			animation.cancelRequestAnimationFrame(_req);
		},

		/**
		 * Triggers the Request Animation Frame
		 * @param  {boolean} force - A boolean value for letting the rAF start.
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 */
		trigger: function(force) {
			if (force || !this.animating) {
				_req = animation.requestAnimationFrame(utils.bindSafely(this, loop));
			}
		},

		/**
		 * Adds new animation on already existing animation for this character.
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 */
		addAnimation: function(newProp, span) {
			if (_prevDur === 0 && span === 0) {
				_poses[0] = {
					animate: newProp,
					span: 0
				};
			} else {
				_prevDur = span || _prevDur;
				this.span += _prevDur;
				_poses.push({
					animate: newProp,
					span: this.span
				});
			}
		},

		/**
		 * Function which returns the length of the poses.
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 * @return {number}      - length of the poses
		 */
		length: function() {
			return _poses.length;
		},

		/**
		 * Clears/removes the animation
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 */
		clearAnimation: function() {
			for (var i = 0; i < _poses.length; i++) {
				_poses[i]._startAnim = undefined;
			}
		},

		/**
		 * Returns animation pose based on index from the list of 
		 * animations added to this scene.
		 * @param  {number} index - animation's index from the list of animations
		 * @return {Object}   pose of the animation based on the index in the list
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 */
		getAnimation: function(index) {
			return index < 0 || _poses[index];
		},


		//TODO: Move these events to Event Delegator
		/**
		 * Event to identify when the scene has done animating.
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 */
		completed: function() {},

		/**
		 * Event to identify when the scene has done a step(rAF updatation of time) in the animation.
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 */
		step: function() {},

		/**
		 * Event to identify when the actor has done animating.
		 * @param  {Object} actor - animating element
		 * @memberOf module:enyo/AnimationSupport/Scene
		 * @public
		 */
		actorCompleted: function(actor) {}
	};
};



/**
 * Function used to loop in all the animations in a scene
 * @memberOf module:enyo/AnimationSupport/Scene
 * @private
 */
function loop() {
	if (this.animating) {
		_ts = utils.perfNow();
		_ts = _ts - (_wasts !== undefined ? _wasts : _ts);
		_ts = (_ts > _framerate) ? _framerate : _ts;
		director.take(this, _ts);
		_wasts = _ts;
		this.trigger(true);
	} else {
		_wasts = undefined;
		this.cancel();
		this.completed && this.completed();
	}
}


/**
 * Creates a empty instance of scene.
 * Can be used for runtime creation of animations
 * @memberOf module:enyo/AnimationSupport/Scene
 * @public
 * @return {Object} An instance of the constructor
 */
function create(props) {
	if (!props) return;

	var anims = utils.isArray(props) ? props : [props];

	for (var i = 0; i < anims.length; i++) {
		this.addAnimation(anims[i], anims[i].duration || 0);
		delete anims[i].duration;
	}
}


/**
 * Creates a empty instance of scene.
 * Can be used for runtime creation of animations
 * @memberOf module:enyo/AnimationSupport/Scene
 * @public
 * @return {Object} An instance of the constructor
 */
function createFromScene(source) {
	if (!source) return;

	var i, l = source.length(),
		anim;

	for (i = 0; i < l; i++) {
		anim = utils.mixin({}, source.getAnimation(i));
		this.addAnimation(anim.animate, anim.span);
	}
}