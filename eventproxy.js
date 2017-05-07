/*global define*/
!(function (name, definition) {
  // Check define
  var hasDefine = typeof define === 'function',
    // Check exports
    hasExports = typeof module !== 'undefined' && module.exports;

  if (hasDefine) {
    // AMD Module or CMD Module
    define('eventproxy_debug', function () {return function () {};}); // 定义一个eventproxy_debug 模块，返回一个空函数作为debug函数。
    define(['eventproxy_debug'], definition); // 依赖前面定义的模块，作为debug参数传入definition中。
  } else if (hasExports) {
    // Node.js Module
    module.exports = definition(require('debug')('eventproxy'));
    // debug 模块，一个简单的输出调试信息模块
  } else {
    // Assign to common namespaces or simply the global object (window)
    this[name] = definition();
  }
})('EventProxy', function (debug) {
  debug = debug || function () {}; //判空，如果没提供debug参数，如上面最后一种情况，则用空函数代替

  /*!
   * refs
   */
  var SLICE = Array.prototype.slice;
  var CONCAT = Array.prototype.concat;
  var ALL_EVENT = '__all__';

  /**
   * EventProxy. An implementation of task/event based asynchronous pattern.
   * A module that can be mixed in to *any object* in order to provide it with custom events.
   * You may `bind` or `unbind` a callback function to an event;
   * `trigger`-ing an event fires all callbacks in succession.
   * Examples:
   * ```js
   * var render = function (template, resources) {};
   * var proxy = new EventProxy();
   * proxy.assign("template", "l10n", render);
   * proxy.trigger("template", template);
   * proxy.trigger("l10n", resources);
   * ```
   */
  var EventProxy = function () {
    //如果用户直接调用EventProxy 构造方法，通过下面代码进行修正，返回正确的EventProxy对象
    if (!(this instanceof EventProxy)) {
      return new EventProxy();
    }
    this._callbacks = {}; //回调函数存放的地方，key 为对于的事件名称，值为回调函数数组。
    this._fired = {};
  };

  /**
   * Bind an event, specified by a string name, `ev`, to a `callback` function.
   * Passing __ALL_EVENT__ will bind the callback to all events fired.
  * Examples:
   * ```js
   * var proxy = new EventProxy();
   * proxy.addListener("template", function (event) {
   *   // TODO
   * });
   * ```
   * @param {String} eventname Event name.
   * @param {Function} callback Callback.
   */
  EventProxy.prototype.addListener = function (ev, callback) {
    debug('Add listener for %s', ev);
    this._callbacks[ev] = this._callbacks[ev] || [];
    this._callbacks[ev].push(callback);
    return this;
  };
  /**
   * `addListener` alias, `bind`
   */
  EventProxy.prototype.bind = EventProxy.prototype.addListener;
  /**
   * `addListener` alias, `on`
   */
  EventProxy.prototype.on = EventProxy.prototype.addListener;
  /**
   * `addListener` alias, `subscribe`
   */
  EventProxy.prototype.subscribe = EventProxy.prototype.addListener;

  /**
   * Bind an event, but put the callback into head of all callbacks.
   * @param {String} eventname Event name.
   * @param {Function} callback Callback.
   */
  EventProxy.prototype.headbind = function (ev, callback) {
    debug('Add listener for %s', ev);
    this._callbacks[ev] = this._callbacks[ev] || [];
    this._callbacks[ev].unshift(callback);
    return this;
  };

  /**
   * Remove one or many callbacks.
   *
   * - If `callback` is null, removes all callbacks for the event.
   * - If `eventname` is null, removes all bound callbacks for all events.
   * @param {String} eventname Event name.
   * @param {Function} callback Callback.
   */
   /*
    删除一个或者多个事件回调
    如果没有指明删除具体哪个回调函数 callback ，则删除这个事件上绑定的所有回调函数
    如果连eventname都没有提供则删除所有事件上绑定的所有回调函数
   */
  EventProxy.prototype.removeListener = function (eventname, callback) {
    var calls = this._callbacks;
    if (!eventname) {
      debug('Remove all listeners');
      this._callbacks = {};
    } else {
      if (!callback) {
        debug('Remove all listeners of %s', eventname);
        calls[eventname] = [];
      } else {
        var list = calls[eventname];
        if (list) {
          var l = list.length;
          for (var i = 0; i < l; i++) {
            if (callback === list[i]) {
              debug('Remove a listener of %s', eventname);
              list[i] = null;
            }
          }
        }
      }
    }
    return this;
  };
  /**
   * `removeListener` alias, unbind
   */
  EventProxy.prototype.unbind = EventProxy.prototype.removeListener;

  /**
   * Remove all listeners. It equals unbind()
   * Just add this API for as same as Event.Emitter.
   * @param {String} event Event name.
   */
  EventProxy.prototype.removeAllListeners = function (event) {
    return this.unbind(event);
  };

  /**
   * Bind the ALL_EVENT event
   */
  /**
    绑定处理函数到所有的事件上
  */
  EventProxy.prototype.bindForAll = function (callback) {
    this.bind(ALL_EVENT, callback);
  };

  /**
   * Unbind the ALL_EVENT event
   */
  EventProxy.prototype.unbindForAll = function (callback) {
    this.unbind(ALL_EVENT, callback);
  };

  /**
   * Trigger an event, firing all bound callbacks. Callbacks are passed the
   * same arguments as `trigger` is, apart from the event name.
   * Listening for `"all"` passes the true event name as the first argument.
   * @param {String} eventname Event name
   * @param {Mix} data Pass in data
   */
  EventProxy.prototype.trigger = function (eventname, data) {
    var list, ev, callback, i, l;
    var both = 2; // 设置为2的目的是，第一次先执行具体事件上的回调函数，第二次执行绑定在ALL_EVENT上的回调函数。
    var calls = this._callbacks;
    debug('Emit event %s with data %j', eventname, data);
    while (both--) {
      ev = both ? eventname : ALL_EVENT;
      list = calls[ev];
      if (list) {
        for (i = 0, l = list.length; i < l; i++) {
          if (!(callback = list[i])) { //如果callback为null，回调函数数组中剔除空元素，修正循环下标和数组长度。
            list.splice(i, 1);
            i--;
            l--;
          } else {
            var args = [];
            var start = both ? 1 : 0; // 如果是具体事件上的回调函数执行，参数不包括事件名称，如果是ALL_EVENT上的回调函数
            //执行，参数包括事件名称。
            for (var j = start; j < arguments.length; j++) {
              args.push(arguments[j]);
            }
            callback.apply(this, args);
          }
        }
      }
    }
    return this;
  };

  /**
   * `trigger` alias
   */
  EventProxy.prototype.emit = EventProxy.prototype.trigger;
  /**
   * `trigger` alias
   */
  EventProxy.prototype.fire = EventProxy.prototype.trigger;

  /**
   * Bind an event like the bind method, but will remove the listener after it was fired.
   * @param {String} ev Event name
   * @param {Function} callback Callback
   */
  EventProxy.prototype.once = function (ev, callback) {
    var self = this;
    //包装回调函数，执行完后自己解绑。
    var wrapper = function () {
      callback.apply(self, arguments);
      self.unbind(ev, wrapper);
    };
    this.bind(ev, wrapper);
    return this;
  };

 // 方法使用优先级 setImmediate -> nextTick -> setTimeout
  var later = (typeof setImmediate !== 'undefined' && setImmediate) ||
    (typeof process !== 'undefined' && process.nextTick) || function (fn) {
    setTimeout(fn, 0);
  };

  /**
   * emitLater
   * make emit async
   */
   //使得触发事件行为变成异步
  EventProxy.prototype.emitLater = function () {
    var self = this;
    var args = arguments;
    later(function () {
      self.trigger.apply(self, args);
    });
  };

  /**
   * Bind an event, and trigger it immediately.
   * @param {String} ev Event name.
   * @param {Function} callback Callback.
   * @param {Mix} data The data that will be passed to calback as arguments.
   */
   // 绑定完事件回调后立马先触发一次
  EventProxy.prototype.immediate = function (ev, callback, data) {
    this.bind(ev, callback); // 绑定事件
    this.trigger(ev, data); // 立马触发
    return this;
  };
  /**
   * `immediate` alias
   */
  EventProxy.prototype.asap = EventProxy.prototype.immediate;

  
  // 该方法的作用是收集前面事件触发后传给回调函数的数据，然后最后构成
  // 一个数据数组，传给callback（cb）如果once 为true 则这个callback 只会被调用一次
  // 否则会多次被调用

  var _assign = function (eventname1, eventname2, cb, once) {
    var proxy = this;
    var argsLength = arguments.length;
    var times = 0;
    var flag = {};

    // Check the arguments length.
    //必须提供至少3个参数
    if (argsLength < 3) {
      return this;
    }

    var events = SLICE.call(arguments, 0, -2);
    var callback = arguments[argsLength - 2];
    var isOnce = arguments[argsLength - 1];

    // Check the callback type.
    if (typeof callback !== "function") {
      return this;
    }
    debug('Assign listener for events %j, once is %s', events, !!isOnce);
    var bind = function (key) { //计数 收集数据
      var method = isOnce ? "once" : "bind";
      proxy[method](key, function (data) {
        proxy._fired[key] = proxy._fired[key] || {};
        proxy._fired[key].data = data;
        if (!flag[key]) {
          flag[key] = true;
          times++;
        }
      });
    };

    var length = events.length;
    for (var index = 0; index < length; index++) {
      bind(events[index]);
    }

    var _all = function (event) {
      if (times < length) { // 用来保证是否所有事件都已经触发过
        return; 
      }
      if (!flag[event]) { // 确保是提供的参数中包含的事件被触发
        return;
      }
      var data = [];
      for (var index = 0; index < length; index++) {
        data.push(proxy._fired[events[index]].data); // 收集所有数据
      }
      if (isOnce) { // 是否只需要触发一次
        proxy.unbindForAll(_all);
      }
      debug('Events %j all emited with data %j', events, data);
      callback.apply(null, data); // 调用回调函数
    };
    proxy.bindForAll(_all); // 将新够造的回调函数
  };

  /**
   * Assign some events, after all events were fired, the callback will be executed once.
   *
   * Examples:
   * ```js
   * proxy.all(ev1, ev2, callback);
   * proxy.all([ev1, ev2], callback);
   * proxy.all(ev1, [ev2, ev3], callback);
   * ```
   * @param {String} eventname1 First event name.
   * @param {String} eventname2 Second event name.
   * @param {Function} callback Callback, that will be called after predefined events were fired.
   */
   // 绑定一系列事件，当这些事件都触发了，callback会被执行一次。
  EventProxy.prototype.all = function (eventname1, eventname2, callback) {
    var args = CONCAT.apply([], arguments);
    args.push(true);
    _assign.apply(this, args); 
    return this;
  };
  /**
   * `all` alias
   */
  EventProxy.prototype.assign = EventProxy.prototype.all;

  /**
   * Assign the only one 'error' event handler.
   * @param {Function(err)} callback
   */
   // 绑定回调函数到error事件，一旦error触发，会解绑所有事件，然后执行绑定的回调函数。
  EventProxy.prototype.fail = function (callback) {
    var that = this;

    that.once('error', function () {
      that.unbind();
      // put all arguments to the error handler
      // fail(function(err, args1, args2, ...){})
      callback.apply(null, arguments);
    });
    return this;
  };

  /**
   * A shortcut of ep#emit('error', err)
   */
  EventProxy.prototype.throw = function () {
    var that = this;
    that.emit.apply(that, ['error'].concat(SLICE.call(arguments)));
  };

  /**
   * Assign some events, after all events were fired, the callback will be executed first time.
   * Then any event that predefined be fired again, the callback will executed with the newest data.
   * Examples:
   * ```js
   * proxy.tail(ev1, ev2, callback);
   * proxy.tail([ev1, ev2], callback);
   * proxy.tail(ev1, [ev2, ev3], callback);
   * ```
   * @param {String} eventname1 First event name.
   * @param {String} eventname2 Second event name.
   * @param {Function} callback Callback, that will be called after predefined events were fired.
   */
   // 绑定一些事件，当所有事件都触发了，callback 会被触发，以后只要这些事件中的 再次被触发，callback都会被执行。
  EventProxy.prototype.tail = function () {
    var args = CONCAT.apply([], arguments);
    args.push(false);
    _assign.apply(this, args);
    return this;
  };
  /**
   * `tail` alias, assignAll
   */
  EventProxy.prototype.assignAll = EventProxy.prototype.tail;
  /**
   * `tail` alias, assignAlways
   */
  EventProxy.prototype.assignAlways = EventProxy.prototype.tail;

  /**
   * The callback will be executed after the event be fired N times.
   * @param {String} eventname Event name.
   * @param {Number} times N times.
   * @param {Function} callback Callback, that will be called after event was fired N times.
   */
  EventProxy.prototype.after = function (eventname, times, callback) {
    if (times === 0) { // times为0 代表立即调用
      callback.call(null, []);
      return this;
    }
    var proxy = this,
      firedData = [];
    this._after = this._after || {};
    var group = eventname + '_group';
    this._after[group] = {
      index: 0,
      results: []
    };
    debug('After emit %s times, event %s\'s listenner will execute', times, eventname);
    var all = function (name, data) {
      if (name === eventname) {
        times--;
        firedData.push(data);
        if (times < 1) {
          debug('Event %s was emit %s, and execute the listenner', eventname, times);
          proxy.unbindForAll(all);
          callback.apply(null, [firedData]);
        }
      }
      if (name === group) {
        times--;
        proxy._after[group].results[data.index] = data.result;
        if (times < 1) {
          debug('Event %s was emit %s, and execute the listenner', eventname, times);
          proxy.unbindForAll(all);
          callback.call(null, proxy._after[group].results);
        }
      }
    };
    proxy.bindForAll(all);
    return this;
  };

  /**
   * The `after` method's helper. Use it will return ordered results.
   * If you need manipulate result, you need callback
   * Examples:
   * ```js
   * var ep = new EventProxy();
   * ep.after('file', files.length, function (list) {
   *   // Ordered results
   * });
   * for (var i = 0; i < files.length; i++) {
   *   fs.readFile(files[i], 'utf-8', ep.group('file'));
   * }
   * ```
   * @param {String} eventname Event name, shoule keep consistent with `after`.
   * @param {Function} callback Callback function, should return the final result.
   */
  EventProxy.prototype.group = function (eventname, callback) {
    var that = this;
    var group = eventname + '_group';
    var index = that._after[group].index;
    that._after[group].index++;
    return function (err, data) {
      if (err) {
        // put all arguments to the error handler
        return that.emit.apply(that, ['error'].concat(SLICE.call(arguments)));
      }
      that.emit(group, {
        index: index,
        // callback(err, args1, args2, ...)
        result: callback ? callback.apply(null, SLICE.call(arguments, 1)) : data
      });
    };
  };

  /**
   * The callback will be executed after any registered event was fired. It only executed once.
   * @param {String} eventname1 Event name.
   * @param {String} eventname2 Event name.
   * @param {Function} callback The callback will get a map that has data and eventname attributes.
   */
   //绑定事件，多个事件中只要一个事件触发 ，callback 就会被触发且只触发一次
  EventProxy.prototype.any = function () {
    var proxy = this,
      callback = arguments[arguments.length - 1],
      events = SLICE.call(arguments, 0, -1),
      _eventname = events.join("_"); // 链接事件名称

    debug('Add listenner for Any of events %j emit', events);
    proxy.once(_eventname, callback); // 绑定链接后的事件

    var _bind = function (key) {
      proxy.bind(key, function (data) {
        debug('One of events %j emited, execute the listenner'); 
        proxy.trigger(_eventname, {"data": data, eventName: key});
      });
    };

    for (var index = 0; index < events.length; index++) {
      _bind(events[index]); // 绑定所有的事件，任何一个事件触发都会触发联合事件
    }
  };

  /**
   * The callback will be executed when the event name not equals with assigned event.
   * @param {String} eventname Event name.
   * @param {Function} callback Callback.
   */
   // 除参数列表练出的事件名之外的事件被触发，就会触发回调
  EventProxy.prototype.not = function (eventname, callback) {
    var proxy = this;
    debug('Add listenner for not event %s', eventname);
    proxy.bindForAll(function (name, data) {
      if (name !== eventname) {
        debug('listenner execute of event %s emit, but not event %s.', name, eventname);
        callback(data);
      }
    });
  };

  /**
   * Success callback wrapper, will handler err for you.
   *
   * ```js
   * fs.readFile('foo.txt', ep.done('content'));
   *
   * // equal to =>
   *
   * fs.readFile('foo.txt', function (err, content) {
   *   if (err) {
   *     return ep.emit('error', err);
   *   }
   *   ep.emit('content', content);
   * });
   * ```
   *
   * ```js
   * fs.readFile('foo.txt', ep.done('content', function (content) {
   *   return content.trim();
   * }));
   *
   * // equal to =>
   *
   * fs.readFile('foo.txt', function (err, content) {
   *   if (err) {
   *     return ep.emit('error', err);
   *   }
   *   ep.emit('content', content.trim());
   * });
   * ```
   * @param {Function|String} handler, success callback or event name will be emit after callback.
   * @return {Function}
   */
   // 成功回调包装方法
  EventProxy.prototype.done = function (handler, callback) {
    var that = this;
    return function (err, data) {
      if (err) {
        // put all arguments to the error handler
        return that.emit.apply(that, ['error'].concat(SLICE.call(arguments)));
      }

      // callback(err, args1, args2, ...)
      var args = SLICE.call(arguments, 1);

      if (typeof handler === 'string') {
        // getAsync(query, ep.done('query'));
        // or
        // getAsync(query, ep.done('query', function (data) {
        //   return data.trim();
        // }));
        if (callback) {
          // only replace the args when it really return a result
          return that.emit(handler, callback.apply(null, args));
        } else {
          // put all arguments to the done handler
          //ep.done('some');
          //ep.on('some', function(args1, args2, ...){});
          return that.emit.apply(that, [handler].concat(args));
        }
      }

      // speed improve for mostly case: `callback(err, data)`
      if (arguments.length <= 2) {
        return handler(data);
      }

      // callback(err, args1, args2, ...)
      handler.apply(null, args);
    };
  };

  /**
   * make done async
   * @return {Function} delay done
   */
  EventProxy.prototype.doneLater = function (handler, callback) {
    var _doneHandler = this.done(handler, callback);
    return function (err, data) {
      var args = arguments;
      later(function () {
        _doneHandler.apply(null, args);
      });
    };
  };

  /**
   * Create a new EventProxy
   * Examples:
   * ```js
   * var ep = EventProxy.create();
   * ep.assign('user', 'articles', function(user, articles) {
   *   // do something...
   * });
   * // or one line ways: Create EventProxy and Assign
   * var ep = EventProxy.create('user', 'articles', function(user, articles) {
   *   // do something...
   * });
   * ```
   * @return {EventProxy} EventProxy instance
   */
  EventProxy.create = function () {
    var ep = new EventProxy();
    var args = CONCAT.apply([], arguments);
    if (args.length) {
      var errorHandler = args[args.length - 1];
      var callback = args[args.length - 2];
      if (typeof errorHandler === 'function' && typeof callback === 'function') {
        args.pop();
        ep.fail(errorHandler);
      }
      ep.assign.apply(ep, args);
    }
    return ep;
  };

  // Backwards compatibility
  EventProxy.EventProxy = EventProxy;

  return EventProxy;
});
