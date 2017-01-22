/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.setImmediate = setImmediate;
            async.nextTick = setImmediate;
        }
        else {
            async.setImmediate = async.nextTick;
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = setImmediate;
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback(null);
                    }
                }
            }));
        });
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback(null);
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                results[x.index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        if (!keys.length) {
            return callback(null);
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (_keys(results).length === keys.length) {
                callback(null, results);
                callback = function () {};
            }
        });

        _each(keys, function (k) {
            var task = (tasks[k] instanceof Function) ? [tasks[k]]: tasks[k];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor !== Array) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            if (test()) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            if (!test()) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if(data.constructor !== Array) {
              data = [data];
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            }
        };
        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
                if(data.constructor !== Array) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain) cargo.drain();
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                callback.apply(null, memo[key]);
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.compose = function (/* functions... */) {
        var fns = Array.prototype.reverse.call(arguments);
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // AMD / RequireJS
    if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // Node.js
    else if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1 Version 2.1a Copyright Paul Johnston 2000 - 2002. Other
 * contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet Distributed under the
 * BSD License See http://pajhome.org.uk/crypt/md5 for details.
 */

/*
 * Configurable variables. You may need to tweak these to be compatible with the
 * server-side, but the defaults work in most cases.
 */
var hexcase = 1;	// hex output format. 0 - lowercase; 1 - uppercase
var b64pad = "";	// base-64 pad character. "=" for strict RFC compliance
var chrsz = 8;		// bits per input character. 8 - ASCII; 16 - Unicode

/*
 * These are the functions you'll usually want to call They take string
 * arguments and return either hex or base-64 encoded strings
 */
function hex_sha1 (s) {
	return binb2hex (core_sha1 (str2binb (s), s.length * chrsz));
}

function b64_sha1 (s) {
	return binb2b64 (core_sha1 (str2binb (s), s.length * chrsz));
}

function str_sha1 (s) {
	return binb2str (core_sha1 (str2binb (s), s.length * chrsz));
}

function hex_hmac_sha1 (key, data) {
	return binb2hex (core_hmac_sha1 (key, data));
}

function b64_hmac_sha1 (key, data) {
	return binb2b64 (core_hmac_sha1 (key, data));
}

function str_hmac_sha1 (key, data) {
	return binb2str (core_hmac_sha1 (key, data));
}

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test () {
	return hex_sha1 ("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1 (x, len) {
	/* append padding */
	x [len >> 5] |= 0x80 << (24 - len % 32);
	x [((len + 64 >> 9) << 4) + 15] = len;

	var w = Array (80);
	var a = 1732584193;
	var b = -271733879;
	var c = -1732584194;
	var d = 271733878;
	var e = -1009589776;

	for (var i = 0; i < x.length; i += 16) {
		var olda = a;
		var oldb = b;
		var oldc = c;
		var oldd = d;
		var olde = e;

		for (var j = 0; j < 80; j++) {
			if (j < 16)
				w [j] = x [i + j];
			else
				w [j] = rol (w [j - 3] ^ w [j - 8] ^ w [j - 14] ^ w [j - 16], 1);
			var t = safe_add (safe_add (rol (a, 5), sha1_ft (j, b, c, d)), safe_add (safe_add (e, w [j]), sha1_kt (j)));
			e = d;
			d = c;
			c = rol (b, 30);
			b = a;
			a = t;
		}

		a = safe_add (a, olda);
		b = safe_add (b, oldb);
		c = safe_add (c, oldc);
		d = safe_add (d, oldd);
		e = safe_add (e, olde);
	}
	return Array (a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft (t, b, c, d) {
	if (t < 20)
		return (b & c) | ((~b) & d);
	if (t < 40)
		return b ^ c ^ d;
	if (t < 60)
		return (b & c) | (b & d) | (c & d);
	return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt (t) {
	return (t < 20) ? 1518500249 : (t < 40) ? 1859775393 : (t < 60) ? -1894007588 : -899497514;
}

/*
 * Calculate the HMAC-SHA1 of a key and some data
 */
function core_hmac_sha1 (key, data) {
	var bkey = str2binb (key);
	if (bkey.length > 16)
		bkey = core_sha1 (bkey, key.length * chrsz);

	var ipad = Array (16), opad = Array (16);
	for (var i = 0; i < 16; i++) {
		ipad [i] = bkey [i] ^ 0x36363636;
		opad [i] = bkey [i] ^ 0x5C5C5C5C;
	}

	var hash = core_sha1 (ipad.concat (str2binb (data)), 512 + data.length * chrsz);
	return core_sha1 (opad.concat (hash), 512 + 160);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally to
 * work around bugs in some JS interpreters.
 */
function safe_add (x, y) {
	var lsw = (x & 0xFFFF) + (y & 0xFFFF);
	var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
	return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol (num, cnt) {
	return (num << cnt) | (num >>> (32 - cnt));
}

/*
 * Convert an 8-bit or 16-bit string to an array of big-endian words In 8-bit
 * function, characters >255 have their hi-byte silently ignored.
 */
function str2binb (str) {
	var bin = Array ();
	var mask = (1 << chrsz) - 1;
	for (var i = 0; i < str.length * chrsz; i += chrsz)
		bin [i >> 5] |= (str.charCodeAt (i / chrsz) & mask) << (32 - chrsz - i % 32);
	return bin;
}

/*
 * Convert an array of big-endian words to a string
 */
function binb2str (bin) {
	var str = "";
	var mask = (1 << chrsz) - 1;
	for (var i = 0; i < bin.length * 32; i += chrsz)
		str += String.fromCharCode ((bin [i >> 5] >>> (32 - chrsz - i % 32)) & mask);
	return str;
}

/*
 * Convert an array of big-endian words to a hex string.
 */
function binb2hex (binarray) {
	var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
	var str = "";
	for (var i = 0; i < binarray.length * 4; i++) {
		str += hex_tab.charAt ((binarray [i >> 2] >> ((3 - i % 4) * 8 + 4)) & 0xF)
				+ hex_tab.charAt ((binarray [i >> 2] >> ((3 - i % 4) * 8)) & 0xF);
	}
	return str;
}

/*
 * Convert an array of big-endian words to a base-64 string
 */
function binb2b64 (binarray) {
	var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	var str = "";
	for (var i = 0; i < binarray.length * 4; i += 3) {
		var triplet = (((binarray [i >> 2] >> 8 * (3 - i % 4)) & 0xFF) << 16)
				| (((binarray [i + 1 >> 2] >> 8 * (3 - (i + 1) % 4)) & 0xFF) << 8)
				| ((binarray [i + 2 >> 2] >> 8 * (3 - (i + 2) % 4)) & 0xFF);
		for (var j = 0; j < 4; j++) {
			if (i * 8 + j * 6 > binarray.length * 32)
				str += b64pad;
			else
				str += tab.charAt ((triplet >> 6 * (3 - j)) & 0x3F);
		}
	}
	return str;
}

//     Underscore.js 1.8.2
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.2';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var isArrayLike = function(collection) {
    var length = collection && collection.length;
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, target, fromIndex) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    return _.indexOf(obj, target, typeof fromIndex == 'number' && fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = input && input.length; i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (array == null) return [];
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = array.length; i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    if (array == null) return [];
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = array.length; i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, 'length').length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = list && list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    var i = 0, length = array && array.length;
    if (typeof isSorted == 'number') {
      i = isSorted < 0 ? Math.max(0, length + isSorted) : isSorted;
    } else if (isSorted && length) {
      i = _.sortedIndex(array, item);
      return array[i] === item ? i : -1;
    }
    if (item !== item) {
      return _.findIndex(slice.call(array, i), _.isNaN);
    }
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  _.lastIndexOf = function(array, item, from) {
    var idx = array ? array.length : 0;
    if (typeof from == 'number') {
      idx = from < 0 ? idx + from + 1 : Math.min(idx, from + 1);
    }
    if (item !== item) {
      return _.findLastIndex(slice.call(array, 0, idx), _.isNaN);
    }
    while (--idx >= 0) if (array[idx] === item) return idx;
    return -1;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = array != null && array.length;
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createIndexFinder(1);

  _.findLastIndex = createIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    
    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of 
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;
  
  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

//     Backbone.js 1.2.1

//     (c) 2010-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(factory) {

  // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
  // We use `self` instead of `window` for `WebWorker` support.
  var root = (typeof self == 'object' && self.self == self && self) ||
            (typeof global == 'object' && global.global == global && global);

  // Set up Backbone appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function(_, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global Backbone.
      root.Backbone = factory(root, exports, _, $);
    });

  // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore'), $;
    try { $ = require('jquery'); } catch(e) {}
    factory(root, exports, _, $);

  // Finally, as a browser global.
  } else {
    root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

}(function(root, Backbone, _, $) {

  // Initial Setup
  // -------------

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create a local reference to a common array method we'll want to use later.
  var slice = [].slice;

  // Current version of the library. Keep in sync with `package.json`.
  Backbone.VERSION = '1.2.1';

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  Backbone.$ = $;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... this will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  Backbone.emulateJSON = false;

  // Proxy Underscore methods to a Backbone class' prototype using a
  // particular attribute as the data argument
  var addMethod = function(length, method, attribute) {
    switch (length) {
      case 1: return function() {
        return _[method](this[attribute]);
      };
      case 2: return function(value) {
        return _[method](this[attribute], value);
      };
      case 3: return function(iteratee, context) {
        return _[method](this[attribute], iteratee, context);
      };
      case 4: return function(iteratee, defaultVal, context) {
        return _[method](this[attribute], iteratee, defaultVal, context);
      };
      default: return function() {
        var args = slice.call(arguments);
        args.unshift(this[attribute]);
        return _[method].apply(_, args);
      };
    }
  };
  var addUnderscoreMethods = function(Class, methods, attribute) {
    _.each(methods, function(length, method) {
      if (_[method]) Class.prototype[method] = addMethod(length, method, attribute);
    });
  };

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {};

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Iterates over the standard `event, callback` (as well as the fancy multiple
  // space-separated events `"change blur", callback` and jQuery-style event
  // maps `{event: callback}`), reducing them by manipulating `memo`.
  // Passes a normalized single event name and callback, as well as any
  // optional `opts`.
  var eventsApi = function(iteratee, memo, name, callback, opts) {
    var i = 0, names;
    if (name && typeof name === 'object') {
      // Handle event maps.
      if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;
      for (names = _.keys(name); i < names.length ; i++) {
        memo = iteratee(memo, names[i], name[names[i]], opts);
      }
    } else if (name && eventSplitter.test(name)) {
      // Handle space separated event names.
      for (names = name.split(eventSplitter); i < names.length; i++) {
        memo = iteratee(memo, names[i], callback, opts);
      }
    } else {
      memo = iteratee(memo, name, callback, opts);
    }
    return memo;
  };

  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  Events.on = function(name, callback, context) {
    return internalOn(this, name, callback, context);
  };

  // An internal use `on` function, used to guard the `listening` argument from
  // the public API.
  var internalOn = function(obj, name, callback, context, listening) {
    obj._events = eventsApi(onApi, obj._events || {}, name, callback, {
        context: context,
        ctx: obj,
        listening: listening
    });

    if (listening) {
      var listeners = obj._listeners || (obj._listeners = {});
      listeners[listening.id] = listening;
    }

    return obj;
  };

  // Inversion-of-control versions of `on`. Tell *this* object to listen to
  // an event in another object... keeping track of what it's listening to.
  Events.listenTo =  function(obj, name, callback) {
    if (!obj) return this;
    var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
    var listeningTo = this._listeningTo || (this._listeningTo = {});
    var listening = listeningTo[id];

    // This object is not listening to any other events on `obj` yet.
    // Setup the necessary references to track the listening callbacks.
    if (!listening) {
      var thisId = this._listenId || (this._listenId = _.uniqueId('l'));
      listening = listeningTo[id] = {obj: obj, objId: id, id: thisId, listeningTo: listeningTo, count: 0};
    }

    // Bind callbacks on obj, and keep track of them on listening.
    internalOn(obj, name, callback, this, listening);
    return this;
  };

  // The reducing API that adds a callback to the `events` object.
  var onApi = function(events, name, callback, options) {
    if (callback) {
      var handlers = events[name] || (events[name] = []);
      var context = options.context, ctx = options.ctx, listening = options.listening;
      if (listening) listening.count++;

      handlers.push({ callback: callback, context: context, ctx: context || ctx, listening: listening });
    }
    return events;
  };

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  Events.off =  function(name, callback, context) {
    if (!this._events) return this;
    this._events = eventsApi(offApi, this._events, name, callback, {
        context: context,
        listeners: this._listeners
    });
    return this;
  };

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  Events.stopListening =  function(obj, name, callback) {
    var listeningTo = this._listeningTo;
    if (!listeningTo) return this;

    var ids = obj ? [obj._listenId] : _.keys(listeningTo);

    for (var i = 0; i < ids.length; i++) {
      var listening = listeningTo[ids[i]];

      // If listening doesn't exist, this object is not currently
      // listening to obj. Break out early.
      if (!listening) break;

      listening.obj.off(name, callback, this);
    }
    if (_.isEmpty(listeningTo)) this._listeningTo = void 0;

    return this;
  };

  // The reducing API that removes a callback from the `events` object.
  var offApi = function(events, name, callback, options) {
    // No events to consider.
    if (!events) return;

    var i = 0, listening;
    var context = options.context, listeners = options.listeners;

    // Delete all events listeners and "drop" events.
    if (!name && !callback && !context) {
      var ids = _.keys(listeners);
      for (; i < ids.length; i++) {
        listening = listeners[ids[i]];
        delete listeners[listening.id];
        delete listening.listeningTo[listening.objId];
      }
      return;
    }

    var names = name ? [name] : _.keys(events);
    for (; i < names.length; i++) {
      name = names[i];
      var handlers = events[name];

      // Bail out if there are no events stored.
      if (!handlers) break;

      // Replace events if there are any remaining.  Otherwise, clean up.
      var remaining = [];
      for (var j = 0; j < handlers.length; j++) {
        var handler = handlers[j];
        if (
          callback && callback !== handler.callback &&
            callback !== handler.callback._callback ||
              context && context !== handler.context
        ) {
          remaining.push(handler);
        } else {
          listening = handler.listening;
          if (listening && --listening.count === 0) {
            delete listeners[listening.id];
            delete listening.listeningTo[listening.objId];
          }
        }
      }

      // Update tail event if the list has any events.  Otherwise, clean up.
      if (remaining.length) {
        events[name] = remaining;
      } else {
        delete events[name];
      }
    }
    if (_.size(events)) return events;
  };

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, it will be removed. When multiple events are
  // passed in using the space-separated syntax, the event will fire once for every
  // event you passed in, not once for a combination of all events
  Events.once =  function(name, callback, context) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.off, this));
    return this.on(events, void 0, context);
  };

  // Inversion-of-control versions of `once`.
  Events.listenToOnce =  function(obj, name, callback) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.stopListening, this, obj));
    return this.listenTo(obj, events);
  };

  // Reduces the event callbacks into a map of `{event: onceWrapper}`.
  // `offer` unbinds the `onceWrapper` after it has been called.
  var onceMap = function(map, name, callback, offer) {
    if (callback) {
      var once = map[name] = _.once(function() {
        offer(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
    }
    return map;
  };

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  Events.trigger =  function(name) {
    if (!this._events) return this;

    var length = Math.max(0, arguments.length - 1);
    var args = Array(length);
    for (var i = 0; i < length; i++) args[i] = arguments[i + 1];

    eventsApi(triggerApi, this._events, name, void 0, args);
    return this;
  };

  // Handles triggering the appropriate event callbacks.
  var triggerApi = function(objEvents, name, cb, args) {
    if (objEvents) {
      var events = objEvents[name];
      var allEvents = objEvents.all;
      if (events && allEvents) allEvents = allEvents.slice();
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, [name].concat(args));
    }
    return objEvents;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Backbone.Model
  // --------------

  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = Backbone.Model = function(attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId(this.cidPrefix);
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The value returned during the last failed validation.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // The prefix is used to create the client id which is used to identify models locally.
    // You may want to override this if you're experiencing name clashes with model ids.
    cidPrefix: 'c',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Special-cased proxy to underscore's `_.matches` method.
    matches: function(attrs) {
      return !!_.iteratee(attrs, this)(this.attributes);
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function(key, val, options) {
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      var attrs;
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      var unset      = options.unset;
      var silent     = options.silent;
      var changes    = [];
      var changing   = this._changing;
      this._changing = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }

      var current = this.attributes;
      var changed = this.changed;
      var prev    = this._previousAttributes;

      // Check for changes of `id`.
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      // For each `set` attribute, update or delete the current value.
      for (var attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          changed[attr] = val;
        } else {
          delete changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = options;
        for (var i = 0; i < changes.length; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      var changed = {};
      for (var attr in diff) {
        var val = diff[attr];
        if (_.isEqual(old[attr], val)) continue;
        changed[attr] = val;
      }
      return _.size(changed) ? changed : false;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server, merging the response with the model's
    // local attributes. Any changed attributes will trigger a "change" event.
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        if (!model.set(serverAttrs, options)) return false;
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      // Handle both `"key", value` and `{key: value}` -style arguments.
      var attrs;
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true, parse: true}, options);
      var wait = options.wait;

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      if (attrs && !wait) {
        if (!this.set(attrs, options)) return false;
      } else {
        if (!this._validate(attrs, options)) return false;
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      var model = this;
      var success = options.success;
      var attributes = this.attributes;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        if (wait) serverAttrs = _.extend({}, attrs, serverAttrs);
        if (serverAttrs && !model.set(serverAttrs, options)) return false;
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      // Set temporary attributes if `{wait: true}` to properly find new ids.
      if (attrs && wait) this.attributes = _.extend({}, attributes, attrs);

      var method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch' && !options.attrs) options.attrs = attrs;
      var xhr = this.sync(method, this, options);

      // Restore attributes.
      this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;
      var wait = options.wait;

      var destroy = function() {
        model.stopListening();
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (wait) destroy();
        if (success) success.call(options.context, model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      var xhr = false;
      if (this.isNew()) {
        _.defer(options.success);
      } else {
        wrapError(this, options);
        xhr = this.sync('delete', this, options);
      }
      if (!wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    url: function() {
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      if (this.isNew()) return base;
      var id = this.get(this.idAttribute);
      return base.replace(/[^\/]$/, '$&/') + encodeURIComponent(id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    isValid: function(options) {
      return this._validate({}, _.defaults({validate: true}, options));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });

  // Underscore methods that we want to implement on the Model.
  var modelMethods = { keys: 1, values: 1, pairs: 1, invert: 1, pick: 0,
      omit: 0, chain: 1, isEmpty: 1 };

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  addUnderscoreMethods(Model, modelMethods, 'attributes');

  // Backbone.Collection
  // -------------------

  // If models tend to represent a single row of data, a Backbone Collection is
  // more analogous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model) { return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set.
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function(models, options) {
      options = _.extend({}, options);
      var singular = !_.isArray(models);
      models = singular ? [models] : _.clone(models);
      var removed = this._removeModels(models, options);
      if (!options.silent && removed) this.trigger('update', this, options);
      return singular ? removed[0] : removed;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function(models, options) {
      options = _.defaults({}, options, setOptions);
      if (options.parse && !this._isModel(models)) models = this.parse(models, options);
      var singular = !_.isArray(models);
      models = singular ? (models ? [models] : []) : models.slice();
      var id, model, attrs, existing, sort;
      var at = options.at;
      if (at != null) at = +at;
      if (at < 0) at += this.length + 1;
      var sortable = this.comparator && (at == null) && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;
      var toAdd = [], toRemove = [], modelMap = {};
      var add = options.add, merge = options.merge, remove = options.remove;
      var order = !sortable && add && remove ? [] : false;
      var orderChanged = false;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      for (var i = 0; i < models.length; i++) {
        attrs = models[i];

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        if (existing = this.get(attrs)) {
          if (remove) modelMap[existing.cid] = true;
          if (merge && attrs !== existing) {
            attrs = this._isModel(attrs) ? attrs.attributes : attrs;
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options);
            if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
          }
          models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(attrs, options);
          if (!model) continue;
          toAdd.push(model);
          this._addReference(model, options);
        }

        // Do not add multiple models with the same `id`.
        model = existing || model;
        if (!model) continue;
        id = this.modelId(model.attributes);
        if (order && (model.isNew() || !modelMap[id])) {
          order.push(model);

          // Check to see if this is actually a new model at this index.
          orderChanged = orderChanged || !this.models[i] || model.cid !== this.models[i].cid;
        }

        modelMap[id] = true;
      }

      // Remove nonexistent models if appropriate.
      if (remove) {
        for (var i = 0; i < this.length; i++) {
          if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
        }
        if (toRemove.length) this._removeModels(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      if (toAdd.length || orderChanged) {
        if (sortable) sort = true;
        this.length += toAdd.length;
        if (at != null) {
          for (var i = 0; i < toAdd.length; i++) {
            this.models.splice(at + i, 0, toAdd[i]);
          }
        } else {
          if (order) this.models.length = 0;
          var orderedModels = order || toAdd;
          for (var i = 0; i < orderedModels.length; i++) {
            this.models.push(orderedModels[i]);
          }
        }
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort events.
      if (!options.silent) {
        var addOpts = at != null ? _.clone(options) : options;
        for (var i = 0; i < toAdd.length; i++) {
          if (at != null) addOpts.index = at + i;
          (model = toAdd[i]).trigger('add', model, this, addOpts);
        }
        if (sort || orderChanged) this.trigger('sort', this, options);
        if (toAdd.length || toRemove.length) this.trigger('update', this, options);
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function(models, options) {
      options = options ? _.clone(options) : {};
      for (var i = 0; i < this.models.length; i++) {
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      return this.remove(model, options);
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      return this.remove(model, options);
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id.
    get: function(obj) {
      if (obj == null) return void 0;
      var id = this.modelId(this._isModel(obj) ? obj.attributes : obj);
      return this._byId[obj] || this._byId[id] || this._byId[obj.cid];
    },

    // Get the model at the given index.
    at: function(index) {
      if (index < 0) index += this.length;
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function(attrs, first) {
      var matches = _.matches(attrs);
      return this[first ? 'find' : 'filter'](function(model) {
        return matches(model.attributes);
      });
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      // Run sort based on type of `comparator`.
      if (_.isString(this.comparator) || this.comparator.length === 1) {
        this.models = this.sortBy(this.comparator, this);
      } else {
        this.models.sort(_.bind(this.comparator, this));
      }

      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return _.invoke(this.models, 'get', attr);
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success.call(options.context, collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      var wait = options.wait;
      model = this._prepareModel(model, options);
      if (!model) return false;
      if (!wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(model, resp, callbackOpts) {
        if (wait) collection.add(model, callbackOpts);
        if (success) success.call(callbackOpts.context, model, resp, callbackOpts);
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models, {
        model: this.model,
        comparator: this.comparator
      });
    },

    // Define how to uniquely identify models in the collection.
    modelId: function (attrs) {
      return attrs[this.model.prototype.idAttribute || 'id'];
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function() {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function(attrs, options) {
      if (this._isModel(attrs)) {
        if (!attrs.collection) attrs.collection = this;
        return attrs;
      }
      options = options ? _.clone(options) : {};
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // Internal method called by both remove and set.
    // Returns removed models, or false if nothing is removed.
    _removeModels: function(models, options) {
      var removed = [];
      for (var i = 0; i < models.length; i++) {
        var model = this.get(models[i]);
        if (!model) continue;

        var index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;

        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }

        removed.push(model);
        this._removeReference(model, options);
      }
      return removed.length ? removed : false;
    },

    // Method for checking whether an object should be considered a model for
    // the purposes of adding to the collection.
    _isModel: function (model) {
      return model instanceof Model;
    },

    // Internal method to create a model's ties to a collection.
    _addReference: function(model, options) {
      this._byId[model.cid] = model;
      var id = this.modelId(model.attributes);
      if (id != null) this._byId[id] = model;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function(model, options) {
      delete this._byId[model.cid];
      var id = this.modelId(model.attributes);
      if (id != null) delete this._byId[id];
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') this.remove(model, options);
      if (event === 'change') {
        var prevId = this.modelId(model.previousAttributes());
        var id = this.modelId(model.attributes);
        if (prevId !== id) {
          if (prevId != null) delete this._byId[prevId];
          if (id != null) this._byId[id] = model;
        }
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var collectionMethods = { forEach: 3, each: 3, map: 3, collect: 3, reduce: 4,
      foldl: 4, inject: 4, reduceRight: 4, foldr: 4, find: 3, detect: 3, filter: 3,
      select: 3, reject: 3, every: 3, all: 3, some: 3, any: 3, include: 2,
      contains: 2, invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
      head: 3, take: 3, initial: 3, rest: 3, tail: 3, drop: 3, last: 3,
      without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
      isEmpty: 1, chain: 1, sample: 3, partition: 3 };

  // Mix in each Underscore method as a proxy to `Collection#models`.
  addUnderscoreMethods(Collection, collectionMethods, 'models');

  // Underscore methods that take a property name as an argument.
  var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];

  // Use attributes instead of properties.
  _.each(attributeMethods, function(method) {
    if (!_[method]) return;
    Collection.prototype[method] = function(value, context) {
      var iterator = _.isFunction(value) ? value : function(model) {
        return model.get(value);
      };
      return _[method](this.models, iterator, context);
    };
  });

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be merged as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this._removeElement();
      this.stopListening();
      return this;
    },

    // Remove this view's element from the document and all event listeners
    // attached to it. Exposed for subclasses using an alternative DOM
    // manipulation API.
    _removeElement: function() {
      this.$el.remove();
    },

    // Change the view's element (`this.el` property) and re-delegate the
    // view's events on the new element.
    setElement: function(element) {
      this.undelegateEvents();
      this._setElement(element);
      this.delegateEvents();
      return this;
    },

    // Creates the `this.el` and `this.$el` references for this view using the
    // given `el`. `el` can be a CSS selector or an HTML string, a jQuery
    // context or an element. Subclasses can override this to utilize an
    // alternative DOM manipulation API and are only required to set the
    // `this.el` property.
    _setElement: function(el) {
      this.$el = el instanceof Backbone.$ ? el : Backbone.$(el);
      this.el = this.$el[0];
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    delegateEvents: function(events) {
      events || (events = _.result(this, 'events'));
      if (!events) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[method];
        if (!method) continue;
        var match = key.match(delegateEventSplitter);
        this.delegate(match[1], match[2], _.bind(method, this));
      }
      return this;
    },

    // Add a single event listener to the view's element (or a child element
    // using `selector`). This only works for delegate-able events: not `focus`,
    // `blur`, and not `change`, `submit`, and `reset` in Internet Explorer.
    delegate: function(eventName, selector, listener) {
      this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Clears all callbacks previously bound to the view by `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      if (this.$el) this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // A finer-grained `undelegateEvents` for removing a single delegated event.
    // `selector` and `listener` are both optional.
    undelegate: function(eventName, selector, listener) {
      this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Produces a DOM element to be assigned to your view. Exposed for
    // subclasses using an alternative DOM manipulation API.
    _createElement: function(tagName) {
      return document.createElement(tagName);
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        this.setElement(this._createElement(_.result(this, 'tagName')));
        this._setAttributes(attrs);
      } else {
        this.setElement(_.result(this, 'el'));
      }
    },

    // Set attributes from a hash on this view's element.  Exposed for
    // subclasses using an alternative DOM manipulation API.
    _setAttributes: function(attributes) {
      this.$el.attr(attributes);
    }

  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // Pass along `textStatus` and `errorThrown` from jQuery.
    var error = options.error;
    options.error = function(xhr, textStatus, errorThrown) {
      options.textStatus = textStatus;
      options.errorThrown = errorThrown;
      if (error) error.call(options.context, xhr, textStatus, errorThrown);
    };

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch':  'PATCH',
    'delete': 'DELETE',
    'read':   'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        if (router.execute(callback, args, name) !== false) {
          router.trigger.apply(router, ['route:' + name].concat(args));
          router.trigger('route', name, args);
          Backbone.history.trigger('route', router, name, args);
        }
      });
      return this;
    },

    // Execute a route handler with the provided parameters.  This is an
    // excellent place to do pre-route setup or post-route cleanup.
    execute: function(callback, args, name) {
      if (callback) callback.apply(this, args);
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
                   .replace(optionalParam, '(?:$1)?')
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^/?]+)';
                   })
                   .replace(splatParam, '([^?]*?)');
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    _.bindAll(this, 'checkUrl');

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for stripping urls of hash.
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Are we at the app root?
    atRoot: function() {
      var path = this.location.pathname.replace(/[^\/]$/, '$&/');
      return path === this.root && !this.getSearch();
    },

    // Does the pathname match the root?
    matchRoot: function() {
      var path = this.decodeFragment(this.location.pathname);
      var root = path.slice(0, this.root.length - 1) + '/';
      return root === this.root;
    },

    // Unicode characters in `location.pathname` are percent encoded so they're
    // decoded for comparison. `%25` should not be decoded since it may be part
    // of an encoded parameter.
    decodeFragment: function(fragment) {
      return decodeURI(fragment.replace(/%25/g, '%2525'));
    },

    // In IE6, the hash fragment and search params are incorrect if the
    // fragment contains `?`.
    getSearch: function() {
      var match = this.location.href.replace(/#.*/, '').match(/\?.+/);
      return match ? match[0] : '';
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the pathname and search params, without the root.
    getPath: function() {
      var path = this.decodeFragment(
        this.location.pathname + this.getSearch()
      ).slice(this.root.length - 1);
      return path.charAt(0) === '/' ? path.slice(1) : path;
    },

    // Get the cross-browser normalized URL fragment from the path or hash.
    getFragment: function(fragment) {
      if (fragment == null) {
        if (this._usePushState || !this._wantsHashChange) {
          fragment = this.getPath();
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error('Backbone.history has already been started');
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._hasHashChange   = 'onhashchange' in window;
      this._useHashChange   = this._wantsHashChange && this._hasHashChange;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.history && this.history.pushState);
      this._usePushState    = this._wantsPushState && this._hasPushState;
      this.fragment         = this.getFragment();

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !this.atRoot()) {
          var root = this.root.slice(0, -1) || '/';
          this.location.replace(root + '#' + this.getPath());
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot()) {
          this.navigate(this.getHash(), {replace: true});
        }

      }

      // Proxy an iframe to handle location events if the browser doesn't
      // support the `hashchange` event, HTML5 history, or the user wants
      // `hashChange` but not `pushState`.
      if (!this._hasHashChange && this._wantsHashChange && !this._usePushState) {
        this.iframe = document.createElement('iframe');
        this.iframe.src = 'javascript:0';
        this.iframe.style.display = 'none';
        this.iframe.tabIndex = -1;
        var body = document.body;
        // Using `appendChild` will throw on IE < 9 if the document is not ready.
        var iWindow = body.insertBefore(this.iframe, body.firstChild).contentWindow;
        iWindow.document.open();
        iWindow.document.close();
        iWindow.location.hash = '#' + this.fragment;
      }

      // Add a cross-platform `addEventListener` shim for older browsers.
      var addEventListener = window.addEventListener || function (eventName, listener) {
        return attachEvent('on' + eventName, listener);
      };

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._usePushState) {
        addEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        addEventListener('hashchange', this.checkUrl, false);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      // Add a cross-platform `removeEventListener` shim for older browsers.
      var removeEventListener = window.removeEventListener || function (eventName, listener) {
        return detachEvent('on' + eventName, listener);
      };

      // Remove window listeners.
      if (this._usePushState) {
        removeEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        removeEventListener('hashchange', this.checkUrl, false);
      }

      // Clean up the iframe if necessary.
      if (this.iframe) {
        document.body.removeChild(this.iframe);
        this.iframe = null;
      }

      // Some environments will throw when clearing an undefined interval.
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();

      // If the user pressed the back button, the iframe's hash will have
      // changed and we should use that for comparison.
      if (current === this.fragment && this.iframe) {
        current = this.getHash(this.iframe.contentWindow);
      }

      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragment) {
      // If the root doesn't match, no routes can match either.
      if (!this.matchRoot()) return false;
      fragment = this.fragment = this.getFragment(fragment);
      return _.any(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};

      // Normalize the fragment.
      fragment = this.getFragment(fragment || '');

      // Don't include a trailing slash on the root.
      var root = this.root;
      if (fragment === '' || fragment.charAt(0) === '?') {
        root = root.slice(0, -1) || '/';
      }
      var url = root + fragment;

      // Strip the hash and decode for matching.
      fragment = this.decodeFragment(fragment.replace(pathStripper, ''));

      if (this.fragment === fragment) return;
      this.fragment = fragment;

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._usePushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && (fragment !== this.getHash(this.iframe.contentWindow))) {
          var iWindow = this.iframe.contentWindow;

          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if (!options.replace) {
            iWindow.document.open();
            iWindow.document.close();
          }

          this._updateHash(iWindow.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent` constructor function.
    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error.call(options.context, model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  return Backbone;

}));

/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
*/

/*	
	$o.events:
		showPage // tab opened
		objectChanged // object changed
		viewInit
*/

/*
	Global variables
*/
$sessionId = undefined;
$userId = undefined;

/*
window.onerror = function (msg, url, lineNumber) {
	console.log ("window.onerror", msg, url, lineNumber);
	alert ("Ошибка: " + msg + "\nurl: " + url + "\nline: " + lineNumber);
	return true;
};

Ext.Error.handle = function (err) {
	console.log ("Ext.error.handle", err);
	common.message ("Ошибка: " + JSON.stringify (err));
	return true;
};
*/

//Ext.error.raise ("bad request");
/*
	Objectum storage
*/
Ext.define ("$o", {
	singleton: true,
	mixins: {
		observable: 'Ext.util.Observable'
	},	
	code: null,
	currentUser: null,
	// objects cache
	objectsMap: {},
	// actions cache
	actionsMap: {},
	constructor: function (config) {
		this.mixins.observable.constructor.call (this, config);
		this.addEvents (
			"afterCreateObject",
			"beforeCommitObject",
			"beforeRemoveObject"
		);
	},
	load: function (options) {
		var me = this;
		var success = options.success;
		var scope = options.scope;
		me.initModels ();
		me.initStores ({success: function (options) {
			me.initClasses (options);
			me.initClassAttrs (options);
			me.initViews (options);
			me.initViewAttrs (options);
			me.initClassModels ();
			success.call (scope || me, options);
		}});
	},
	/*
		login,
		password, // SHA-1
		success
	*/
	init: function (options) {
		if (!options) {
			throw new Error ("$o.init must have options: {success}");
		};
		var me = this;
		me.code = options.code;
		var mainOptions = options;
		var failure = options.failure;
		var scope = options.scope;
		if (me.authorized) {
			me.load (options);
		} else {
			me.authorize (Ext.apply (options, {success: function (options) {
				me.load (options);
			}, failure: function (options) {
				if (failure) {
					failure.call (scope || me, options);
				};
			}}));
		};
	},
	/*
		login
		password // SHA-1
	*/
	authorize: function (options) {
		var mainOptions = options;
		Ext.Ajax.request ({
			url: "?authorize=1",
//			params: options.login + "\n" + options.password + "\n" + options.passwordPlain,
			params: JSON.stringify ({username: options.login, password: options.password}),
			success: function (response, options) {
				/*
				if (!response.responseText) {
					if (mainOptions.failure) {
						mainOptions.failure.call (mainOptions.scope || this, "Authentication error");
					};
					return;
				};
				if (response.responseText.substr (0, 4) == "wait") {
					if (mainOptions.failure) {
						var secs = response.responseText.split (" ")[1];
						mainOptions.failure.call (mainOptions.scope || this, $o.getString ("Wait") + " " + (secs / 60 | 0) + $o.getString (" ", "min", "and", "try again"));
					};
					return;
				};
				if (response.responseText == "no free slots") {
					if (mainOptions.failure) {
						mainOptions.failure.call (mainOptions.scope || this, "no free slots");
					};
					return;
				};
				if (response.responseText == "user in system") {
					if (mainOptions.failure) {
						mainOptions.failure.call (mainOptions.scope || this, "user in system");
					};
					return;
				};
				if (response.responseText == "firewall denied") {
					if (mainOptions.failure) {
						mainOptions.failure.call (mainOptions.scope || this, $o.getString ("Access denied"));
					};
					return;
				};
				var tokens = response.responseText.split (" ");
				var sessionId = tokens [0];
				var userId = tokens [1];
				if (userId == "null") {
					userId = null;
				};
				this.sessionId = $sessionId = sessionId;
				this.userId = $userId = userId;
				this.authorized = true;
				this.currentUser = mainOptions.login;
				if (this.currentUser != "autologin") {
					$o.util.setCookie ("sessionId", sessionId);
				};
				if (tokens.length > 2 && tokens [2] == 3) {
					$o.serverVersion = 3;
				} else {
					$o.serverVersion = 2;
				};
				if (tokens.length > 4) {
					$o.roleId = tokens [3] == "null" ? null : tokens [3];
					$o.menuId = tokens [4] == "null" ? null : tokens [4];
				};
				*/
				var opts = JSON.parse (response.responseText);
				if (!opts || opts.error) {
					if (mainOptions.failure) {
						mainOptions.failure.call (mainOptions.scope || this, opts.error);
					};
					return;
				};
				if (opts.wait) {
					if (mainOptions.failure) {
						mainOptions.failure.call (mainOptions.scope || this, $o.getString ("Wait") + " " + (opts.wait / 60 | 0) + $o.getString (" ", "min", "and", "try again"));
					};
					return;
				};
				$o.serverVersion = 3;
				this.sessionId = $sessionId = opts.sessionId;
				this.userId = $userId = opts.userId;
				this.authorized = true;
				this.currentUser = mainOptions.login;
				if (this.currentUser != "autologin") {
					$o.util.setCookie ("sessionId", $sessionId);
				};
				$o.roleId = opts.roleId;
				$o.menuId = opts.menuId;
				$o.idleTimer = 0;
				var userAction = function () {
					$o.idleTimer = 0;
				};
				if (this.currentUser != "autologin") {
					var timerIntervalId = setInterval (function () {
						$o.idleTimer += 1;
						$o.maxIdleSec = $o.maxIdleSec || (60 * 30);
						if ($o.idleTimer > $o.maxIdleSec) {
							clearInterval (timerIntervalId);
							$o.logout ({success: function () {
								Ext.Msg.alert ($ptitle, $o.getString ('Session disabled'), function () {
									location.reload ();
								});						
							}});
						};
					}, 1000);
				};
				document.addEventListener ("mousemove", userAction, false);
				document.addEventListener ("click", userAction, false);
				document.addEventListener ("scroll", userAction, false);				
				mainOptions.success.call (mainOptions.scope || this, Ext.apply (mainOptions, {
					sessionId: $sessionId,
					userId: $userId
				}));
			},
			failure: function (response, options) {
				if (mainOptions.failure) {
					var opts, err;
					try {
						opts = JSON.parse (response.responseText);
						err = opts.error;
					} catch (e) {
					};
					if (!response.responseText) {
						err = "Server error";
					};
					mainOptions.failure.call (mainOptions.scope || this, err || "Authentication error");
				};
			},
			scope: this
			//timeout: 30000
		});
	},
	/*
		Выход из системы
	*/
	logout: function (options) {
		var me = this;
		options = options || {};
		var success = options.success;
		var failure = options.failure;
		function go () {
			Ext.Ajax.request ({
				url: "?logout=1&sessionId=" + me.sessionId,
				params: me.sessionId,
				success: function (response, options) {
					if (success) {
						success ();
					};
				},
				failure: function () {
					if (failure) {
						failure ();
					};
				},
				scope: me
				//timeout: 30000
			});
		}
		if ($o.util.getCookie ("esiaAuth")) {
			$o.util.setCookie ("esiaAuth", "", "/");
			var w = window.open ("https://esia-portal1.test.gosuslugi.ru/profile/user/saml/Logout");
			setTimeout (function () {
				w.close ();
				window.open ("https://esia-portal1.test.gosuslugi.ru/profile/user/saml/Logout");
				go ();
			}, 3000);
		} else {
			go ();
		}
	},
	initModels: function () {
		var storage = this;
		Ext.define ("$o.Base.Model", {
		    extend: "Ext.data.Model",
			constructor: function (config) {
				var me = this;
				me.callParent (arguments);
			    me.remove = function () {
			    	me.removed = true;
			    };
			},		    
		    sync: function () {
		    	var me = this;
		    	if (me.removed) {
					var r = Ext.Ajax.request ({
						async: false,
						url: "?sessionId=" + $sessionId,
						params: storage.code + "." + me.tableName + ".remove(" + me.get ("id") + ")"
					});
					var store;
					if (me.tableName == "Class") {
						store = storage.store.classes;
					};
					if (me.tableName == "ClassAttr") {
						store = storage.store.classAttrs;
					};
					if (me.tableName == "View") {
						store = storage.store.views;
					};
					if (me.tableName == "ViewAttr") {
						store = storage.store.viewAttrs;
					};
					if (me.tableName == "Action") {
						delete storage.actionsMap [me.get ("id")];
						return;
					};
					var rec = store.findRecord ("id", me.get ("id"), 0, false, false, true);
					store.remove (rec);
					if (me.tableName == "Class" || me.tableName == "ClassAttr") {
						storage.initClasses ();
						storage.initClassAttrs ();
						storage.initClassModels ();
					};
					if (me.tableName == "View" || me.tableName == "ViewAttr") {
						storage.initViews ();
						storage.initViewAttrs ();
					};
					return;
		    	};
		    	var values = [];
				for (var i = 0; i < me.fieldsArray.length; i ++) {
					values.push (Ext.encode (me.get (me.fieldsArray [i]) || null));
				};
				if (me.get ("id")) {
					var valuesStr = values.join (",");
					if (me.tableName != "Action") {
						valuesStr = valuesStr.split ("false").join ("0").split ("true").join ("1");
					};
					var r = Ext.Ajax.request ({
						async: false,
						url: "?sessionId=" + $sessionId,
						params: storage.code + "." + me.tableName + ".set(" + valuesStr + ")"
					});
				} else {
					values.splice (0, 1);
					var valuesStr = values.join (",");
					if (me.tableName != "Action") {
						valuesStr = valuesStr.split ("false").join ("0").split ("true").join ("1");
					};
					var r = Ext.Ajax.request ({
						async: false,
						url: "?sessionId=" + $sessionId,
						params: storage.code + "." + me.tableName + ".create(" + valuesStr + ")"
					});
					storage.checkException (r);
					var o = eval ("(" + r.responseText + ")");
					me.set ("id", o.data [0][0]);
					if (me.tableName == "Class") {
						storage.store.classes.add (me);
					};
					if (me.tableName == "ClassAttr") {
						storage.store.classAttrs.add (me);
					};
					if (me.tableName == "View") {
						storage.store.views.add (me);
					};
					if (me.tableName == "ViewAttr") {
						storage.store.viewAttrs.add (me);
					};
				};
				if (me.tableName == "Class") {
					storage.initClass (me);
				};
				if (me.tableName == "ClassAttr") {
					storage.initClassAttr (me);
					if (me.get ("class")) {
						var cls = $o.getClass (me.get ("class"));
						if (cls) {
							storage.initClass (cls);
						}
					}
				};
				if (me.tableName == "View") {
					storage.initView (me);
				};
				if (me.tableName == "ViewAttr") {
					storage.initViewAttr (me);
				};
		    },
		    toString: function () {
		    	var me = this;
		    	var code = me.get ("code");
		    	if (me.getFullCode) {
		    		code = me.getFullCode ();
		    	};
		    	var r;
		    	if (me.tableName == "Action") {
		    		r = me.get ("name") + " (" + code + ":" + me.get ("id") + ")" + (
		    			me.get ("class") ? (", " + $o.getString ("Class") + ": " + $o.getClass (me.get ("class")).toString ()) : ""
		    		);
		    	} else {
		    		r = me.get ("name") + " (" + code + ":" + me.get ("id") + ")";
		    	};
		    	return r;
		    }
		});
		Ext.define ("$o.Class.Model", {
		    extend: "$o.Base.Model",
		    idProperty: "id",
		    fields: [{
				name: "id", type: "number"
			}, {	
				name: "parent", type: "number", useNull: true
			}, {
				name: "name", type: "string", useNull: true
			}, {
				name: "code", type: "string", useNull: true
			}, {
				name: "description", type: "string", useNull: true
			}, {
				name: "format", type: "string", useNull: true
			}, {
				name: "view", type: "number", useNull: true
			}, {
				name: "type", type: "number", useNull: true
			}, {
				name: "system", type: "number", useNull: true
		    }],
		    tableName: "Class",
		    fieldsArray: [
				"id", "parent", "name", "code", "description", "format", "view", "type", "system"
		    ],
		    getFullCode: function () {
		    	var code = "";
		    	if (this.get ("parent")) {
		    		code = $o.classesMap [this.get ("parent")].getFullCode ();
		    	};
		    	if (code) {
		    		code += ".";
		    	};
		    	code += this.get ("code");
		    	return code;
		    },
		    getPath: function () {
		    	return this.getFullCode ();
		    },
		    updateDefault: function () {
		    	storage.updateDefaultView.call (this);
		    	storage.updateDefaultActions.call (this);
		    },
		    hasAttrInHierarchy: function (attr) {
		    	var me = this;
		    	function has (cls, attr) {
		    		if (cls.attrs [attr]) {
		    			return $o.getClass (cls.attrs [attr].get ("class"));
		    		} else {
		    			for (var i = 0; i < cls.childs.length; i ++) {
		    				var r = has ($o.getClass (cls.childs [i]), attr);
		    				if (r) {
		    					return r;
		    				};
		    			};
		    		};
		    		return 0;
		    	};
		    	var r = has (me, attr);
		    	return r;
		    }
		});
		Ext.define ("$o.ClassAttr.Model", {
		    extend: "$o.Base.Model",
		    idProperty: "id",
		    fields: [{
				name: "id", type: "number"
			}, {
				name: "class", type: "number", useNull: true
			}, {
				name: "name", type: "string", useNull: true
			}, {
				name: "code", type: "string", useNull: true
			}, {
				name: "type", type: "number", useNull: true
			}, {
				name: "order", type: "number", useNull: true
			}, {
				name: "notNull", type: "bool", useNull: true
			}, {
				name: "validFunc", type: "string", useNull: true
			}, {
				name: "formatFunc", type: "string", useNull: true
			}, {
				name: "description", type: "string", useNull: true
			}, {
				name: "secure", type: "bool", useNull: true
			}, {
				name: "maxString", type: "number", useNull: true
			}, {
				name: "minString", type: "number", useNull: true
			}, {
				name: "maxNumber", type: "number", useNull: true
			}, {
				name: "minNumber", type: "number", useNull: true
			}, {
				name: "maxDate", type: "date", useNull: true
			}, {
				name: "minDate", type: "date", useNull: true
			}, {
				name: "unique", type: "bool", useNull: true
			}, {
				name: "numberFormat", type: "string", useNull: true
			}, {
				name: "dateFormat", type: "string", useNull: true
			}, {
				name: "removeRule", type: "string", useNull: true
		    }],
		    tableName: "ClassAttr",
		    fieldsArray: [
				"id", "class", "name", "code", "type", "order", "notNull", "validFunc", "formatFunc", "description", "secure", "maxString", "minString", "maxNumber", "minNumber", "maxDate", "minDate", "unique", "numberFormat", "dateFormat", "removeRule"
		    ],
			getDataType: function () {
				var r;
				switch (this.get ("type")) {
				case 1: // string
				case 5: // file
					r = "string";
					break;
				case 2: // number
					r = "number";
					break;
				case 3: // timestamp
					r = "date";
					break;
				case 4: // bool
					r = "bool";
					break;
				case 6: // class
				case 7: // classAttr
				case 8: // view
				case 9: // viewAttr
					r = "number";
					break;
				default:
					r = "number";
				};
				return r;
			},
			getFieldType: function () {
				var dt = this.getDataType ();
				var r = "numberfield";
				if (dt == "string") {
					r = "textfield";
				};
				if (dt == "date") {
					r = "datefield";
				};
				if (dt == "bool") {
					r = "checkbox";
				};
				if (this.get ("type") >= 1000) {
					r = "objectfield";
				};
				if (this.get ("type") == 5) {
					r = "$filefield";
				};
				return r;
			},
			getFilterDataType: function () {
				var r = this.getDataType ();
				if (r == "number") {
					r = "numeric";
				};
				return r;
			},
			getVType: function () {
				var me = this;
				var code;
				if (me.get ("validFunc")) {
					var code = $o.getClass (me.get ("class")).getFullCode () + "." + me.get ("code");
					if (!Ext.form.VTypes [code]) {
						try {
							var vf = eval ("(" + me.get ("validFunc") + ")");
							var o = {};
							o [code] = vf.fn;
							o [code + "Text"] = typeof (vf.description) == "function" ? eval ("(" + vf.description + ")") : vf.description;
							Ext.apply (Ext.form.VTypes, o);
						} catch (e) {
						};
					};
				};
				return code;
			}
		});
		Ext.define ("$o.View.Model", {
		    extend: "$o.Base.Model",
		    idProperty: "id",
		    fields: [{
				name: "id", type: "number"
			}, {
				name: "parent", type: "number", useNull: true
			}, {
				name: "name", type: "string", useNull: true
			}, {
				name: "code", type: "string", useNull: true
			}, {
				name: "description", type: "string", useNull: true
			}, {
				name: "layout", type: "string", useNull: true
			}, {
				name: "key", type: "string", useNull: true
			}, {
				name: "parentKey", type: "number", useNull: true
			}, {
				name: "class", type: "number", useNull: true
			}, {
				name: "unrelated", type: "string", useNull: true
			}, {
				name: "query", type: "string", useNull: true
			}, {
				name: "type", type: "bool", useNull: true
			}, {
				name: "system", type: "bool", useNull: true
			}, {
				name: "materialized", type: "bool", useNull: true
			}, {
				name: "order", type: "number", useNull: true
			}, {
				name: "iconCls", type: "string", useNull: true
		    }],
		    tableName: "View",
		    fieldsArray: [
		    	"id", "parent", "name", "code", "description", "layout", "key", "parentKey", "class", "unrelated", "query", "type", "system", "materialized", "order", "iconCls"
		    ],
		    getFullCode: function () {
		    	var code = "";
		    	if (this.get ("parent")) {
		    		code = $o.viewsMap [this.get ("parent")].getFullCode ();
		    	};
		    	if (code) {
		    		code += ".";
		    	};
		    	code += this.get ("code");
		    	return code;
		    },
		    getPath: function () {
		    	return this.getFullCode ();
		    }
		});
		Ext.define ("$o.ViewAttr.Model", {
		    extend: "$o.Base.Model",
		    idProperty: "id",
		    fields: [{
				name: "id", type: "number"
			}, {
				name: "view", type: "number", useNull: true
			}, {
				name: "name", type: "string", useNull: true
			}, {
				name: "code", type: "string", useNull: true
			}, {
				name: "class", type: "number", useNull: true
			}, {
				name: "classAttr", type: "number", useNull: true
			}, {
				name: "subject", type: "number", useNull: true
			}, {
				name: "order", type: "number", useNull: true
			}, {
				name: "sort", type: "number", useNull: true
			}, {
				name: "sortOrder", type: "number", useNull: true
			}, {
				name: "operation", type: "number", useNull: true
			}, {
				name: "value", type: "string", useNull: true
			}, {
				name: "area", type: "bool", useNull: true
			}, {
				name: "width", type: "number", useNull: true
			}, {
				name: "totalType", type: "number", useNull: true
			}, {
				name: "readOnly", type: "bool", useNull: true
			}, {
				name: "group", type: "bool", useNull: true
			}, {
				name: "notNull", type: "bool", useNull: true
		    }],
		    tableName: "ViewAttr",
			fieldsArray: [
				"id", "view", "name", "code", "class", "classAttr", "subject", "order", "sort", "sortOrder", "operation", "value", "area", "width", "totalType", "readOnly", "group", "notNull"
			]
		});
		Ext.define ("$o.Action.Model", {
		    extend: "$o.Base.Model",
		    idProperty: "id",
		    fields: [{
				name: "id", type: "number"
			}, {
				name: "class", type: "number", useNull: true
			}, {
				name: "name", type: "string", useNull: true
			}, {
				name: "code", type: "string", useNull: true
			}, {
				name: "description", type: "string", useNull: true
			}, {
				name: "body", type: "string", useNull: true
			}, {
				name: "layout", type: "string", useNull: true
		    }],
		    tableName: "Action",
		    fieldsArray: [
				"id", "class", "name", "code", "description", "order", "body", "layout"
		    ],
			initAction: function () {
				var actionId = this.get ("id");
				var a = $o.getAction (actionId);
				var cls = $o.getClass (a.get ("class"));
				var fName = cls.getFullCode () + "." + a.get ("code");
				Ext.namespace (fName);
				var f = 
					fName + " = function (options) {\n" +
					a.get ("body") +
					"};\n"
				;
				var l;
				try {
					l = JSON.parse (a.get ("layout"));
				} catch (e) {
				};
				if (l && l.serverAction) {
					return;
				};
				try {
					eval (f);
				} catch (e) {
				};
				if (l && l.layout) {
					var fl = 
						fName + ".layout = " +
						JSON.stringify (l.layout, null, "\t") +
						";\n"
					;
					try {
						eval (fl);
					} catch (e) {
					};
				};
				if (!common.getConf ("projectNeedBuild").used) {
					common.setConf ("projectNeedBuild", {used: 1});
				};
			},
			getFullCode: function () {
				var cls = $o.getClass (this.get ("class"));
				var fn = (cls ? (cls.getFullCode () + ".") : "") + this.get ("code");
				return fn;
			},
		    getPath: function () {
		    	return this.getFullCode ();
		    },
			execute: function (options) {
				var fn_ = eval (this.getFullCode ());
				if (typeof (fn_) == "function") {
					fn_ (options);
				};
			}
		});
	},
	initStores: function (options) {
		var me = this;
		var mainOptions = options;
		Ext.define ("$o.Class.Store", {
			extend: "Ext.data.Store",
			model: "$o.Class.Model"
		});
		Ext.define ("$o.ClassAttr.Store", {
			extend: "Ext.data.Store",
			model: "$o.ClassAttr.Model"
		});
		Ext.define ("$o.View.Store", {
			extend: "Ext.data.Store",
			model: "$o.View.Model"
		});
		Ext.define ("$o.ViewAttr.Store", {
			extend: "Ext.data.Store",
			model: "$o.ViewAttr.Model"
		});
		me.store = {
			classes: Ext.create ("$o.Class.Store"),
			classAttrs: Ext.create ("$o.ClassAttr.Store"),
			views: Ext.create ("$o.View.Store"),
			viewAttrs: Ext.create ("$o.ViewAttr.Store")
		};
		if ($o.serverVersion == 3) {
			Ext.Ajax.request ({
				url: "?sessionId=" + me.sessionId,
				params: me.code + ".Storage.getAll(\"\")",
				success: function (response, options) {
					var d = eval ("(" + response.responseText + ")");
					me.store.classes.loadData (d.classes);
					me.store.classAttrs.loadData (d.classAttrs);
					me.store.views.loadData (d.views);
					me.store.viewAttrs.loadData (d.viewAttrs);
					me.visualObjectum = d.visualObjectum || {};
					me.visualObjectum.timeMachine = me.visualObjectum.timeMachine || {};
					me.visualObjectum.logo = me.visualObjectum.logo || {};
					me.data = d;
					mainOptions.data = d;
					mainOptions.success.call (mainOptions.scope || me, mainOptions);
				},
				scope: me
			});
		} else {
			me.data = {};
			mainOptions.data = {};
			async.parallel ([
				function (cb) {
					Ext.Ajax.request ({
						url: "?sessionId=" + me.sessionId + "&username=" + $o.currentUser,
						params: me.code + ".Storage.getClasses(\"\")",
						success: function (response, options) {
							var d = eval ("(" + response.responseText + ")");
							me.store.classes.loadData (d.data);
							me.data.classes = d.data;
							mainOptions.data.classes = d.data;
							cb ();
						},
						scope: me
					});
				},
				function (cb) {
					Ext.Ajax.request ({
						url: "?sessionId=" + me.sessionId + "&username=" + $o.currentUser,
						params: me.code + ".Storage.getClassAttrs(\"\")",
						success: function (response, options) {
							var d = eval ("(" + response.responseText + ")");
							me.store.classAttrs.loadData (d.data);
							me.classAttrs = {};
							me.data.classAttrs = d.data;
							mainOptions.data.classAttrs = d.data;
							cb ();
						},
						scope: me
					});
				},
				function (cb) {
					Ext.Ajax.request ({
						url: "?sessionId=" + me.sessionId + "&username=" + $o.currentUser,
						params: me.code + ".Storage.getViews(\"\")",
						success: function (response, options) {
							var d = eval ("(" + response.responseText + ")");
							me.store.views.loadData (d.data);
							me.data.views = d.data;
							mainOptions.data.views = d.data;
							cb ();
						},
						scope: me
					});
				},
				function (cb) {
					Ext.Ajax.request ({
						url: "?sessionId=" + me.sessionId + "&username=" + $o.currentUser,
						params: me.code + ".Storage.getViewAttrs(\"\")",
						success: function (response, options) {
							var d = eval ("(" + response.responseText + ")");
							me.store.viewAttrs.loadData (d.data);
							me.data.viewAttrs = d.data;
							mainOptions.data.viewAttrs = d.data;
							cb ();
						},
						scope: me
					});
				}
			], function (err, results) {
				mainOptions.success.call (mainOptions.scope || me, mainOptions);
			});
		};
	},
	checkException: function (options) {
		if ($o.app) {
			return; // $o.app.requestcomplete
		};
		var r = eval ("(" + options.responseText + ")");
		if (r && r.header && r.header.error) {
			throw new Error (r.header.error);
		};
	},
	/*
		Инициализация моделей данных для классов
	*/
	initClassModels: function () {
		Ext.define ("$o.Class.Base.Model", {
		    extend: "Ext.data.Model",
		    storage: this,
			/*
				Сохраняет на сервер локальный объект и цепочку зависимых объектов, которые ссылаются на него
			*/
			commitLocal: function () {
				var me = this;
				if (me.local == "child") {
					return;
				};
				me.local = null;
				me.commit ();
				for (var id in me.localChilds) {
					var o = $o.getObject (id);
					if (me.localChilds [id].place == "their") {
						o.set (me.localChilds [id].attr, me.get ("id"));
					};
					o.local = "root";
					o.commitLocal ();
					if (me.localChilds [id].place == "mine") {
						me.set (me.localChilds [id].attr, o.get ("id"));
						me.commit ();
					};
				};
			},
		    commit: function (options) {
		    	if (this.local) {
		    		if (options == "local") {
			    		this.commitLocal ();
		    		};
			    	return;
		    	};
		    	if (this.removed) {
		    		this.storage.removeObject (this.get ("id"));
		    		return;
		    	};
				var changes = {};
				var changedNum = 0;
				for (var i = 0; i < this.fields.getCount (); i ++){
					var attr = this.fields.getAt (i).name;
					if (attr == "id") {
						continue;
					};
					if (!this.data.hasOwnProperty (attr) || 
						(this.data [attr] == this.originalData [attr]) || 
						(this.data [attr] === "" && (!this.originalData.hasOwnProperty (attr) || this.originalData [attr] == null))
					) {
						continue;
					};
					var ca = this.getClassAttr (attr);
					if (ca.getDataType () == "date" && (
							(!this.data [attr] && !this.originalData [attr]) ||
							(this.data [attr] && this.originalData [attr] && this.data [attr].getTime () == this.originalData [attr].getTime ())
						)
					) {
						continue;
					};
					this.originalData [attr] = this.data [attr];
					var v = this.get (attr);
					if (v && typeof (v) == "object" && v.getMonth () && v.getFullYear () == 2000 && v.getMonth () == 1 && v.getDate () == 2 && v.getHours () == 3 && v.getMinutes () == 4 && v.getSeconds () == 5) {
						v = "$CURRENT_TIMESTAMP$";
					};
					if (ca.getDataType () == "bool") {
						v = v ? 1 : 0;
					};
					if (ca.getDataType () == "date" && v && v != "$CURRENT_TIMESTAMP$") {
//						v = v.toUTCString ();
						if (v.getHours () == 0 && v.getMinutes () == 0 && v.getSeconds () == 0) {
							var dd = v.getDate ();
							var mm = v.getMonth () + 1;
							v = v.getFullYear () + "-";
							if (mm < 10) {
								v += "0";
							};
							v += mm + "-";
							if (dd < 10) {
								v += "0";
							};
							v += dd + "T00:00:00.000Z";
						} else {
							v = v.toISOString ();
						};
					};
					changes [attr] = {
						value: v === null ? null : String (v),
						classAttrId: ca.get ("id"),
						type: ca.get ("type"),
						classId: ca.get ("class"),
						classCode: $o.classesMap [ca.get ("class")].get ("code")
					};
					changedNum ++;
				};
				if (changedNum || !this.get ("id") || this.get ("id") < 0) {
					this.storage.fireEvent ("beforeCommitObject", {
						objectId: this.get ("id"), 
						changes: changes
					});
					if (this.get ("id") < 0) {
						this.set ("id", null)
					};
			    	var a = [
			    		this.get ("id"),
			    		changes,
			    		this.get ("classId")
			    	];
					var r = Ext.Ajax.request ({
						async: false,
						url: "?sessionId=" + this.storage.sessionId,
						params: this.storage.code + ".Object.setAttrs([!" + JSON.stringify (a) + "!])"
					});
					this.storage.checkException.call (this.storage, r);
					var o = eval ("(" + r.responseText + ")");
					if (!this.get ("id") || this.get ("id") < 0) {
						if (o.data.id) {
							this.set ("id", o.data.id || o.data);
						};
					};
					for (var a in o.data) {
						if (this.get (a) == '$CURRENT_TIMESTAMP$') {
							this.set (a, new Date (o.data [a]));
						};
					};
				};
		    },
		    sync: function (options) {
		    	this.commit (options);
		    },
		    remove: function () {
				if ($o.isReadOnly ()) {
					common.message ($o.getString ("Can't change data"));
					throw new Error ($o.getString ("Can't change data"));
				};
		    	this.removed = true;
		    },
		    getClassAttr: function (attr) {
		    	var cls = $o.classesMap [this.get ("classId")];
		    	return cls.attrs [attr];
		    },
			toString: function () {
		    	var cls = $o.classesMap [this.get ("classId")];
				var ff = cls.get ('format');
				var r = this.get ('name');
				if (ff) {
					try {
						var fn = eval ("(function () {" + ff + "})");
						r = fn.call (this);
					} catch (e) {
						console.log ("toString exception");
						console.log (this);
					};
				};
				return r;
			},
			set: function (field, value) {
				if (value == "$CURRENT_TIMESTAMP$") {
					value = new Date (2000, 1, 2, 3, 4, 5);
				};
				if (this.getClassAttr (field) && this.getClassAttr (field).get ("type") >= 1000) {
					if (value && value < 0) {
						var o = $o.getObject (value);
						if (this.local == "root") {
							this.localChilds [o.get ("id")] = {attr: field, place: "mine"};
						} else {
							if (!this.get ("id")) {
								this.set ("id", $o.nextLocalId --);
								$o.objectsMap [this.get ("id")] = this;
							};
							o.localChilds [this.get ("id")] = {attr: field, place: "their"};
							this.local = "child";
						};
					} else {
						/* возврат непонятно как делать т.к. несколько атрибутов могут ссылаться на локальные объекты
						if (this.get (field) && this.get (field) < 0) {
							var o = $o.getObject (this.get (field));
							if (o.localChilds.indexOf (this.get ("id")) > -1) {
								o.localChilds.splice (o.localChilds.indexOf (this.get ("id")), 1);
							};
						};
						*/
						//this.local = null; с этой строчкой не работает. Пример: добавление орагнизации, в его карточке добавление адреса. В карточке адреса сохранение типа адреса. В итоге запись с адресом привязывается к <0 id
					};
				};
				this.callParent (arguments);
			},
			getId: function () {
				return this.get ("id");
			}
		});
		for (var i = 0; i < this.store.classes.getCount (); i ++) {
			var o = this.store.classes.getAt (i);
			var fields = [{
				name: "id", type: "number", useNull: true
			}, {
				name: "classId", type: "number", useNull: true
			}];
			for (var attr in o.attrs) {
				var ca = o.attrs [attr];
				fields.push ({
					name: ca.get ("code"),
					type: ca.getDataType (), 
					useNull: true
				});
			};
			Ext.define ("$o.Class." + o.get ("id") + ".Model", {
			    extend: "$o.Class.Base.Model",
			    fields: fields
			});
		};
	},
	initClass: function (o) {
		var me = this;
		o.stub = o;
		o.attrs = o.attrs || {};
		o.attrsArray = o.attrsArray || [];
		o.childs = o.childs || [];
		me.classesMap [o.get ("id")] = o;
		if (o.get ("parent")) {
			me.classesMap [o.get ("parent")].childs.push (o.get ("id"));
		};
		this.classesCode [o.getFullCode ()] = o;
		var tokens = o.getFullCode ().split ('.');
		if (tokens.length == 3) {
			me.classesCode [tokens [0] + '.' + tokens [2]] = me.classesCode [tokens [0] + '.' + tokens [2]] || o;
		};
		if (tokens.length == 4) {
			me.classesCode [tokens [0] + '.' + tokens [3]] = me.classesCode [tokens [0] + '.' + tokens [3]] || o;
		};
		// classAttr
		if (o.get ("parent")) {
			var parent = $o.getClass (o.get ("parent"));
			for (var attr in parent.attrs) {
				o.attrs [attr] = parent.attrs [attr];
				o.attrsArray.push (parent.attrs [attr]);
			};
		};
		// model
		var fields = [{
			name: "id", type: "number", useNull: true
		}, {
			name: "classId", type: "number", useNull: true
		}];
		for (var attr in o.attrs) {
			var ca = o.attrs [attr];
			fields.push ({
				name: ca.get ("code"),
				type: ca.getDataType (), 
				useNull: true
			});
		};
		if (Ext.ClassManager.get ("$o.Class." + o.get ("id") + ".Model")) {
			var _fields = Ext.ClassManager.get ("$o.Class." + o.get ("id") + ".Model").prototype.fields;
			_.each (fields, function (field) {
				if (!_fields.contains ({name: field.name})) {
					_fields.add (field);
				}
			});
		} else {
			Ext.define ("$o.Class." + o.get ("id") + ".Model", {
			    extend: "$o.Class.Base.Model",
			    fields: fields
			});
		}
	},
	/*
		Инициализация классов
	*/
	initClasses: function (options) {
		this.classesMap = this.classesMap || {};
		for (var i = 0; i < this.store.classes.getCount (); i ++) {
			var o = this.store.classes.getAt (i);
			o.stub = o;
			o.childs = [];
			this.classesMap [o.get ("id")] = o;
		};
		this.classesTree = this.classesTree || {};
		this.classesCode = this.classesCode || {};
		var getTree = function (options) {
			for (var i = 0; i < this.store.classes.getCount (); i ++) {
				var o = this.store.classes.getAt (i);
				if (o.get ("parent") == options.parent) {
					if (options.parent) {
						this.classesMap [options.parent].childs.push (o.get ("id"));
					};
					options.node [o.get ("code")] = {id: o.get ("id"), stub: o};
					var code = options.code ? options.code + '.' + o.get ('code') : o.get ('code');
					o.attrs = {};
					o.attrsArray = [];
					this.classesCode [code] = o;
					var tokens = code.split ('.');
					if (tokens.length == 3) {
						this.classesCode [tokens [0] + '.' + tokens [2]] = this.classesCode [tokens [0] + '.' + tokens [2]] || o;
					};
					if (tokens.length == 4) {
						this.classesCode [tokens [0] + '.' + tokens [3]] = this.classesCode [tokens [0] + '.' + tokens [3]] || o;
					};
					getTree.call (this, {node: options.node [o.get ("code")], parent: o.get ("id"), code: code});
				}
			}
		}
		getTree.call (this, {node: this.classesTree, parent: null});
	},
	initClassAttr: function (o) {
		var me = this;
		me.classAttrs [o.get ("id")] = o;
		me.classAttrsMap [o.get ("id")] = o;
		if (me.classesMap [o.get ("class")]) {
			var addClassAttr = function (oClass) {
				oClass.attrs [o.get ('code')] = o;
				oClass.attrsArray.push (o);
				for (var i = 0; i < oClass.childs.length; i ++) {
					addClassAttr (me.classesMap [oClass.childs [i]]);
				}
			};
			addClassAttr (me.classesMap [o.get ("class")]);
		};
	},	
	/*
		Инициализация атрибутов классов
	*/
	initClassAttrs: function (options) {
		var me = this;
		me.classAttrs = me.classAttrs || {};
		for (var i = 0; i < me.store.classAttrs.getCount (); i ++) {
			var ca = me.store.classAttrs.getAt (i);
			me.classAttrs [ca.get ("id")] = ca;
		};
		me.classAttrsMap = me.classAttrsMap || {};
		for (var i = 0; i < me.store.classAttrs.getCount (); i ++) {
			var o = this.store.classAttrs.getAt (i);
			me.classAttrsMap [o.get ("id")] = o;
			if (me.classesMap [o.get ("class")]) {
				var addClassAttr = function (oClass) {
					oClass.attrs = oClass.attrs || {};
					oClass.attrs [o.get ('code')] = o;
					oClass.attrsArray = oClass.attrsArray || [];
					oClass.attrsArray.push (o);
					for (var i = 0; i < oClass.childs.length; i ++) {
						addClassAttr (me.classesMap [oClass.childs [i]]);
					}
				};
				addClassAttr (me.classesMap [o.get ("class")]);
			}
		}
	},	
	initView: function (o) {
		o.stub = o;
		o.attrs = o.attrs || {};
		o.childs = o.childs || [];
		this.viewsMap [o.get ("id")] = o;
		this.viewsCode [o.getFullCode ()] = o;
		var tokens = o.getFullCode ().split ('.');
		if (tokens.length == 3) {
			this.viewsCode [tokens [0] + '.' + tokens [2]] = this.viewsCode [tokens [0] + '.' + tokens [2]] || o;
		};
		if (tokens.length == 4) {
			this.viewsCode [tokens [0] + '.' + tokens [3]] = this.viewsCode [tokens [0] + '.' + tokens [3]] || o;
		};
		if (o.get ("parent")) {
			this.viewsMap [o.get ("parent")].childs.push (o.get ("id"));
		};
	},
	/*
		Инициализация представлений
	*/
	initViews: function (options) {
		this.viewsMap = this.viewsMap || {};
		for (var i = 0; i < this.store.views.getCount (); i ++) {
			var o = this.store.views.getAt (i);
			o.stub = o;
			o.childs = [];
			this.viewsMap [o.get ("id")] = o;
		};
		this.viewsTree = this.viewsTree || {};
		this.viewsCode = this.viewsCode || {};
		var getTree = function (options) {
			for (var i = 0; i < this.store.views.getCount (); i ++) {
				var o = this.store.views.getAt (i);
				if (o.get ("parent") == options.parent) {
					if (options.parent) {
						this.viewsMap [options.parent].childs.push (o.get ("id"));
					};
					options.node [o.get ("code")] = {id: o.get ("id"), stub: o};
					var code = options.code ? options.code + '.' + o.get ('code') : o.get ('code');
					o.attrs = {};
					this.viewsCode [code] = o;
					if (code) {
						var tokens = code.split ('.');
						if (tokens.length == 3) {
							this.viewsCode [tokens [0] + '.' + tokens [2]] = this.viewsCode [tokens [0] + '.' + tokens [2]] || o;
						};
						if (tokens.length == 4) {
							this.viewsCode [tokens [0] + '.' + tokens [3]] = this.viewsCode [tokens [0] + '.' + tokens [3]] || o;
						};
					};
					getTree.call (this, {node: options.node [o.get ("code")], parent: o.get ("id"), code: code});
				}
			}
		}
		getTree.call (this, {node: this.viewsTree, parent: null});
	},
	initViewAttr: function (o) {
		var me = this;
		me.viewAttrsMap [o.get ("id")] = o;
		me.viewsMap [o.get ("view")].attrs [o.get ("code")] = o;
	},
	/*
		Инициализация атрибутов представлений
	*/
	initViewAttrs: function (options) {
		var me = this;
		me.viewAttrsMap = me.viewAttrsMap || {};
		for (var i = 0; i < me.store.viewAttrs.getCount (); i ++) {
			var o = this.store.viewAttrs.getAt (i);
			me.viewAttrsMap [o.get ("id")] = o;
			if (me.viewsMap [o.get ("view")]) {
				me.viewsMap [o.get ("view")].attrs = me.viewsMap [o.get ("view")].attrs || {};
				me.viewsMap [o.get ("view")].attrs [o.get ("code")] = o;
			};
		};
	},
	/*
		Возвращает объект класса по коду или id
	*/
	getClass: function (options) {
		if (!options) {
			return options;
		};
		if (typeof (options) == "number") {
			if (this.classesMap [options]) {
				return this.classesMap [options];
			} else {
				throw new Error ('getClass - Unknown classId: ' + options);
			};
		};
		if (options && options.id) {
			if (this.classesMap [options.id]) {
				return this.classesMap [options.id];
			} else {
				throw new Error ('getClass - Unknown classId: ' + options.id);
			};
		};
		var code = options.classCode || options.code;
		if (typeof (options) == "string") {
			code = options;
		};
		if (this.classesCode [code]) {
			return this.classesCode [code];
		} else {
			throw new Error ('getClass - Unknown classCode: ' + code);
		};
	},
	/*
		Возвращает объект атрибута класса по id
	*/
	getClassAttr: function (id) {
		if (this.classAttrsMap [id]) {
			return this.classAttrsMap [id];
		} else {
			throw new Error ('getClassAttr - Unknown id: ' + id);
		};
	},
	/*
		Возвращает объект представления по коду или id
	*/
	getView: function (options) {
		if (!options) {
			return options;
		};
		if (typeof (options) == "number") {
			if (this.viewsMap [options]) {
				return this.viewsMap [options];
			} else {
				throw new Error ('getView - Unknown viewId: ' + options);
			};
		};
		if (options && options.id) {
			if (this.viewsMap [options.id]) {
				return this.viewsMap [options.id];
			} else {
				throw new Error ('getView - Unknown viewId: ' + options.id);
			};
		};
		var code = options.viewCode || options.code;
		if (typeof (options) == "string") {
			code = options;
		};
		if (this.viewsCode [code]) {
			return this.viewsCode [code];
		} else {
			throw new Error ('getView - Unknown viewCode: ' + code);
		};
	},
	/*
		Возвращает объект атрибута представления по id
	*/
	getViewAttr: function (id) {
		if (this.viewAttrsMap [id]) {
			return this.viewAttrsMap [id];
		} else {
			throw new Error ('getViewAttr - Unknown id: ' + id);
		};
	},
	getAction: function (id) {
		if (!id) {
			return null;
		};
		if (typeof (id) == "string" && id.indexOf (".") > -1) {
			for (var i in this.actionsMap) {
				if (this.actionsMap [i].getFullCode () == id) {
					return this.actionsMap [i];
				};
			};
		};
		if (this.actionsMap [id]) {
			return this.actionsMap [id];
		};
		var storage = this;
		var r = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + $sessionId,
			params: storage.code + ".Action.get(" + (typeof (id) == "string" ? ('"' + id + '"') : id) + ")"
		});
		r = eval ("(" + r.responseText + ")");
		if (!r.data.length) {
			return null;
		};
		var o = Ext.create ("$o.Action.Model");
		for (var i = 0; i < r.data.length; i ++) {
			o.set (o.fieldsArray [i], r.data [i]);
		};
		this.actionsMap [o.get ("id")] = o;
		return o;
	},
	/*
		Получение объекта
	*/
	getObject: function (id) {
		if (!id) {
			return null;
		};
		if (this.objectsMap [id]) {
			return this.objectsMap [id];
		};
		var r = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + this.sessionId,
			params: this.code + ".Storage.getObject(" + id + ")"
		});
		var d = eval ("(" + r.responseText + ")");
		if (d.data.id) {
			var o = Ext.create ("$o.Class." + d.data.classId + ".Model", Ext.apply (d.data.attrs, {
				id: id,
				classId: d.data.classId
			}));
			o.originalData = $o.util.clone (d.data.attrs);
			this.objectsMap [id] = o;
			return o;
		} else {
			return null;
		};
	},
	/*
		Начать транзакцию
	*/
	startTransaction: function (options) {
		var description = options ? options.description : "";
		var tr = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + this.sessionId,
			params: this.code + ".Storage.startTransaction(\"" + description + "\")"
		});
		tr = eval ("(" + tr.responseText + ")").data;
		$o.inTransaction = true;
		return tr;
	},
	/*
		Подтвердить транзакцию
	*/
	commitTransaction: function (tr) {
		Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + this.sessionId,
			params: this.code + ".Storage.commitTransaction(" + (tr || 1) + ")"
		});
		$o.inTransaction = false;
	},	
	/*
		Откатить транзакцию
	*/
	rollbackTransaction: function (tr) {
		Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + this.sessionId,
			params: this.code + ".Storage.rollbackTransaction(" + (tr || 1) + ")"
		});
		$o.inTransaction = false;
	},
	/*
		SQL запрос в хранилище (только select)
		или вызов плагина
	*/
	execute: function (options) {
		options = options || {};
		if (options.fn) {
			Ext.Ajax.request ({
				url: "plugins/?sessionId=" + this.sessionId,
				params: JSON.stringify (options),
				success: function (response, opts) {
					var o = eval ("(" + response.responseText + ")");
					if (options.success) {
						options.success (o);
					};
				},
				failure: function (response, opts) {
					this.checkException (response.responseText);
				}				
			});
		} else {
			var asArray = options.asArray;
			delete options.asArray;
			var sql = options.sql || options.query || options;
			var r = Ext.Ajax.request ({
				async: false,
				url: "?sessionId=" + this.sessionId,
				params: this.code + ".Storage.execute([!" + JSON.stringify (sql) + "!])",
				paramsEncode: false
			});
			if (!options.noException) {
				this.checkException (r);
			};
			var o = eval ("(" + r.responseText + ")");
			if (o.header && o.header.error) {
				return o.header;
			};
			if (asArray) {
				var r = [];
				_.each (o.data, function (arr, i) {
					var row = {};					
					for (var j = 0; j < sql.select.length / 2; j ++) {
						row [sql.select [j * 2 + 1]] = o.data [i][j];
					};
					r.push (row);
				});
				return r;
			} else {
				// Поля в результате запроса по номерам
				o.data.fields = {};
				for (var j = 0; j < sql.select.length / 2; j ++) {
					o.data.fields [sql.select [j * 2 + 1]] = j;
					o.data.fields [j] = j;
				};
				// Функция доступа к результатам запроса
				// row, col - result [row] [col]
				// col - может быть числом или названием атрибута
				o.data.get = function (row, col) {
					var colN = this.fields [col];
					if (colN == null) {
						throw new Error ("result.get: col unknown (row:" + row + ",col:" + col + ")");
					};
					var val = this [row] [colN];
					if (val == undefined) {
						val = null;
					};
					return val;
				};
				return o.data;
			};
		};
	},
	/*
		Сопоставляет атрибуты представления с атрибутами классов
	*/
	updateViewAttrsType: function (options) {
		var view = options.view;
		var query = view.get ("query");
		var va = view.attrs;
		if (!query) {
			return;
		};
		query = eval ("(" + query + ")");
		var attrs = {};
		for (var i = 0; i < query.select.length; i ++) {
			var qs = query.select [i];
			if (typeof (qs) == "object") {
				var alias;
				for (alias in qs) {
					break;
				};
				attrs [query.select [i + 1]] = {
					alias: alias,
					attr: qs [alias]
				};
			};
		};
		var aliasClass = {};
		for (var i = 0; i < query.from.length; i ++) {
			var qf = query.from [i];
			if (typeof (qf) == "object") {
				var alias;
				for (alias in qf) {
					break;
				};
				if (!i || query.from [i - 1] == "left-join" || query.from [i - 1] == "inner-join") {
					aliasClass [alias] = qf [alias];
				};
			};
		};
		for (var code in attrs) {
			var attr = attrs [code];
			var c = $o.getClass ({code: aliasClass [attr.alias]});
			if (va [code]) {
				va [code].set ("class", c.get ("id"));
				va [code].set ("classAttr", 
					(attr.attr == "id" || !c.attrs [attr.attr]) ? null : c.attrs [attr.attr].get ("id")
				);
			};
		};
	},
	createObject: function (classCode, options) {
		if (this.isReadOnly ()) {
			common.message ($o.getString ("Can't change data"));
			throw new Error ($o.getString ("Can't change data"));
		};
		var classId = this.getClass (classCode).get ("id");
		var local = options == "local" ? "root" : null;
		this.nextLocalId = this.nextLocalId || -1;
		var o = Ext.create ("$o.Class." + classId + ".Model", {
			id: local ? this.nextLocalId : null,
			classId: classId
		});
		o.local = local;
		o.localChilds = {};
		o.originalData = {
			classId: classId
		};
		if (local) {
			this.objectsMap [this.nextLocalId] = o;
			this.nextLocalId --;
		};
		this.fireEvent ("afterCreateObject", {
			classId: classId, 
			object: o
		});
		return o;
	},
	removeObject: function (id) {
		if (this.isReadOnly ()) {
			common.message ($o.getString ("Can't change data"));
			throw new Error ($o.getString ("Can't change data"));
		};
		if (id) {
			this.fireEvent ("beforeRemoveObject", {
				objectId: id
			});
			Ext.Ajax.request ({
				async: false,
				url: "?sessionId=" + this.sessionId,
				params: this.code + ".Object.remove(" + id + ")"
			});
			delete this.objectsMap [id];
		};
	},
	createClass: function (options) {
		var me = this;
		var o = Ext.create ("$o.Class.Model");
		for (var attr in options) {
			o.set (attr, options [attr]);
		};
		return o;
	},
	createClassAttr: function (options) {
		var me = this;
		/*
		// send to server
		var fields = ["class", "name", "code", "type", "order", "notNull", "validFunc", "formatFunc", "description", "secure", "maxString", "minString", "maxNumber", "minNumber", "maxDate", "minDate", "unique", "numberFormat", "dateFormat", "removeRule"];
		var values = [];
		for (var i = 0; i < fields.length; i ++) {
			values.push (Ext.encode (options [fields [i]] || null));
		};
		var r = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + me.sessionId,
			params: me.code + ".ClassAttr.create(" + values.join (",") + ")"
		});
		// create client objects
		r = eval ("(" + r.responseText + ")");
		if (r.data) {
			var o = Ext.create ("$o.ClassAttr.Model", r.data [0]);
			me.store.classAttrs.add (o);
			me.initClasses ();
			me.initClassAttrs ();
			me.initClassModels ();
		};
		*/
		var o = Ext.create ("$o.ClassAttr.Model");
		for (var attr in options) {
			var a = attr;
			if (a == "typeId") {
				a = "type";
			};
			if (a == "classId") {
				a = "class";
			};
			o.set (a, options [attr]);
		};
		return o;
	},
	createView: function (options) {
		var me = this;
		/*
		// send to server
		var fields = ["parent", "name", "code", "description", "layout", "key", "parentKey", "class", "unrelated", "query", "type", "system", "materialized", "order", "schema", "record", "iconCls"];
		var values = [];
		for (var i = 0; i < fields.length; i ++) {
			values.push (Ext.encode (options [fields [i]] || null));
		};
		var r = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + me.sessionId,
			params: me.code + ".View.create(" + values.join (",") + ")"
		});
		// create client objects
		r = eval ("(" + r.responseText + ")");
		if (r.data) {
			var o = Ext.create ("$o.View.Model", r.data [0]);
			me.store.views.add (o);
			me.initViews ();
			me.initViewAttrs ();
		};
		*/
		var o = Ext.create ("$o.View.Model");
		for (var attr in options) {
			o.set (attr, options [attr]);
		};
		return o;
	},
	createViewAttr: function (options) {
		var me = this;
		/*
		// send to server
		var fields = ["view", "name", "code", "class", "classAttr", "subject", "order", "sort", "sortOrder", "operation", "value", "area", "width", "totalType", "readOnly", "group", "notNull"];
		var values = [];
		for (var i = 0; i < fields.length; i ++) {
			values.push (Ext.encode (options [fields [i]] || null));
		};
		var r = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + me.sessionId,
			params: me.code + ".ViewAttr.create(" + values.join (",") + ")"
		});
		// create client objects
		r = eval ("(" + r.responseText + ")");
		if (r.data) {
			var o = Ext.create ("$o.ViewAttr.Model", r.data [0]);
			me.store.viewAttrs.add (o);
			me.initViews ();
			me.initViewAttrs ();
		};
		*/
		var o = Ext.create ("$o.ViewAttr.Model");
		for (var attr in options) {
			o.set (attr, options [attr]);
		};
		return o;
	},
	createAction: function (options) {
		var me = this;
		var o = Ext.create ("$o.Action.Model");
		for (var attr in options) {
			o.set (attr, options [attr]);
		};
		return o;
	},
	/*
		Представление по умолчанию
	*/
	updateDefaultView: function () {
		var me = this;
		var v;
		if (me.get ("view")) {
			try {
				v = $o.getView (me.get ("view"));
			} catch (e) {
			};
		};
		if (!v) {
			v = $o.createView ();
			v.set ("class", me.get ("id"));
			v.set ("system", 1);
			v.set ("name", me.get ("name"));
			v.set ("code", "classView." + me.getFullCode ());
			v.sync ();
			me.set ("view", v.get ("id"));
			me.sync ();
		};
		// class attrs -> view attrs
		var npp = 1;
		for (var attr in v.attrs) {
			if (v.attrs [attr].order && v.attrs [attr].order >= npp) {
				npp = v.attrs [attr].order + 1;
			};
		};
		var attrs = ["id"], query = {
			select: [
				{"a": "id"}, "id"
			], 
			from: [
				{"a": me.getFullCode ()}
			],
			order: [
				{"a": "id"}
			]
		};
		if (!v.attrs ["id"]) {
			var va = $o.createViewAttr ({
	    		name: "id",
	    		code: "id",
	    		view: v.get ("id"),
	    		area: 1,
	    		width: 50,
	    		"class": me.get ("id"),
	    		order: npp ++,
	    		classAttr: null
			});
			va.sync ();
		};
		var aliasIdx = 0, aliasStr = "bcdefghijklmnopqrstuvwxyz";
		for (var attr in me.attrs) {
			var ca = me.attrs [attr];
			attrs.push (attr);
			if (!v.attrs [attr]) {
				var va = $o.createViewAttr ({
		    		name: ca.get ("name"),
		    		code: attr,
		    		view: v.get ("id"),
		    		area: 1,
		    		width: 75,
		    		"class": me.get ("id"),
		    		order: npp ++,
		    		classAttr: ca.get ("id")
				});
				va.sync ();
			};
			/*
			if (ca.get ("type") >= 1000) {
				var cls = $o.getClass (ca.get ("type"));
				var alias = aliasStr [aliasIdx];
				aliasIdx ++;
				var o = {};
				o [alias] = cls.attrs ["name"] ? "name" : "id";
				query.select.push (o);
				query.select.push (attr);
				var oc = {};
				oc [alias] = cls.getFullCode ();
				var oca = {};
				oca [alias] = "id";
				query.from = query.from.concat ("left-join", oc, "on");
				query.from.push ([{"a": attr}, "=", oca]);
			} else {
				*/
				query.select.push ({"a": attr});
				query.select.push (attr);
			//};
		};
		var layout = {
			olap: {
				id: "cmp-1",
				classView: me.getFullCode ()
			}
		};
		query = JSON.stringify (query, null, "\t");
		layout = JSON.stringify (layout, null, "\t");
		if (v.get ("query") != query || v.get ("layout") != layout) {
			v.set ("query", query);
			v.set ("layout", layout);
			v.sync ();
		};
		// remove view attrs
		for (var attr in v.attrs) {
			if (attrs.indexOf (attr) == -1) {
				var va = v.attrs [attr];
				va.remove ();
				va.sync ();
			};
		};
	},
	/*
		Обновляет действия: Создать, Удалить, Карточка
	*/
	updateDefaultActions: function () {
		var me = this;
		var r = common.execSQL ({
		    "select": [
		        {"a":"___fid"}, "id",
		        {"a":"___fcode"}, "code"
		    ],
		    "from": [
		        {"a":"system.action"}
		    ],
		    "where": [
		        {"a": "___fend_id"}, "=", 2147483647, "and", {"a": "___fclass_id"}, "=", me.get ("id")
		    ],
		    "order": [
		        {"a":"___fid"}
		    ]
		});
		var actions = {};
		for (var i = 0; i < r.length; i ++) {
			actions [r.get (i, "code")] = r.get (i, "id");
		};
	    // card
	    var aCard;
    	var cardBody =
    		'var me = this;\n' +
    		'var id = options.id || me.getValue ("id");\n' +
    		'common.tpl.show.call (this, {\n' +
    		'\tid: id,\n' +
    		'\tasWindow: 1,\n' +
			'\treadOnly: options.readOnly,\n' +
    		'\tlayout: common.tpl.updateTags (\n' +
    		'\t\t' + me.getFullCode () + '.card.layout, {\n' +
    		'\t\t\tid: id\n' +
    		'\t\t}\n' +
    		'\t)\n' +
    		'});\n'
    	;
    	if (!actions.card) {
	    	var aCard = $o.createAction ();
	    	aCard.set ("class", me.get ("id"));
	    	aCard.set ("name", $o.getString ("Open"));
	    	aCard.set ("code", "card");
	    	aCard.set ("layout", JSON.stringify ({
	    		"type": "card",
	    		"layout": {
					"card": {
						"id": "card",
						"items": [],
						"object": [
							{
								"cls": me.getFullCode (),
								"tag": "[#id]"
							}
						]
					}
				}
			}, null, "\t"));
	    	aCard.set ("body", cardBody);
	    	aCard.sync ();
	    	aCard.initAction ();
	    };
		// create
    	var aCreate;
    	var createBody =
    		'common.tpl.create.call (this, {\n' +
    		'\tasWindow: 1,\n' +
    		'\tclassCode: "' + me.getFullCode () + '",\n' +
			'\tfn: function (o, options) {\n' +
    		'\t\toptions.layout = common.tpl.updateTags (\n' +
    		'\t\t\t' + me.getFullCode () + '.card.layout, {\n' +
    		'\t\t\t\tid: o.get ("id")\n' +
    		'\t\t\t}\n' +
    		'\t\t)\n' +
    		'\t}\n' +
    		'});\n'
		;
    	if (!actions.create) {
    	 	aCreate = $o.createAction ();
	    	aCreate.set ("class", me.get ("id"));
	    	aCreate.set ("name", $o.getString ("Add"));
	    	aCreate.set ("code", "create");
		    aCreate.set ("layout", '{"type": "create"}');
	    	aCreate.set ("body", createBody);
	    	aCreate.sync ();
	    	aCreate.initAction ();
    	};
    	// remove
    	var aRemove;
    	var removeBody =
    		'common.tpl.remove.call (this);\n'
    	;
    	if (!actions.remove) {
	    	aRemove = $o.createAction ();
	    	aRemove.set ("class", me.get ("id"));
	    	aRemove.set ("name", $o.getString ("Remove"));
	    	aRemove.set ("code", "remove");
	    	aRemove.set ("layout", '{"type": "remove"}');
	    	aRemove.set ("body", removeBody);
	    	aRemove.sync ();
	    	aRemove.initAction ();
	    };
	},
	getConfObject: function (conf, id) {
		var o;
		switch (conf) {
		case "class":
			o = $o.getClass (id);
			break;
		case "classAttr":
			o = $o.getClassAttr (id);
			break;
		case "view":
			o = $o.getView (id);
			break;
		case "viewAttr":
			o = $o.getViewAttr (id);
			break;
		case "action":
			o = $o.getAction (id);
			break;
		};
		return o;
	},
	getRevisions: function () {
		var r = Ext.Ajax.request ({
			async: false,
			url: "get_revisions?sessionId=" + $sessionId,
			params: "getRevisions ()"
		});
		r = eval ("(" + r.responseText + ")");
		return r;
	},
	setRevision: function (revisionId) {
		revisionId = revisionId || "";
		var r = Ext.Ajax.request ({
			async: false,
			url: "set_revision?sessionId=" + $sessionId + "&id=" + revisionId,
			params: "setRevision (" + revisionId + ")"
		});
		r = eval ("(" + r.responseText + ")");
		this.objectsMap = {};
		this.revision = revisionId;
		this.app.tp.removeAll ();
		this.app.tp.doLayout ();
		return r;
	},
	copyFile: function (opts) {
		var r = Ext.Ajax.request ({
			async: false,
			url: 
				"copy_file?sessionId=" + $sessionId + 
				"&src_object_id=" + opts.src.objectId + "&src_class_attr_id=" + opts.src.classAttrId +
				"&dst_object_id=" + opts.dst.objectId + "&dst_class_attr_id=" + opts.dst.classAttrId +
				"&filename=" + opts.filename
		});
	},
	saveToFile: function (opts) {
		var r = Ext.Ajax.request ({
			async: false,
			params: opts.data,
			url: 
				"save_to_file?sessionId=" + $sessionId + 
				"&object_id=" + opts.objectId + "&class_attr_id=" + opts.classAttrId +
				"&filename=" + opts.filename
		});
	},
	isReadOnly: function () {
		if ($o.userId) {
			var o = $o.getObject ($o.userId);
			return o.get ("readOnly");
		} else {
			return false;
		};
	},
	getString: function (s) {
		return $o.locale.getString (s);
	},
	queueFn: [],
	pushFn: function (f) {
		var me = this;
		me.queueFn.push (f);
	},
	/*
		Выполняет функции из очереди. Ext.define, ...
	*/
	executeQueueFunctions: function (options) {
		var me = this;
		_.each (me.queueFn, function (f) {
			f ();
		});
	},
});

/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
*/

$o.util = {};

// Клонирование объекта
$o.util.clone = function (o) {
	if (!o || 'object' !== typeof o)  {
		return o;
	}
	if (typeof (o) == "object" && o && o.getMonth) {
		return new Date (o.getTime ());
	};
	var c = 'function' === typeof o.pop ? [] : {};
	var p, v;
	for (p in o) {
		if (o.hasOwnProperty (p)) {
			v = o [p];
			if (v && 'object' === typeof v) {
				c [p] = $o.util.clone (v);
			} else {
				c [p] = v;
			}
		}
	}
	return c;
}
$o.util.setCookie = function (name, value, path, expires, domain, secure) {
	var cookie_string = name + "=" + escape (value);
	var expiresDefault = new Date ();
	expiresDefault.setDate (expiresDefault.getDate () + 30);
	expires = expires || expiresDefault;
	if (expires) {
		cookie_string += "; expires=" + expires.toStringOriginal ();
	};
	if (path) {
		cookie_string += "; path=" + escape (path);
	};
	if (domain) {
		cookie_string += "; domain=" + escape (domain);
	};
	if (secure) {
		cookie_string += "; secure";
	};
	document.cookie = cookie_string;
};
$o.util.removeCookie = function (cookie_name) {
	var cookie_date = new Date ();
	cookie_date.setTime (cookie_date.getTime() - 1);
	document.cookie = cookie_name += "=; expires=-1";// + cookie_date.toGMTString ();
};
$o.util.getCookie = function (cookie_name) {
	var results = document.cookie.match ( '(^|;) ?' + cookie_name + '=([^;]*)(;|$)' );
	if (results) {
		return (unescape (results [2]));
	} else {
		return null;
	}
};
$o.util.getStyle = function (className) {
    var classes = document.styleSheets [0].rules || document.styleSheets [0].cssRules;
    var r;
    for (var x = 0; x < classes.length; x ++) {
        if (classes [x].selectorText == className) {
            if (classes [x].cssText) {
            	r = classes [x].cssText;
            } else {
            	r = classes [x].style.cssText;
            };
            break;
        }
    }
    return r;
};
$o.util.isEmptyObject = function (obj) {
	if (!obj) {
		return true;
	};
	for (var prop in obj) {
		if (Object.prototype.hasOwnProperty.call (obj, prop)) {
			return false;
		};
	};
	return true;
};
$o.util.loadCSS = function (file, cb) {
	var link = document.createElement ("link");
	link.setAttribute ("rel", "stylesheet");
	link.setAttribute ("type", "text/css");
	link.setAttribute ("href", file);
	if (cb) {
		if (link.onreadystatechange === undefined) {
			link.onload = cb;    
		} else {
			link.onreadystatechange = function() {
				if (this.readyState == 'complete' || this.readyState == 'loaded') {  
					cb ();   
				}  
			}
		}  
	}	
	document.getElementsByTagName ("head")[0].appendChild (link)
};
$o.util.loadJS = function (file, cb) {
	var script = document.createElement ('script');
	script.src = file;
	script.type = "text/javascript";
	script.language = "javascript";
	var head = document.getElementsByTagName ('head')[0];
	if (cb) {
		if (script.onreadystatechange === undefined) {
			script.onload = cb;    
		} else {
			script.onreadystatechange = function() {
				if (this.readyState == 'complete' || this.readyState == 'loaded') {  
					cb ();   
				}  
			}
		}  
	}	
	head.appendChild (script);
};

$o.util.sha1 = hex_sha1;

$zu = $o.util;

/*
    json2.js
    2012-10-08

    Public Domain.

    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

    See http://www.JSON.org/js.html


    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html

    USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
    NOT CONTROL.


    This file creates a global JSON object containing two methods: stringify
    and parse.

        JSON.stringify(value, replacer, space)
            value       any JavaScript value, usually an object or array.

            replacer    an optional parameter that determines how object
                        values are stringified for objects. It can be a
                        function or an array of strings.

            space       an optional parameter that specifies the indentation
                        of nested structures. If it is omitted, the text will
                        be packed without extra whitespace. If it is a number,
                        it will specify the number of spaces to indent at each
                        level. If it is a string (such as '\t' or '&nbsp;'),
                        it contains the characters used to indent at each level.

            This method produces a JSON text from a JavaScript value.

            When an object value is found, if the object contains a toJSON
            method, its toJSON method will be called and the result will be
            stringified. A toJSON method does not serialize: it returns the
            value represented by the name/value pair that should be serialized,
            or undefined if nothing should be serialized. The toJSON method
            will be passed the key associated with the value, and this will be
            bound to the value

            For example, this would serialize Dates as ISO strings.

                Date.prototype.toJSON = function (key) {
                    function f(n) {
                        // Format integers to have at least two digits.
                        return n < 10 ? '0' + n : n;
                    }

                    return this.getUTCFullYear()   + '-' +
                         f(this.getUTCMonth() + 1) + '-' +
                         f(this.getUTCDate())      + 'T' +
                         f(this.getUTCHours())     + ':' +
                         f(this.getUTCMinutes())   + ':' +
                         f(this.getUTCSeconds())   + 'Z';
                };

            You can provide an optional replacer method. It will be passed the
            key and value of each member, with this bound to the containing
            object. The value that is returned from your method will be
            serialized. If your method returns undefined, then the member will
            be excluded from the serialization.

            If the replacer parameter is an array of strings, then it will be
            used to select the members to be serialized. It filters the results
            such that only members with keys listed in the replacer array are
            stringified.

            Values that do not have JSON representations, such as undefined or
            functions, will not be serialized. Such values in objects will be
            dropped; in arrays they will be replaced with null. You can use
            a replacer function to replace those with JSON values.
            JSON.stringify(undefined) returns undefined.

            The optional space parameter produces a stringification of the
            value that is filled with line breaks and indentation to make it
            easier to read.

            If the space parameter is a non-empty string, then that string will
            be used for indentation. If the space parameter is a number, then
            the indentation will be that many spaces.

            Example:

            text = JSON.stringify(['e', {pluribus: 'unum'}]);
            // text is '["e",{"pluribus":"unum"}]'


            text = JSON.stringify(['e', {pluribus: 'unum'}], null, '\t');
            // text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

            text = JSON.stringify([new Date()], function (key, value) {
                return this[key] instanceof Date ?
                    'Date(' + this[key] + ')' : value;
            });
            // text is '["Date(---current time---)"]'


        JSON.parse(text, reviver)
            This method parses a JSON text to produce an object or array.
            It can throw a SyntaxError exception.

            The optional reviver parameter is a function that can filter and
            transform the results. It receives each of the keys and values,
            and its return value is used instead of the original value.
            If it returns what it received, then the structure is not modified.
            If it returns undefined then the member is deleted.

            Example:

            // Parse the text. Values that look like ISO date strings will
            // be converted to Date objects.

            myData = JSON.parse(text, function (key, value) {
                var a;
                if (typeof value === 'string') {
                    a =
/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
                    if (a) {
                        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
                            +a[5], +a[6]));
                    }
                }
                return value;
            });

            myData = JSON.parse('["Date(09/09/2001)"]', function (key, value) {
                var d;
                if (typeof value === 'string' &&
                        value.slice(0, 5) === 'Date(' &&
                        value.slice(-1) === ')') {
                    d = new Date(value.slice(5, -1));
                    if (d) {
                        return d;
                    }
                }
                return value;
            });


    This is a reference implementation. You are free to copy, modify, or
    redistribute.
*/

/*jslint evil: true, regexp: true */

/*members "", "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
    call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
    getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
    lastIndex, length, parse, prototype, push, replace, slice, stringify,
    test, toJSON, toString, valueOf
*/


// Create a JSON object only if one does not already exist. We create the
// methods in a closure to avoid creating global variables.

if (typeof JSON !== 'object') {
    JSON = {};
}

(function () {
    'use strict';

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    if (typeof Date.prototype.toJSON !== 'function') {

        Date.prototype.toJSON = function (key) {

            return isFinite(this.valueOf())
                ? this.getUTCFullYear()     + '-' +
                    f(this.getUTCMonth() + 1) + '-' +
                    f(this.getUTCDate())      + 'T' +
                    f(this.getUTCHours())     + ':' +
                    f(this.getUTCMinutes())   + ':' +
                    f(this.getUTCSeconds())   + 'Z'
                : null;
        };

        String.prototype.toJSON      =
            Number.prototype.toJSON  =
            Boolean.prototype.toJSON = function (key) {
                return this.valueOf();
            };
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string'
                ? c
                : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }


    function str(key, holder) {

// Produce a string from holder[key].

        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

        if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

// What happens next depends on the value's type.

        switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

            return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

        case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

            if (!value) {
                return 'null';
            }

// Make an array to hold the partial results of stringifying this object value.

            gap += indent;
            partial = [];

// Is the value an array?

            if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

                v = partial.length === 0
                    ? '[]'
                    : gap
                    ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
                    : '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }

// If the replacer is an array, use it to select the members to be stringified.

            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    if (typeof rep[i] === 'string') {
                        k = rep[i];
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {

// Otherwise, iterate through all of the keys in the object.

                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

            v = partial.length === 0
                ? '{}'
                : gap
                ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
                : '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }

// If the JSON object does not yet have a stringify method, give it one.

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

            var i;
            gap = '';
            indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }

// If the space parameter is a string, it will be used as the indent string.

            } else if (typeof space === 'string') {
                indent = space;
            }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                    typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

            return str('', {'': value});
        };
    }


// If the JSON object does not yet have a parse method, give it one.

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

            var j;

            function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

            text = String(text);
            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with '()' and 'new'
// because they can cause invocation, and '=' because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

            if (/^[\],:{}\s]*$/
                    .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                        .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                        .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                j = eval('(' + text + ')');

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

                return typeof reviver === 'function'
                    ? walk({'': j}, '')
                    : j;
            }

// If the text is not JSON parseable, then a SyntaxError is thrown.

            throw new SyntaxError('JSON.parse');
        };
    }
}());

/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/
//Ext.Loader.setPath ("Ext.ux", "/third-party/extjs4/examples/ux");
//Ext.require ("Ext.ux.grid.FiltersFeature");
Ext.define ("$o.Base.Grid", {
	/*
		Создает компонент кнопки из макета action
	*/
	createButton: function (action) {
		var me = this;
		var item = {
			scope: me,
			handler: function () {
				if (action.type && action.type == "report") {
					me.report (action);
				} else
				if (_fn) {
					item.noTransaction = item.noTransaction || (item.arguments ? item.arguments.noTransaction : null);
					try {
						_fn = typeof (_fn) == "string" ? eval ("(" + _fn + ")") : _fn;
					} catch (e) {
						common.message ($o.getString ("Function not exists") + ": " + _fn);
						throw new Error ("action.fn exception: " + _fn + "\nexception: " + e);
					};
					if (!item.noTransaction) {
						$o.startTransaction ({description: '***prepare_transaction*** action started'});
					};
					var a = $o.util.clone (item.arguments);
					if ($o.debug || (a && a.debug)) {
						_fn.call (me, a || {});
						if (!item.noTransaction) {
							$o.commitTransaction ();
						};
					} else {
						try {
							_fn.call (me, a || {});
							if (!item.noTransaction) {
								$o.commitTransaction ();
							};
						} catch (e) {
							if (!item.noTransaction) {
								$o.rollbackTransaction ();
							};
							console.log (e.stack);
							throw new Error (e);
						};
					};
				};
			}
		};
		Ext.apply (item, action);
		if (action.code) {
			item.text = $o.locale.getString (action.code);
			item.iconCls = action.code;
		};
		item.iconCls = item.iconCls || item.icon;
		item.text = $o.locale.getString (action.text || action.caption);
		if (action.actions) {
			item.menu = {
				items: []
			};
			for (var i = 0; i < action.actions.length; i ++) {
				item.menu.items.push (me.createButton (action.actions [i]));
			};
		};
		var _fn = item.fn || item.id;
		item.id = undefined;
		return item;
	},
	/*
		action.type: report
	*/
	report: function (action) {
		var me = this;
		var createReport = function () {
			var reportUri = "report?";			
			var key;
			for (key in action.arguments) {
				if (Ext.isArray (action.arguments [key])) {
					reportUri += key + "=" + me.zview.getCurrentValue (action.arguments [key][0], action.arguments [key][1]) + "&";
				} else {
					reportUri += key + "=" + action.arguments [key] + "&";
				};
			};
			reportUri += "storage=" + $o.code + '&sessionId=' + $sessionId + "&username=" + $o.currentUser + "&time_offset_min=" + (new Date ()).getTimezoneOffset ();
			var w = window.open (reportUri);
			w.focus ();
		}
		if (action.fn) {
			action.arguments.success = function () {
				createReport ();
			};
			try {
				action.fn.call (me, action.arguments);
			} catch (e) {
				alert (e);
				return;
			}
		}
		if (!action.arguments.hasCallback) {
			createReport (me);
		}
	},	
	/*
		Создает модель для представления
	*/
	createViewModel: function (options) {
		var view = options.view;
		var viewId = view.get ("id");
		$o.updateViewAttrsType ({view: view});
//		if (view.orderedFields) {
//			return view.orderedFields;
//		};
		var fields = [];
		for (var attr in view.attrs) {
			var va = view.attrs [attr];
			var dataType = va.get ("classAttr") == null ? "number" : $o.classAttrsMap [va.get ("classAttr")].getDataType ();
			var filterDataType = va.get ("classAttr") == null ? "numeric" : $o.classAttrsMap [va.get ("classAttr")].getFilterDataType ();
			fields.push ({
				name: va.get ("code"),
				header: va.get ("name"),
				type: dataType,
				filterType: filterDataType,
				order: va.get ("order"),
				id: va.get ("id"),
				area: va.get ("area"),
				width: va.get ("width"),
				useNull: true
			});
		};
		fields.sort (function (a, b) {
			if (a.order !== null && b.order !== null && a.order < b.order) {
				return -1;
			};
			if (a.order != null && b.order == null) {
				return -1;
			};
			if (a.order == b.order && a.id < b.id) {
				return -1;
			};
			if (a.order !== null && b.order !== null && a.order > b.order) {
				return 1;
			};
			if (a.order == null && b.order != null) {
				return 1;
			};
			if (a.order == b.order && a.id > b.id) {
				return 1;
			};
			return 0;
		});
		view.orderedFields = $o.util.clone (fields);
		return fields;
	},
	beforeSelectListener: function (selModel) {
	},
	selectionChangeListener: function (selModel) {
		for (var id in this.targets) {
			var w = this.targets [id];
			if (w.refresh) {
				w.refresh ({moveFirst: 1});
			};
		};
		this.checkActions ();
	},
	checkActions: function () {
		var tbar = this.getDockedItems ("toolbar[dock='top']")[0];
		if (!tbar) {
			return;
		};
		for (var i = 0; i < tbar.items.getCount (); i ++) {
			var b = tbar.items.getAt (i);
			if (b.active) {
				var fn, args;
				if (typeof (b.active) == "function") {
					fn = b.active;
				} else
				if (typeof (b.active) == "string") {
					fn = eval (b.active);
				} else
				if (typeof (b.active) == "object") {
					fn = b.active.fn;
					args = b.active.arguments;
				};
				var active = fn.call (this, args);
				if (active) {
					b.enable ();
				} else {
					b.disable ();
				};
			};
		};
	},
	buildToolbar: function () {
		var me = this;
		if (!me.actions) {
			return;
		};
		var items = [];
		for (var i = 0; i < me.actions.length; i ++) {
			items.push (me.createButton (me.actions [i]));
		};
		if (items.length) {
			me.dockedItems = me.dockedItems || [];
			me.dockedItems.push ({
			    xtype: "toolbar",
			    dock: me.actionsDock || "top",
			    items: items
			});
		};
	},
	getCurrentValue: function (field) {
		var val;
		if (this.getSelectionModel ().hasSelection ()) {
			var record = this.getSelectionModel ().getSelection ()[0];
			val = record.get (field);
		};
		return val;
	},
	getValue: function (field) {
		return this.getCurrentValue (field);
	},
	getCurrentValues: function (field) {
		var va = [];
		if (this.getSelectionModel ().hasSelection ()) {
			var records = this.getSelectionModel ().getSelection ();
			for (var i = 0; i < records.length; i ++) {
				va.push (records [i].get (field));
			};
		};
		return va;
	},
	getValues: function (field) {
		return this.getCurrentValues (field);
	},
	/*
		User filter (grid filter menu)
	*/
	getUserFilter: function () {
		var me = this;
		if (!me.filters) {
			return [];
		};
		var fd = me.filters.getFilterData ();
		var r = [];
		var operMap = {
			"eq": "=",
			"lt": "<",
			"gt": ">",
			"neq": "<>",
			"lte": "<=",
			"gte": ">="
		};
		for (var i = 0; i < fd.length; i ++) {
			if (i) {
				r.push ("and");
			};
			var f = fd [i];
			if (typeof (f.data.value) == "object" && f.data.value.isNotNull) {
				r.push (f.field);
				r.push ("is not null");
			} else
			if (typeof (f.data.value) == "object" && f.data.value.isNull) {
				r.push (f.field);
				r.push ("is null");
			} else
			if (f.data.type && f.data.type == "boolean") {
				if (f.data.value) {
					r.push ([f.field, "=", 1]);
				} else {
					r.push ([f.field, "=", 0, "or", f.field, "is null"]);
				}
			} else {
				r.push (f.field);
				var oper = "like";
				if (f.data.comparison) {
					oper = operMap [f.data.comparison];
				};
				var v = f.data.value;
				if (oper == "like" && v) {
					if (typeof (v) == "object") {
						if (v.notLike) {
							oper = "not like";
						}
						if (v.value.indexOf (",") > -1) {
							if (v.notLike) {
								oper = "not in";
							} else {
								oper = "in";
							}
							f.data.value = v.value.split (",").join (".,.").split (".");
						} else {
							f.data.value = v.value + "%";
						}
					} else {
						f.data.value += "%";
					}
				};
				r.push (oper);
				r.push (f.data.value);
			};
		};
		return r;
	},
	/*
		Full filter
	*/
	getFilter: function () {
		var me = this;
		// custom filter
		var cf = [];
		// user filter
		var uf = me.getUserFilter ();
		if (!me.filter) {
			return uf;
		};
		if (typeof (me.filter) == "string") {
			me.filter = {
				fn: eval (me.filter)
			};
		};
		if (typeof (me.filter) == "function") {
			me.filter = {
				fn: me.filter
			};
		};
		var disabled = false;
		var get = function (a) {
			if (Object.prototype.toString.apply (a) === "[object Array]") {
				var g = [];
				for (var i = 0; i < a.length; i ++) {
					g.push (get (a [i]));
				};
				return g;
			} else {
				if (typeof (a) == "object" && a.id) {
					me.relatives [a.id].targets [me.zid] = me;
					var v = me.zview.getCurrentValue (a.id, a.attr);
					if (v == undefined) {
						me.setDisabled (true);
						disabled = true;
						return undefined;
					} else {
						me.setDisabled (false);
						return v;
					};
				} else {
					return a;
				};
			};
		};
		if (me.filter.fn) {
			cf = me.filter.fn.call (me, me.filter.arguments);
			cf = get (cf);
			if (disabled) {
				cf = undefined;
			};
			if (cf == undefined) {
				me.setDisabled (true);
				return undefined;
			} else {
				me.setDisabled (false);
			};
		} else {
			cf = get (me.filter);
			if (disabled) {
				cf = undefined;
			};
		};
		if (Object.prototype.toString.apply (cf) === "[object Array]") {
			if (cf.length && uf.length) {
				cf.push ("and");
			};
			cf = cf.concat (uf);
		};
		return cf;
	},
	getFullFilter: function () {
		return this.getFilter ();
	},
	cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
		metaData.userStyle = undefined; // shared option
		if (this.lconfig && this.lconfig.listeners && this.lconfig.listeners.cellRenderer) {
			if (typeof (this.lconfig.listeners.cellRenderer) == "string") {
				this.lconfig.listeners.cellRenderer = eval (this.lconfig.listeners.cellRenderer);
			};
			var scope = this.lconfig.listeners.cellRenderer.scope || this.lconfig.listeners.scope || this;
			if (scope == 'view') {
				scope = this.zview;
			};
			if (scope === 'this') {
				scope = this;
			};
			var _fn = this.lconfig.listeners.cellRenderer.fn || this.lconfig.listeners.cellRenderer;
			if (typeof (_fn) == "string") {
				_fn = eval (_fn);
			};
			value = _fn.call (scope, value, metaData, record, rowIndex, colIndex, store, this.lconfig.listeners.cellRenderer.arguments);
		};
		if (value) {
			var tip = value;
			if (typeof (tip) == "string") {
				tip = tip.split ('"').join ("'");
			}
			metaData.tdAttr = 'data-qtip="' + tip + '"';
		};
		if (metaData.userStyle) {
			var style = '';
			style += metaData.userStyle || '';
			metaData.tdAttr += ' style="' + style + '"';
		};
		if (this.wordWrap) {
			metaData.style = "white-space: normal;";
		};
		return value;
	},
	userEventListener: function (options) {
		if (!this.lconfig) {
			return;
		};
		var listeners = this.lconfig.listeners;
		var scope = this;
		if (listeners && listeners.scope) {
			scope = listeners.scope;
		}
		if (listeners && listeners [options.event]) {
			if (listeners [options.event].fn) {
				if (listeners [options.event].scope) {
					scope = listeners [options.event].scope;
				}
				var fn = typeof (listeners [options.event].fn) == "string" ? eval ("(" + listeners [options.event].fn + ")") : listeners [options.event].fn;
				var arguments = $o.util.clone (listeners [options.event].arguments);
				fn.call (scope, arguments || {});
			} else {
				var fn = typeof (listeners [options.event]) == "string" ? eval ("(" + listeners [options.event] + ")") : listeners [options.event];
				fn.call (scope, {});
			}
		}
	},
	getGroupedColumns: function (columns) {
		var getRows = function (cols) {
		    var rowNum = (function (cols) {
		    	var r = 0;
			    for (var i = 0; i < cols.length; i ++) {
			    	var a = cols [i].split (":");
			    	if (a.length > r) {
			    		r = a.length;
			    	};
			    };
			    return r;
			}) (cols);
			// init matrix
		    var m = [];
		    for (var i = 0; i < cols.length; i ++) {
		    	var a = cols [i].split (":");
		    	for (var j = 0; j < a.length; j ++) {
		    		a [j] = {text: a[j].trim (), colspan: 1, rowspan: 1};
		    	};
		    	for (var j = 0, len = rowNum - a.length; j < len; j ++) {
		    		a.push ({text: null, colspan: 1, rowspan: 1});
		    	};
		    	m.push (a);
		    };
		    // merge cols
		    for (var i = 1; i < cols.length; i ++) {
				for (var j = 0; j < rowNum; j ++) {
					var ref = m [i - 1][j].hasOwnProperty ('ref') ? m [i - 1][j].ref :  i - 1;
					if (m [i][j].text != null && m [i][j].text == m [ref][j].text) {
						m [ref][j].colspan ++;
						m [i][j].ref = ref;
					};
				};
		    };
		    // merge rows
			for (var i = 0; i < cols.length; i ++) {
				for (var j = 1; j < rowNum; j ++) {
					var refR = m [i][j - 1].hasOwnProperty ('refR') ? m [i][j - 1].refR : j - 1;
					if (m [i][j].text == null) {
						m [i][refR].rowspan ++;
						m [i][j].refR = refR;
					};
				};
			};
			// rows
			var rows = [];
			for (var i = 0; i < rowNum; i ++) {
				var cells = [], index = 1;
				for (var j = 0; j < cols.length; j ++) {
					if (m [j][i].hasOwnProperty ('refR')) {
						index += m [j][i].colspan;
						continue;
					};
					if (!m [j][i].hasOwnProperty ('ref')) {
						cells.push ({
							text: m [j][i].text, 
							colspan: m [j][i].colspan,
							rowspan: m [j][i].rowspan, 
							index: index
						});
						index += m [j][i].colspan;
					};
				};
				rows.push (cells);
			};
			return rows;
		};
		var convert = function (rows, columns) {
			var getRow = function (level, parent) {
				var cols = [];
				_.each (rows [level], function (col) {
					if (!parent || (col.index >= parent.index && col.index < parent.index + parent.colspan)) {
						var childs = [];
						if (level + 1 < rows.length) {
							childs = getRow (level + 1, col);
						};
						if (childs.length) {
							cols.push ({
								text: col.text,
								columns: childs
							});
						} else {
							columns [col.index - 1].header = col.text;
							columns [col.index - 1].tooltip = col.text;
							cols.push (columns [col.index - 1]);
						};
					};
				});
				return cols;
			};
			var cols = getRow (0);
			return cols;
		};
		var rows = getRows (_.map (columns, function (col) {
			return col.header;
		}));
		var r = convert (rows, columns);
		return r;
	}
});
Ext.define ("$o.Grid.Widget", {
	extend: "Ext.grid.Panel",
	mixins: {
		baseGrid: "$o.Base.Grid"
	},
    alias: ["widget.$o.grid"],
	columnLines: true,
	rowLines: true,
	total: {},
	totalValues: {},
	groupedColumns: true,
	initComponent: function () {		
		var me = this;
		var view, viewId;
		if (me.classView) {
			var cls = $o.getClass (me.classView);
			function createView () {
				var inTransaction = $o.inTransaction;
				if (!inTransaction) {
					$o.startTransaction ();
				}
				cls.updateDefault ();
				if (!inTransaction) {
					$o.commitTransaction ();
				}
			}
			if (!cls.get ("view")) {
				createView ();
			}
			view = $o.getView (cls.get ("view"));
			if (me.recreateView || view.get ("query").indexOf ("left-join") > -1) {
				var inTransaction = $o.inTransaction;
				if (!inTransaction) {
					$o.startTransaction ();
				}
				view.remove ();
				view.sync ();
				cls.set ("view", null);
				cls.sync ();
				createView ();
				if (!inTransaction) {
					$o.commitTransaction ();
				}
			}
			viewId = cls.get ("view");
		} else {
			view = me.queryId ? $o.viewsMap [me.queryId] : $o.getView ({code: me.$query});
			viewId = me.viewId = view.get ("id");
		};
		me.$view = view;
		var query = view.get ("query");
		delete me.query;
		var fields = me.createViewModel ({view: view});
		me.columns = [];
		for (var i = 0; i < fields.length; i ++) {
			var f = fields [i];
			var column = {
				header: $o.getString (f.header),
				tooltip: $o.getString (f.header),
				dataIndex: f.name,
				hidden: f.area != 1,
				width: f.width,
				filter: {
					type: f.filterType
				},
				$field: f,
				renderer: me.cellRenderer,
				scope: me,
				summaryType: 'count',
				summaryRenderer: me.summaryRenderer
			};
			if (f.type == "bool") {
				column.renderer = function (v, meta, rec, row, col, store) {
					if (v) {
						v = $o.getString ("Yes");
					} else {
//					if (v == 0 || v == false) {
						v = $o.getString ("No");
					};
					return me.cellRenderer (v, meta, rec, row, col, store);
				};
			};
			me.columns.push (column);
		};
		if (me.groupedColumns) {
			me.columns = me.getGroupedColumns (me.columns);
		};
		_.each (me.fields, function (f) {
			f.header = "";
		});
		Ext.define ("$o.View." + viewId + ".Model", {
			extend: "Ext.data.Model",
			fields: fields
		});
		me.store = Ext.create ("Ext.data.Store", {
			model: "$o.View." + viewId + ".Model",
			pageSize: 30,
			remoteSort: true,
			clearOnPageLoad: true,
			proxy: {
				type: "ajax",
				api: {
					"create": "view?create=1&id=" + viewId + "&cmpId=" + me.id,
					"read": "view?read=1&id=" + viewId + "&cmpId=" + me.id,
					"update": "view?update=1&id=" + viewId + "&cmpId=" + me.id,
					"delete": "view?delete=1&id=" + viewId + "&cmpId=" + me.id
				},
				reader: {
					"type": "json",
					"root": "data"
				}
			},
			listeners: {
				load: function (records, successful, eOpts) {
					if (me.down ("*[name=rowsNum]")) {
						me.down ("*[name=rowsNum]").setText ($o.getString ("Amount") + ": " + (me.countOverflow ? ">" : "") + this.totalCount);
					};
					if (me.needReconfigureColumns) {
						me.needReconfigureColumns = false;
						me.reconfigureColumns ();
					};
				}
			}
		});
		me.dockedItems = me.dockedItems || [];
		if (!me.hideBottomToolbar) {
			var items = [];
			if (!me.hidePrint) {
				items.push ({
					iconCls: "gi_print",
					tooltip: "Печать",
					menu: {
						items: [{
							text: "*.xml (" + $o.getString ("Table") + " XML - Microsoft Excel)",
							iconCls: "gi_print",
							handler: function () {
								me.printOlap.call (this, "xmlss");
							}
						}, {
							text: "*.csv (CSV - " + $o.getString ("encoding") + " win-1251)",
							iconCls: "gi_print",
							handler: function () {
								me.printOlap.call (this, "csv", "win1251");
							}
						}, {
							text: "*.csv (CSV - " + $o.getString ("encoding") + " utf-8)",
							iconCls: "gi_print",
							handler: function () {
								me.printOlap.call (this, "csv", "utf8");
							}
						}, {
							text: "*.xlsx (XLSX - Microsoft Excel)",
							iconCls: "gi_print",
							handler: function () {
								me.printOlap.call (this, "xlsx");
							}
						}, {
							text: "*.pdf (PDF)",
							iconCls: "gi_print",
							hidden: !common.getConf ({code: "reportPDF"}).used,
							handler: function () {
								me.printOlap.call (this, "pdf");
							}
						}, {
							text: "*.ods (ODF - Open Document Format)",
							iconCls: "gi_print",
							handler: function () {
								me.printOlap.call (this, "ods");
							}
						}]
					}
				});
			};
			if (!me.hideHeaders) {
				items.push ({
					iconCls: "gi_restart",
					tooltip: $o.getString ("Reset filters and totals"),
					handler: function () {
						me.filters.clearFilters ();
						me.total = {};
						me.totalValues = {};
						var summary = me.down ("*[itemId=summaryBar]");
						summary.hide ();
						me.refresh ();
					}
				});
				items.push ({
					xtype: "label",
					name: "rowsNum",
					text: ""
				});
			};
			me.dockedItems.push ({
				xtype: "pagingtoolbar",
				store: me.store,
				dock: "bottom",
				beforePageText: "",
				afterPageText: $o.getString ("of") + " {0}",
				items: items
			});
		};
		me.filters = {
			ftype: "filters",
			encode: true,
			local: false
		};	
		me.features = [me.filters, {
			ftype: "summary",
			dock: "bottom",
			name: "summary"
		}];
		me.buildToolbar ();
		me.on ("beforerender", me.beforeRenderListener, me);
		me.on ("render", me.renderListener, me);
		me.on ("itemdblclick", function () {
			me.userEventListener ({event: "dblclick"});
		}, me);
		me.selModel = me.selModel || Ext.create ("Ext.selection.RowModel", {
			mode: me.singleSelect == false ? "MULTI" : "SINGLE",
			listeners: {
				beforeselect: {
					fn: me.beforeSelectListener,
					scope: me
				},
				selectionchange: {
					fn: me.selectionChangeListener,
					scope: me
				}
			}
		});
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
		Ext.ux.grid.FiltersFeature.prototype.menuFilterText = $o.getString ("Filter");
		Ext.ux.grid.filter.BooleanFilter.prototype.yesText = $o.getString ("Yes");
		Ext.ux.grid.filter.BooleanFilter.prototype.noText = $o.getString ("No");
		Ext.ux.grid.filter.DateFilter.prototype.beforeEqText = $o.getString ("Less or equal");
		Ext.ux.grid.filter.DateFilter.prototype.beforeText = $o.getString ("Less");
		Ext.ux.grid.filter.DateFilter.prototype.afterEqText = $o.getString ("More or equal");
		Ext.ux.grid.filter.DateFilter.prototype.afterText = $o.getString ("More");
		Ext.ux.grid.filter.DateFilter.prototype.nonText = $o.getString ("Not equal");
		Ext.ux.grid.filter.DateFilter.prototype.onText = $o.getString ("Equal");
		Ext.ux.grid.filter.DateFilter.prototype.dateFormat = "d.m.Y";
		Ext.ux.grid.menu.RangeMenu.prototype.menuItemCfgs.emptyText = $o.getString ("Enter number") + " ...",
		me.on ("columnshow", function () {
			me.needReconfigureColumns = true;
		});
		me.addEvents (
			"refresh"
		);
		me.callParent (arguments);
	},
	beforeRenderListener: function () {
		if (this.getFilter ()) {
			this.store.load ();
		};
	},
	renderListener: function () {
		var me = this;
		me.checkActions ();
		if ($o.util.isEmptyObject (me.total)) {
			var summary = me.down ("*[itemId=summaryBar]");
			if (summary) {
				summary.hide ();
			};
		};
		var onActivate = function () {
			if (this.down ("*[name=totals]")) {
				this.remove (this.down ("*[name=totals]"));
			};
			var columns = me.query ("gridcolumn");
			var numberColumn = 0;
			for (var i = 0; i < columns.length; i ++) {
				if (columns [i].$field && columns [i].$field.name == menu.activeHeader.dataIndex) {
					if (columns [i].$field.type == "number") {
						numberColumn = 1;
					};
					break;
				};
			};
			if (numberColumn) {
				this.add ([{
					text: $o.getString ("Totals"),
					name: "totals",
					iconCls: "gi_calculator",
					menu: {
						defaults: {
							handler: function () {
								me.total [menu.activeHeader.dataIndex] = this.name;
								me.refresh ();
								var summary = me.down ("*[itemId=summaryBar]");
								summary.show ();
							}
						},
						items: [{
							text: $o.getString ("Sum"),
							iconCls: "gi_calculator",
							name: "sum"
						}, {
							text: $o.getString ("Average"),
							iconCls: "gi_calculator",
							name: "avg"
						}, {
							text: $o.getString ("Max"),
							iconCls: "gi_calculator",
							name: "max"
						}, {
							text: $o.getString ("Min"),
							iconCls: "gi_calculator",
							name: "min"
						}]
					}
				}]);           
			};
		};
		var menu = me.headerCt.getMenu ();
		menu.on ("activate", onActivate);
		me.on ("reconfigure", function () {
			menu = me.headerCt.getMenu ();
			menu.on ("activate", onActivate);
		});
	},
    summaryRenderer: function(value, summaryData, dataIndex) {
	    var field = summaryData.column.dataIndex;
		return this.totalValues [field];
	},
	refresh: function (options) {
		var me = this;
		if (me.getFilter ()) {
			if (options && options.moveFirst) {
				var pt = me.getDockedItems ("pagingtoolbar");
				if (pt && pt.length) {
					pt [0].moveFirst ();
				};
			};
			me.store.reload (options);
			me.checkActions ();
		};
		for (var id in me.targets) {
			var w = me.targets [id];
			if (w.refresh) {
				w.refresh ({moveFirst: 1});
			};
		};
		me.fireEvent ("refresh");
	},
	reconfigureColumns: function () {
		var me = this;
    	var cols = [];
    	var columns = me.down ("headercontainer").getGridColumns ();
    	for (var i = 0; i < columns.length; i ++) {
    		var col = columns [i];
    		var c = {
				header: col.text,
				tooltip: col.tooltip,
				dataIndex: col.dataIndex,
				hidden: col.hidden,
				width: col.width,
				filter: {
					type: col.filter.type
				},
				$field: col.$field,
				renderer: col.renderer,
				scope: col.scope
    		};
    		cols.push (c);
    	};
    	me.reconfigure (null, cols);
	},
	selectRow: function (options) {
		var me = this;
		var viewFilter = me.getFilter ();
		var r = Ext.Ajax.request ({
			url: "?sessionId=" + $sessionId,
			params: $o.code + ".View.selectRows(" + me.viewId + ", null, [!" + Ext.encode ({viewFilter: viewFilter, selectFilter: options.filter}) + '!])',
			async: false
		});
		var rows = eval ("(" + r.responseText + ")").data;
		if (rows.length > 0) {
			me.store.getProxy ().extraParams = {
				start: Math.floor (rows [0] / me.store.pageSize) * me.store.pageSize,
				limit: me.store.pageSize
			};
			me.store.load (function () {
				me.getSelectionModel ().deselectAll ();
				me.getSelectionModel ().select (rows [0] % me.store.pageSize);
			});
		}
	},
	printOlap: function (format, coding) {
		var me = this;
		// reportUri
		var viewId = me.up ("grid").viewId;
		if (!viewId && me.up ("grid").classView) {
			viewId = $o.getClass (me.up ("grid").classView).get ("view");
		};
		var reportUri = "report?";			
		reportUri += "format=" + format + "&view=" + viewId + "&storage=" + $o.code;
		if (coding) {
			reportUri += "&coding=" + coding;
		}
		var grid = me.up ("grid");
		var tp = me.up ("tabpanel");
		var tabTitle;
		if (tp) {
			tabTitle = tp.getActiveTab ().title;
		};
		if (tabTitle || grid.title) {
			var name = "";
			if (tabTitle) {
				name += tabTitle;
			};
			if (grid.title) {
				if (name) {
					name += " - ";
				};
				name += grid.title;
			};
			reportUri += "&filename=" + name;
			if (format == "xmlss") {
				reportUri += ".xml";
			} else {
				reportUri += "." + format;
			}
		};
		var store = grid.getStore ();
		var filter = JSON.stringify (grid.getFilter ());
		var order;
		if (store.sorters.getCount ()) {
			order = '["' + store.sorters.getAt (0).property + '","' + store.sorters.getAt (0).direction + '"]';
		} else {
			order = 'null';
		};
		var cd = new Date ();
		reportUri += '&sessionId=' + $sessionId + "&username=" + $zp.currentUser + "&time_offset_min=" + cd.getTimezoneOffset ();
		// cols
		var cols = me.up ("grid").query ("gridcolumn");
		var colsData = [];
		for (var i = 0; i < cols.length; i ++) {
			var f = cols [i].$field;
			if (f) {
				var o = {
					attrId: f.id,
					attr: f.name,
					header: f.header,
					code: f.id,
					hidden: cols [i].hidden ? 1 : 0,
					width: cols [i].width || 75
				};
	//			if (config [i].total) {
	//				o.total = config [i].total;
	//			}
				colsData.push (o);
			}
		}
		// submit
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' action='" + reportUri + "'>" +
			"<textarea style='display: none' name='cols'>" + JSON.stringify (colsData) + "</textarea>" +
			"<textarea style='display: none' name='filter'>" + filter + "</textarea>" +
			"<textarea style='display: none' name='total'>" + JSON.stringify (grid.total) + "</textarea>" +
			"<textarea style='display: none' name='order'>" + order + "</textarea>" +
			"<textarea style='display: none' name='options'>" + JSON.stringify ({dateAttrs: grid.dateAttrs}) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();		
	}
});

/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
*/

//Ext.require ([
//    "Ext.ux.form.MultiSelect"
//]);
/*
	compositefield -> fieldcontainer
*/
$o.pushFn (function () {

Ext.define ("$o.CompositeField.Widget", {
	extend: "Ext.form.FieldContainer",
	alias: "widget.compositefield",
	layout: "hbox",
	initComponent: function () {
		this.callParent (arguments);
	}
});
/*
	ObjectField
*/
Ext.define ("$o.ObjectField.Widget", {
	extend: "Ext.form.FieldContainer",
	alias: ["widget.objectfield", "widget.$objectfield", "widget.$o.objectfield"],
	layout: "hbox",
	initComponent: function () {
		var me = this;
		me.items = [{
			xtype: "button",
			iconCls: "gi_edit",
			style: {
				marginRight: 1
			},
			handler: function () {
				var me = this;
				if (me.ro) {
					return;
				};
				me.choose = me.choose || {};
				var winWidth = me.choose.width || 800;
				var winHeight = me.choose.height || 600;
				if (me.choose.fn && me.choose.type == "custom") {
					me.choose.fn.call (me);
					return;
				};
				if (me.choose.fn) {
					me.choose.fn.call (me);
				};
				if (me.choose.listeners && me.choose.listeners.beforeShow) {
					me.choose.listeners.beforeShow.call (me);
				};
				var layout;
				var view;
				if (me.choose.type == "layout") {
					layout = $o.util.clone (me.choose.layout);
				} else {
					if (me.choose.id) {
						view = $o.getView ({code: me.choose.id});
						layout = view.get ("layout") || {
							olap: {
								id: "olap",
								view: me.choose.id
							}
						};
					} else {
						// classView
						var o = $o.getObject (me.objectId);
						var cls = $o.getClass (o.get ("classId"));
						var ca = cls.attrs [me.attr];
						layout = {
							olap: {
								id: "olap",
								classView: ca.get ("type")
							}
						};
						me.choose.attr = "olap.id";
					};
				};
				if (typeof (layout) == "string") {
					layout = eval ("(" + layout + ")");
				};
				me.fireEvent ("beforechoose", {
					layout: layout
				});
				var attrs = me.choose.attr.split (".");
				var olap;
				var view = Ext.create ("$o.Layout.Widget", {
					record: view || $zs.views.ser.card,
					$layout: layout,
					listeners: {
						afterrender: function () {
							var tb;
							if (attrs.length > 1) {
								olap = view.relatives [attrs [0]];
								if (olap) {
									tb = olap.getDockedItems ("toolbar[dock='top']")[0];
									if (tb) {
										tb.insert (0, [btnChoose, btnCancel]);
										tb.doLayout ();
									} else {
									};
								} else {
									common.message ("Элемент '" + attrs [0] + "' не найден.");
									return;
								};
							} else {
								olap = view.items.items [0];
							}
							olap.selModel.on ('selectionchange', function () {
								if (olap.getCurrentValue (attrs [attrs.length - 1])) {
									btnChoose.setDisabled (false);
								} else {
									btnChoose.setDisabled (true);
								}
							}, this);
							if (olap.lconfig && olap.lconfig.listeners && olap.lconfig.listeners.dblclick) {
								delete olap.lconfig.listeners.dblclick;
							};
							olap.on ("itemdblclick", function () {
								//btnChoose.handler.call (me);
								me.onChoose (view);
								setTimeout (function () {
									win.close ();
								}, 100);
							}, me);
							if (!tb) {
								tb = win.getDockedItems ("toolbar[dock='top']")[0];
								tb.add ([btnChoose, btnCancel]);
								tb.doLayout ();
								tb.setVisible (true);
							};
							if (me.choose.hideActions) {
								var b = win.query ("button");
								for (var i = 0; i < b.length; i ++) {
									if ([$o.getString ("Add"), $o.getString ("Open"), $o.getString ("Remove")].indexOf (b [i].text) > -1) {
										b [i].hide ();
									}; 
								};
							};
						},
						scope: me
					}
				});
				var btnChoose = Ext.create ("Ext.Button", {
					text: $o.getString ("Choose"),
					iconCls: "ok",
					disabled: true,
					handler: function () {
						me.onChoose (view);
						win.close ();
					},
					scope: me
				});
				var btnCancel = Ext.create ("Ext.Button", {
					text: $o.getString ("Cancel"),
					iconCls: "cancel",
					handler: function () {
						win.close ();
					}
				});
				var win = Ext.create ("Ext.Window", {
					title: $o.getString ("Choose object"),
					resizable: true,
					closable: true,
					height: winHeight,
					width: winWidth,
					layout: "fit",
					modal: true,
					tbar: Ext.create ("Ext.Toolbar", {
						hidden: true
					}),
					items: [view]
				});
				win.show ();
			},
			scope: me
		}, {
			xtype: "button",
			iconCls: "gi_remove",
			style: {
				marginRight: 1
			},
			handler: function () {
				me.setValue (null);
				if (me.choose.listeners && me.choose.listeners.afterChoose) {
					me.choose.listeners.afterChoose.call (me);
				};
				me.fireEvent ("change", null);
			}
		}, {
			xtype: "textfield",
			flex: 1,
			readOnly: true,
			objectField: me,
			listeners: {
				render: function (c) {
					me.valueField = c;
					if (me.value) {
						me.setValue (me.value);
					};
	                c.getEl ().on ("mousedown", function (e, t, eOpts) {
	                	if (me.down ("button[iconCls=gi_edit]")) {
							me.down ("button[iconCls=gi_edit]").handler.call (me);
						};
	                });
					me.getActiveError = function () {
						return me.valueField.getActiveError.call (me.valueField, arguments);
					};
				},
				focus: function () {
					me.fireEvent ("focus", me);
				}
			}
		}];
		if (me.hasOwnProperty ("allowBlank")) {
			me.items [me.items.length - 1].allowBlank = me.allowBlank;
		};
		if (me.readOnly) {
			me.items.splice (0, 2);
			me.addCls ("readonly-field");
		};
		if (this.hasOwnProperty ("allowBlank") && !this.allowBlank && this.fieldLabel) {
			this.fieldLabel = this.fieldLabel + "<span style='color: red !important'>*</span>";
		};
		me.addEvents ("change", "beforechoose");
		if (me.listeners && me.listeners.beforechoose && typeof (me.listeners.beforechoose) == "string") {
			me.listeners.beforechoose = eval (me.listeners.beforechoose);
		};
		me.callParent (arguments);
	},
	onChoose: function (view) {
		var me = this;
		var tokens = (me.choose.attr ? me.choose.attr : "olap.id").split (".");
		var wId, field, value;
		if (tokens.length == 1) {
			for (wId in view.relatives) {
				break;
			};
			field = tokens [0];
		} else {
			wId = tokens [0];
			field = tokens [1];
		};
		var oldValue = me.getValue ();
		value = view.relatives [wId].getCurrentValue (field);
		me.setValue (value);
		if (me.choose.listeners && me.choose.listeners.afterChoose) {
			me.choose.listeners.afterChoose.call (me, oldValue, value);
		};
	},
	setValue: function (v) {
		var me = this;
		me.value = v;
		if (v) {
			var o = $o.getObject (v);
			if (o) {
				v = o.toString ();
			} else {
				v = null;
			};
		};
		if (me.valueField) {
			me.valueField.setValue (v);
			if (v) {
				Ext.tip.QuickTipManager.register ({
					target: me.valueField.id,
					text: v,
					width: 300,
					dismissDelay: 3000
				});			
			} else {
				Ext.tip.QuickTipManager.unregister (me.valueField.getEl ());
			};
		};
		me.fireEvent ("change", me.value);
	},
	getValue: function () {
		return this.value;
	},
	setReadOnly: function (ro) {
		var me = this;
		me.ro = ro;
		if (ro) {
			me.items.getAt (0).hide ();
			me.items.getAt (1).hide ();
			me.addCls ("readonly-field");
		} else {
			me.items.getAt (0).show ();
			me.items.getAt (1).show ();
			me.removeCls ("readonly-field");
		};
	},
	validate: function () {
		return this.valueField.validate.call (this.valueField, arguments);
	},
	isValid: function () {
		return this.valueField.isValid.call (this.valueField, arguments);
	}
});
/*
	DateTimeField
*/
Ext.define ("$o.DateTimeField.Widget", {
	extend: "Ext.form.FieldContainer",
	alias: ["widget.datetimefield", "widget.$datetimefield"],
	layout: "hbox",
	initComponent: function () {
		var me = this;
		me.items = [{
			xtype: "datefield",
			width: 90,
			readOnly: me.readOnly,
			listeners: {
				render: function (c) {
					me.dateField = c;
					if (me.value) {
						me.setValue (me.value);
					};
				},
				focus: function () {
					me.fireEvent ("focus", me);
				}
			}
		}, {
			xtype: "timefield",
			width: 80,
			readOnly: me.readOnly,
			style: {
				marginLeft: 1
			},
			listeners: {
				render: function (c) {
					me.timeField = c;
					if (me.value) {
						me.setValue (me.value);
					};
				},
				focus: function () {
					me.fireEvent ("focus", me);
				}
			}
		}];
		me.callParent (arguments);
	},
	setValue: function (v) {
		var me = this;
		me.value = v;
		if (me.dateField && me.timeField) {
			me.dateField.setValue (v);
			me.timeField.setValue (v);
		};
	},
	getValue: function () {
		var v = this.dateField.getValue ();
		var tv = this.timeField.getValue ();
		if (tv) {
			v.setHours (tv.getHours ());
			v.setMinutes (tv.getMinutes ());
			v.setSeconds (tv.getSeconds ());
		};
		return v;
	}
});
/*
	$multiselect (title, toolbar)
*/
Ext.define ("$o.MultiSelect.Widget", {
	extend: "Ext.panel.Panel",
	alias: "widget.$multiselect",
	border: true,
	layout: "fit",
	initComponent: function () {
		var me = this;
		me.title = me.fieldLabel || me.title;
		var listeners = {
			render: function (c) {
				me.$multiselect = c;
			}
		};
		if (me.listeners && me.listeners.change) {
			listeners.change = me.listeners.change;
		};
		me.items = {
			xtype: "multiselect",
			store: me.store,
			valueField: me.valueField,
			displayField: me.displayField,
			ddReorder: me.ddReorder,
			listeners: listeners
		};
		me.callParent (arguments);
	},
	getStore: function () {
		return this.$multiselect.getStore ();
	},
	getValue: function () {
		return this.$multiselect.getValue ();
	}
});
/*
	FileField
*/
Ext.define ("$o.FileField.Widget", {
	extend: "Ext.form.FieldContainer",
	alias: "widget.$filefield",
	layout: "hbox",
	initComponent: function () {
		var me = this;
		me.items = [{
			xtype: "button",
			iconCls: "gi_upload",
			tooltip: $o.getString ("Choose and upload file"),
			disabled: me.readOnly,
			style: {
				marginRight: 1
			},
			handler: function () {
				var fileField = Ext.create ("Ext.form.field.File", {
					fieldLabel: $o.getString ("File"),
					buttonText: $o.getString ("Choose"),
					name: 'file-path'
				});
				var fp = Ext.create ("Ext.form.Panel", {
					defaults: {
						anchor: '95%'
					},
					bodyStyle: 'padding: 10px 10px 0 10px;',
					items: [{
						hidden: true,
						xtype: "textfield",
						name: "objectId",
						value: me.objectId
//						html: '<input type=hidden name=objectId value=' + me.objectId + '>'
					}, {
						hidden: true,
						xtype: "textfield",
						name: "classAttrId",
						value: me.ca.get ("id")
//						html: '<input type=hidden name=classAttrId value=' + me.ca.get ("id") + '>'
					}, 
						fileField
					],
					buttons: [{
						text: $o.getString ("Upload"),
						iconCls: "gi_upload",
						handler: function () {
							me.card.save ({autoSave: true});
							fp.down ("textfield[name=objectId]").setValue (me.objectId);
							fp.getForm ().submit ({
								url: 'upload?sessionId=' + $sessionId + "&username=" + $o.currentUser,
								waitMsg: $o.getString ("File uploading") + " ...",
								success: function (fp, o) {
									if (o.result.success) {
										me.setValue (o.result.file);
										me.card.save (/*{filefield: true}*/);
										win.close ();
										common.message ($o.getString ("File") + " " + o.result.file + " " + $o.getString ("uploaded"));
									} else {
										common.message ($o.getString ("File") + " " + o.result.file + " " + $o.getString ("failed to send"));
									};
								},
								failure: function (form, action) {
									common.message ($o.getString ("File", "failed to send", ".", "Error", ": ") + action.result.error);
								}
							});
						}
					},{
						text: $o.getString ("Remove"),
						iconCls: "gi_remove",
						handler: function () {
							if (!me.getValue ()) {
								return;
							}
							common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
								if (btn == "yes") {
									me.setValue (null);
									me.card.save ({filefield: true}); // todo: erase file on server side
								};
							}});
						}
					}]
				});	
				var win = new Ext.Window ({
					title: $o.getString ("File uploading"),
					resizable: false,
					closable: true,
					height: 114,
					width: 500,
					layout: "fit",
					modal: true,
					items: fp
				});
				win.show ();
			},
			scope: me
		}, {
			xtype: "button",
			iconCls: "gi_download",
			tooltip: $o.getString ("Download"),
			disabled: me.readOnly,
			style: {
				marginRight: 1
			},
			handler: function () {
				me.download ();
			}
		}, {
			xtype: "textfield",
			flex: 1,
			readOnly: true,
			listeners: {
				render: function (c) {
					if (me.value) {
						me.setValue (me.value);
					};
	                //c.getEl ().on ("mousedown", function (e, t, eOpts) {
					//	me.down ("button[iconCls=gi_upload]").handler.call (me);
	                //});
				}
			}
		}];
		me.callParent (arguments);
	},
	setValue: function (v) {
		this.down ("field").setValue (v);
	},
	getValue: function () {
		return this.down ("field").getValue ();
	},
	setReadOnly: function (ro) {
		var me = this;
		if (ro) {
			me.items.getAt (0).hide ();
			me.items.getAt (1).hide ();
			me.addCls ("readonly-field");
		} else {
			me.items.getAt (0).show ();
			me.items.getAt (1).show ();
			me.removeCls ("readonly-field");
		};
	},
	download: function () {
		var me = this;
		var filename = me.getValue ();
		if (filename) {
			var fileUri = "files/" + me.objectId + "-" + me.ca.get ("id") + "-" + filename;
//			var w = window.open (fileUri, "w" + me.objectId + "-" + me.ca.get ("id"), "resizable=yes, scrollbars=yes, status=yes, width=600, height=400");
			var w = window.open (fileUri);
			w.focus ();
		}
	}
});
/*
	ConfField
*/
Ext.define ("$o.ConfField.Widget", {
	extend: "$o.ObjectField.Widget",
	alias: ["widget.conffield", "widget.$conffield"],
	initComponent: function () {
		var me = this;
		me.addEvents ("change");
		me.callParent (arguments);
		me.setValue = function (v) {
			var me = this;
			me.value = v;
			if (v) {
				var o = $o.getConfObject (me.confRef, v);
				v = o.toString ();
			};
			if (me.valueField) {
				me.valueField.setValue (v);
			};
			me.fireEvent ("change", me.value);
		}
	}
});
/*
	CodeMirrorTextArea
*/
Ext.define ("$o.CodeMirrorTextArea.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.codemirrortextarea"],
	layout: "fit",
	border: 0,
	initComponent: function () {
		var me = this;
		me.items = {
			xtype: "textarea",
			width: "100%",
			height: "100%",
			value: me.value,
			listeners: {
				afterrender: function () {
					var ta = this;
					dom = ta.inputEl.dom;
					var makeEditor = function () {
						me.editor = CodeMirror.fromTextArea (dom, {
							lineNumbers: true,
							indentUnit: 4,
							readOnly: false,
							mode: me.mode || "javascript",
							viewportMargin: Infinity
						});
						me.editor.setSize (ta.getWidth (), ta.getHeight ());
						me.editor.on ("change", function () {
							me.fireEvent ("change");
						});
					};
					if (!window.CodeMirror) {
						$o.util.loadCSS ("/third-party/codemirror/codemirror-4.3.css", function () {
							$o.util.loadJS ("/third-party/codemirror/codemirror-4.3.min.js", function () {
								makeEditor ();
							});
						});
					} else {
						makeEditor ();
					};
				},
				resize: function (c, width, height, oldWidth, oldHeight, eOpts) {
					if (me.editor) {
						me.editor.setSize (width, height);
					};
				}
			}
		}; 
		me.addEvents ("change");
		me.callParent (arguments);
	},
	setValue: function (value) {
		var me = this;
		value = value || "";
		if (me.editor) {
			me.editor.setValue (value);
		} else {
			me.down ("textarea").setValue (value);
		};
	},
	getValue: function () {
		var me = this;
		if (me.editor) {
			return this.editor.getValue ();
		} else {
			return me.down ("textarea").getValue ();
		};
	},
	setReadOnly: function (ro) {
		var me = this;
		if (ro) {
			me.disable ();
		} else {
			me.enable ();
		};
	}
});
/*
	IconSelector
*/
Ext.define ("$o.IconSelector.Widget", {
	extend: "Ext.form.FieldContainer",
	alias: ["widget.$o.iconselector", "widget.$iconselector"],
	layout: "hbox",
	fieldLabel: $o.getString ("Icon"),
	initComponent: function () {
		var me = this;
		me.items = [{
			xtype: "button",
			iconCls: "gi_edit",
			name: "choose",
			height: 22,
			handler: me.choose,
			scope: me,
			style: {
				marginRight: 1
			}
		}, {
			xtype: "button",
			iconCls: "gi_remove",
			height: 22,
			style: {
				marginRight: 5
			},
			handler: function () {
				me.setValue (null);
				me.fireEvent ("change", null);
			}
		}, {
			xtype: "button",
			name: "icon",
			width: 22,
			height: 22,
			iconCls: me.value,
			handler: me.choose,
			scope: me,
			style: {
				marginRight: 1
			}
		}, {
			xtype: "textfield",
			name: "name",
			flex: 1,
			readOnly: true,
			value: me.value ? me.value : "",
			listeners: {
				render: function (c) {
	                c.getEl ().on ("mousedown", function (e, t, eOpts) {
						me.down ("button[name=choose]").handler.call (me);
	                });
				}
			}
		}]; 
		me.addEvents ("change");
		me.callParent (arguments);
	},
	getValue: function () {
		var me = this;
		return me.value;
	},
	setValue: function (value) {
		var me = this;
		me.value = value;
		me.down ("button[name='icon']").setIconCls (value ? value : "");
		me.down ("textfield[name='name']").setValue (value ? value : "");
	},
	getIconData: function () {
		var result = [];
		var ss = document.styleSheets;
		for (var i = 0; i < ss.length; i ++) {
			var href = ss [i].href;
			if (href && href.indexOf ("images.css") != -1) {
				var rules = ss [i].cssRules;
				if (!rules) {
					rules = ss [i].rules;
				};
				for (var j = 0; j < rules.length; j ++) {
					var v = rules [j].selectorText;
					if (!v) {
						continue;
					};
					if (v.length) {
						v = v.substr (1);
					};
					if (v.substr (0, 3) != "gi_") {
						continue;
					};
					var o = {};
					var url = rules [j].cssText;
					url = url.split ("(")[1].split (")")[0];
					o.url = url;
					o.iconCls = v;
					result.push (o);
				}
			}
		}
		var cmp = function (o1, o2) {
			var v1 = o1.iconCls;
			var v2 = o2.iconCls;
			if (v1 > v2) {
				return 1;
			} else if (v1 < v2) {
				return -1;
			} else {
				return 0;		
			}
		};
		result.sort (cmp);
		return result;
	},
	setReadOnly: function (ro) {
		var me = this;
		if (ro) {
			me.down ("button[name='choose']").disable ();
		} else {
			me.down ("button[name='choose']").enable ();
		};
	},
	choose: function () {
		var me = this;
		var data = me.getIconData ();
		var onClick = function () {
			win.close ();
			me.setValue (this.iconCls);
			me.fireEvent ("change", this.iconCls);
		};
		var items = [], row = [];
		for (var i = 0; i < data.length; i ++) {
			row.push ({
				iconCls: data [i].iconCls
			});
			if (row.length > 20) {
				items.push ({
					layout: "hbox",
					defaults: {
						xtype: "button",
						handler: onClick,
						style: "margin-right: 1px; margin-bottom: 1px"
					},
					items: row
				});
				row = [];
			};
		};
		if (row.length) {
			items.push ({
				layout: "hbox",
				defaults: {
					xtype: "button",
					handler: onClick,
					style: "margin-right: 1px; margin-bottom: 1px"
				},
				items: row
			});
		};
		var win = Ext.create ("Ext.Window", {
			width: 500,
			height: 570,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: $o.getString ("Choose icon"),
			bodyPadding: 5,
			modal: 1,
			items: {
				layout: "vbox",
				border: 0,
				defaults: {
					border: 0
				},
				items: items
			}
		});
		win.show ();
	}
});

});

/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
*/

/*
	Card
*/
Ext.define ("$o.Card.Widget", {
	//extend: "Ext.form.Panel",
	extend: "Ext.panel.Panel",
	layout: "vbox",
	objectumCmp: "card",
	defaults: {
		width: "100%"
	},
	alias: ["widget.$o.card", "widget.$card"],
	bodyPadding: 5,
	autoScroll: true,
	initComponent: function () {
		var me = this;
		me.items = me.items || me.fields;
//		me.setFieldValues ();
		me.on ("beforerender", me.beforeRenderListener, me);
		me.on ("afterrender", me.afterRenderListener, me);
		me.on ("beforedestroy", me.beforeDestroyListener, me);
		me.$items = me.items;
		me.items = undefined;
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
		me.$source = null;
		me.buildToolbar ();
		me.addEvents ("beforeSave", "aftersave", "refresh");
		me.processListeners ();
		me.readOnly = me.readOnly || $o.isReadOnly ();
		me.on ("destroy", function () {
			me.disableUnloadMessage ();
		});
		me.callParent (arguments);
	},
	setFieldValues: function () {
		var me = this;
		_.each (me.items, function (item) {
			if (item.objectId && item.attr && !item.value) {
				try {
					item.value = $o.getObject (item.objectId).get (item.attr);
				} catch (e) {
				};			
			};
		});
	},
	processListeners: function () {
		var me = this;
		me.listeners = me.listeners || {};
		me.listeners.scope = me.listeners.scope || me;
		for (var i in me.listeners) {
			if (i == "scope") {
				continue;
			};
			var l = me.listeners [i];
			if (typeof (l) == "string") {
				try {
					l = me.listeners [i] = eval (l);
				} catch (e) {
				};
			};
			if (typeof (l) == "function") {
				me.on (i, l, me.listeners.scope);
			} else {
				if (l.fn) {
					if (typeof (l.fn) == "string") {
						// vo
						try {
							var fn = eval (l.fn);
							var args = l.arguments || {};
							args.card = me;
							l.fn = _.bind (fn, me, args);
							/*
							l.fn = function () {
								fn.call (me, args);
							};
							*/
						} catch (e) {
							console.error (l.fn, e);
						};
						/*
						var args = l.arguments || {};
						l.fn = eval (
							"function () {\n" + 
							"\tvar args = " + JSON.stringify (args) + ";\n" +
							"\targs.card = this;\n" +
							"\t" + l.fn + ".call (args);\n" +
							"}"
						);
						args.card = me;
						*/
					} else {
						me.on (i, l.fn, l.scope || me.listeners.scope);
					};
				};
			};
		};
	},
	beforeRenderListener: function () {
		this.createFields ();
	},
	afterRenderListener: function () {
		var me = this;
		_.each (me.getItems (), function (item) {
			item.on ("change", function () {
				if (!me.autoSave) {
					if (this.originalValue != this.getValue ()) {
						me.enableUnloadMessage ();
					};
				};
			});
		});
		me.refresh ();
		var container = me.up ("window") || me.up ("*[isTab=1]");
		if (container) {
			var onBeforeClose = function () {
				if (me.enabledUnloadMessage) {
					common.confirm ({message: $o.getString ("Data is not saved. Close?"), scope: this, fn: function (btn) {
						if (btn == "yes") {
							container.un ("beforeclose", onBeforeClose);
							container.close ();
						};
					}});
					return false;
				};
			};
			container.on ("beforeclose", onBeforeClose);
		};
	},
	beforeDestroyListener: function () {
		if (this.autoSave) {
			this.save ({autoSave: true});
		};
	},
	getClassAttr: function (item) {
		var me = this;
		var r;
		if (item.objectId) {
			var o = $o.getObject (item.objectId);
			if (!o) {
				console.error ("bad objectId", item);
			};
			r = o.getClassAttr (item.attr);
			if (r) {
				item.$attr = item.attr;
			} else {
//				common.message ("Атрибут отсутствует: " + item.attr);
				r = -1;
			};
		} else 
		if (item.id && item.attr) {
			var objAttr = item.attr.split (".")[0];
			var attr = item.attr.split (".")[1];
			me.$source = me.relatives [item.id];
			me.relatives [item.id].targets [me.zid] = me;
//			var viewId = me.relatives [item.id].viewId;
//			var attrs = $o.viewsMap [viewId].attrs;
			var attrs = me.relatives [item.id].$view.attrs;
			var cls;
			if (attrs [objAttr].get ("classAttr")) {
				var caId = attrs [objAttr].get ("classAttr");
				var ca = $o.classAttrsMap [caId];
				cls = $o.classesMap [ca.get ("type")];
			} else {
				cls = $o.classesMap [attrs [objAttr].get ("class")];
			};
			r = cls.attrs [attr];
			if (r) {
				item.$relative = me.relatives [item.id];
				item.$objAttr = objAttr;
				item.$attr = attr;
				item.id = undefined;
			} else {
//				common.message ("Атрибут отсутствует: " + item.attr);
				r = -1;
			};
		};
		return r;
	},
	updateItem: function (item, ca, parentItem) {
		var me = this;
		var fieldType = ca.getFieldType ();
		var n = {
			fieldLabel: item.caption || item.fieldLabel || ca.get ("name"),
			xtype: fieldType,
			card: this,
			ca: ca
		};
		if (me.readOnly) {
			n.readOnly = true;
		};
		if (ca.get ("secure")) {
			n.inputType = "password";
		};
		if (ca.get ("notNull")) {
			item.allowBlank = false;
		};
		if (item.objectId) {
			var o = $o.getObject (item.objectId);
			n.value = n.originalValue = o.get (item.attr);
		};
		if (fieldType == "textfield" || fieldType == "objectfield" || fieldType == "$filefield") {
			if (!item.width) {
				n.anchor = "-20";
			};
		};
		if (fieldType == "textfield" && item.height) {
			n.xtype = "textarea";
		};
		if (fieldType == "numberfield") {
			n.keyNavEnabled = false;
			n.decimalPrecision = 3;
		};
		if (fieldType == "datefield" && (!item.hasOwnProperty ("timefield") || item.timefield)) {
			n.xtype = "datetimefield";
		};
		if (parentItem && parentItem.xtype == "compositefield") {
			n.style = {
				marginRight: 5
			};
			delete n.fieldLabel;
		};
		item.listeners = item.listeners || {};
		item.listeners.focus = function () {
			if (me.down ("*[name=fieldChanges]")) {
				me.down ("*[name=fieldChanges]").enable ();
			};
			me.focusedField = this;
		};
		/*
		item.listeners.change = function () {
			if (!me.autoSave) {
				me.enableUnloadMessage ();
			};
		};
		*/
		if (item.allowBlank == false) {
			// Чтобы не позволял сохранить пустое поле
			if (!item.listeners.afterrender) {
				item.listeners.afterrender = function () {
					if (this.validate) {
						this.validate ();
					};
				};
			};
		};
		n.vtype = ca.getVType ();
		Ext.applyIf (item, n);
	},
	createFields: function () {
		var me = this;
		var processItem = function (item, parentItem) {
			if (!item) {
				console.log (item, parentItem);
			};
			var ca = me.getClassAttr (item);
			if (ca == -1) {
				Ext.apply (item, {
					xtype: "textfield",
					anchor: "-20",
					fieldLabel: item.caption || item.fieldLabel || "unknown",
					labelStyle: "color: red;",
					style: "color: red;",
					readOnly: true,
					value: $o.getString ("Attribute not exists in storage")
				});
			} else
			if (ca) {
				me.updateItem (item, ca, parentItem);
			};
			if (item.items) {
				for (var i = 0; i < item.items.length; i ++) {
					processItem (item.items.getAt ? item.items.getAt (i) : item.items [i], item);
				};
			};
		};
		for (var i = 0; i < me.$items.length; i ++) {
			processItem (me.$items [i], null);
		};
		me.add (me.$items);
		me.doLayout ();
	},
	getItems: function (options) {
		var me = this;
		var items = [];
		var get = function (item) {
			if (item.$attr && (
				(options && options.hidden) || (item.isVisible && item.isVisible ())
			)) {
				items.push (item);
			};
			if (item.items) {
				for (var i = 0; i < item.items.getCount (); i ++) {
					get (item.items.getAt (i));
				};
			};
		};
		for (var i = 0; i < me.items.getCount (); i ++) {
			get (me.items.getAt (i));
		};
		return items;
	},
	getFields: function (options) {
		var me = this;
		var fields = {};
		var items = me.getItems (options);
		for (var i = 0; i < items.length; i ++) {
			var item = items [i];
			if (item.$attr) {
				fields [item.$attr] = item;
			};
		};
		return fields;
	},
	updateFields: function () {
		var me = this;
		var items = me.getItems ();
		for (var i = 0; i < items.length; i ++) {
			var item = items [i];
			if (!item.$attr) {
				continue;
			};
			var objectId = item.objectId = item.$relative ? item.$relative.getCurrentValue (item.$objAttr) : item.objectId;
			var o = $o.getObject (objectId);
			if (!item.setValue) {
				console.log (item);
			};
			item.setValue (o.get (item.$attr));
			item.originalValue = o.get (item.$attr);
		};
	},
	activeCondition: function () {
		var me = this;
		if (me.active) {
			var active = me.active.fn.call (me, me.active.arguments);
			var items = me.getItems ();
			for (i = 0; i < items.length; i ++) {
				var item = items [i];
				if (item.readOnly) {
					continue;
				};
				item.setReadOnly (!active);
			}
			if (!me.readOnly && !me.hideToolbar && !me.autoSave) {
				var tb = me.getDockedItems ("toolbar[dock='top']");
				if (tb && tb.length) {
					tb [0].setDisabled (!active);
				};
			}
		};
	},
	refresh: function () {
		var me = this;
		var src = me.$source;
		if (src) {
			if (src.getSelectionModel ().hasSelection ()) {
				me.setDisabled (false);
				me.updateFields ();
			} else {
				me.setDisabled (true);
			};
		} else {
			me.updateFields ();
		};
		me.activeCondition ();
		for (var id in this.targets) {
			var w = this.targets [id];
			if (w.refresh) {
				w.refresh ({moveFirst: 1});
			};
		};
		me.disableUnloadMessage ();
		me.fireEvent ("refresh");
	},
	save: function (options) {
		options = options || {};
		var me = this;
		var saveFn = function () {
			var items = me.getItems ();
			var objects = {};
			var changed = false;
			for (var i = 0; i < items.length; i ++) {
				var item = items [i];
				if (options.filefield && item.xtype != "$filefield") {
					continue;
				};
				var objectId = item.objectId;
				if (!objectId) {
					continue;
				};
				var o = $o.getObject (objectId);
				if (!o) {
					continue;
				};
				objects [objectId] = o;
				var v = item.getValue ();
				if (o.get (item.$attr) != v) {
					if (o.getClassAttr (item.$attr).get ("secure")) {
						v = $o.util.sha1 (v);
					};
					o.set (item.$attr, v);
					changed = true;
				};
			};
			if (changed || me.hasListener ("beforeSave") || me.hasListener ("aftersave")) {
				$o.startTransaction ({description: "Card saving"});
				try {
					try {
						me.fireEvent ("beforeSave", {card: me});
					} catch (e) {
						console.error (e);
					};
					for (var objectId in objects) {
						var o = objects [objectId];
						o.commit ("local");
						if (objectId < 0) {
							_.each (items, function (item) {
								if (item.objectId == objectId) {
									item.objectId = o.get ("id");
								}
							});
						}
					};
					try {
						me.fireEvent ("aftersave", {card: me});
					} catch (e) {
						console.error (e);
						console.error (e.stack);
					};
					$o.commitTransaction ();
					if (me.$source) {
						me.$source.refresh ();
					};
				} catch (e) {
					if (me.getEl ()) {
						me.getEl ().unmask (true);
					};
					common.message ("<font color=red>" + $o.getString ("Could not save data") + "</font><br>Error: " + e + "<br>Stack: " + e.stack);
					$o.rollbackTransaction ();
					throw e;
				};
			};
			if (!options.autoSave) {
				if (me.getEl ()) {
					me.getEl ().unmask (true);
				};
				me.disableUnloadMessage ();
			};
			for (var id in me.targets) {
				var w = me.targets [id];
				if (w.refresh) {
					w.refresh ({moveFirst: 1});
				};
			};
			if (options && options.success) {
				options.success.call (options.scope || me);
			};
			if (me.up ("window") && common.getConf ({code: "closeWindowAfterSave"}).used) {
				me.up ("window").close ();
				common.message ($o.getString ("Information saved"));
			}
		};
		if (options.autoSave) {
			saveFn ();
		} else {
			var items = me.getItems ();
			var msg = "";
			for (var i = 0; i < items.length; i ++) {
				var item = items [i];
				if (item.getActiveError && item.getActiveError ()) {
					var name = item.fieldLabel;
					if (!name && item.ownerCt && item.ownerCt.fieldLabel)  {
						name = item.ownerCt.fieldLabel;
					};
					msg += "<b>" + name + ": " + (item.getValue () == null ? "" : item.getValue ()) + "</b> " + item.getActiveError () + "<br>";
				};
			};
			if (msg) {
				common.message ("<font color=red>" + $o.getString ("Form contains errors") + ":</font><br><br>" + msg);
			} else {
				if (me.getEl ()) {
					me.getEl ().mask ("Сохранение ...");
				};
				setTimeout (saveFn, 300);
			};
		};
	},
	onHighlight: function () {
		var me = this;
		var objectId = [];
		_.each (me.query ("*"), function (c) {
			if (c.objectId) {
				objectId.push (c.objectId);
			}
		});
		objectId = _.uniq (objectId);
		var rows = $o.execute ({
			asArray: true,
			"select": [
				{"a":"___fobject_id"}, "objectId",
				{"b":"___fcode"}, "classAttrCode"
			],
			"from": [
				{"a":"system.object_attr"},
				"left-join", {"b":"system.class_attr"}, "on", [{"a":"___fclass_attr_id"}, "=", {"b":"___fid"}]
			],
			"where": [
				{"a":"___fobject_id"}, "in", objectId.join (".,.").split (".")
			]
		});
		var changeNum = {};
		_.each (rows, function (row) {
			changeNum [row.objectId] = changeNum [row.objectId] || {};
			changeNum [row.objectId][row.classAttrCode] = changeNum [row.objectId][row.classAttrCode] || 0;
			changeNum [row.objectId][row.classAttrCode] ++;
		});
		_.each (me.query ("*"), function (c) {
			if (c.objectId && changeNum [c.objectId] && changeNum [c.objectId][c.attr] > 1) {
				c.setFieldStyle ("border: 2px solid orange");
			}
		});
	},
	onFieldChanges: function (_objectId, _attr) {
		var me = this;
		var objectId = typeof (_objectId) == "number" ? _objectId : me.focusedField.objectId;
		var attr = typeof (_objectId) == "number" ? _attr : me.focusedField.$attr;
		var o = $o.getObject (objectId);
		var cls = $o.getClass (o.get ("classId"));
		var ca = cls.attrs [attr];
		var r = $o.execute ({
			"select": [
				{"a":"___fid"}, "fid",
				{"a":"___fstring"}, "fstring",
				{"a":"___fnumber"}, "fnumber",
				{"a":"___ftime"}, "ftime",
				{"b":"___fdate"}, "fdate",
				{"b":"___fsubject_id"}, "fsubject_id",
				{"b":"___fremote_addr"}, "fremote_addr",
				{"b":"___fdescription"}, "fdescription",
				{"c":"name"}, "subject"
			],
			"from": [
				{"a":"system.object_attr"},
				"left-join", {"b":"system.revision"}, "on", [{"a":"___fstart_id"}, "=", {"b":"___fid"}],
				"left-join", {"c":"subject"}, "on", [{"b":"___fsubject_id"}, "=", {"c":"id"}]
			],
			"where": [
				{"a":"___fobject_id"}, "=", objectId, "and", {"a":"___fclass_attr_id"}, "=", ca.get ("id")
			],
			"order": [
				{"b":"___fdate"}, "desc"
			]
		});
		var data = [];
		for (var i = 0; i < r.length; i ++) {
			var subject;
			if (r.get (i, "fsubject_id")) {
				var oSubject = $o.getObject (r.get (i, "fsubject_id"));
				var subject = _.filter (_.map (["login", "surname", "forename", "patronymic", "email", "phone"], function (s) {
					return oSubject.get (s);
				}), function (s) {
					if (s) {
						return true;
					};
				}).join (", ");
			} else {
				subject = "admin";
			};
			var o = {
				date: r.get (i, "fdate"),
				subject: subject,
				ip: r.get (i, "fremote_addr"),
				description: r.get (i, "fdescription")
			};
			var value = "";
			if (r.get (i, "fstring")) {
				value = r.get (i, "fstring");
			} else
			if (r.get (i, "ftime")) {
				value = common.getTimestamp (r.get (i, "ftime"));
			} else
			if (r.get (i, "fnumber")) {
				value = r.get (i, "fnumber");
				if (ca.get ("type") >= 1000) {
					var oValue = $o.getObject (r.get (i, "fnumber"));
					value = oValue.toString ();
				};
			};
			o.value = value;
			data.push (o);
		};
	    var store = Ext.create ("Ext.data.Store", {
	        data: data,
	        fields: [{
	        	name: "date", type: "string"
			}, {
	        	name: "value", type: "string"
			}, {
	        	name: "subject", type: "string"
			}, {
	        	name: "ip", type: "string"
			}, {
	        	name: "description", type: "string"
	        }]
	    });
		var cellRenderer = function (value, metaData, record, rowIndex, colIndex, store) {
			if (value) {
				var tip = value;
				tip = tip.split ('"').join ("'");
				metaData.tdAttr = 'data-qtip="' + tip + '"';
			};
			metaData.style = "white-space: normal;";
			return value;
		};
		var grid = Ext.create ("Ext.grid.Panel", {
			store: store,
			columns: [{
				header: $o.getString ("Date"), width: 100, dataIndex: "date", renderer: cellRenderer
			}, {
				header: $o.getString ("Value"), width: 150, dataIndex: "value", renderer: cellRenderer
			}, {
				header: $o.getString ("User"), width: 150, dataIndex: "subject", renderer: cellRenderer
			}, {
				header: "IP", width: 100, dataIndex: "ip", renderer: cellRenderer
			}, {
				header: $o.getString ("Revision comment"), width: 150, dataIndex: "description", renderer: cellRenderer, hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		var win = new Ext.Window ({
			title: $o.getString ("Revision History"),
			resizable: true,
			closable: true,
			modal: true,
			width: 600,
			height: 600,
			border: false,
			iconCls: "gi_history",
			layout: "fit",
			items: grid
		});
		win.show ();
	},
	buildToolbar: function () {
		var me = this;
		me.tbarUser = me.tbar || [];
		me.tbar = [];
		if (!me.hideToolbar && !me.readOnly && !me.autoSave && !$o.isReadOnly ()) {
			me.tbar = [{
				text: $o.getString ("Save"),
				iconCls: "save",
				handler: me.save,
				scope: me
			}, {
				text: $o.getString ("Refresh"),
				iconCls: "refresh",
				handler: me.refresh,
				scope: me
			}];
			if (me.showSaveAndClose) {
				me.tbar.push ({
					text: $o.getString ("Save and close"),
					iconCls: "ok",
					handler: function () {
						this.save ({success: function () {
							this.up ("window").close ();
						}});
					},
					scope: me
				});
			};
			if ($o.visualObjectum && $o.visualObjectum.timeMachine && $o.visualObjectum.timeMachine.cardButton) {
				if ($o.visualObjectum.timeMachine.cardHighlight || window.monu) {
					me.tbar.push ({
						text: $o.getString ("Changes"),
						iconCls: "gi_history",
						menu: [{
							text: $o.getString ("Revision History"),
							iconCls: "gi_history",
							name: "fieldChanges",
							disabled: 1,
							handler: me.onFieldChanges,
							scope: me
						}, {
							text: $o.getString ("Show changed fields"),
							iconCls: "gi_history",
							handler: me.onHighlight,
							scope: me
						}]
					});
				} else {
					me.tbar.push ({
						text: $o.getString ("Changes"),
						iconCls: "gi_history",
						name: "fieldChanges",
						disabled: 1,
						handler: me.onFieldChanges,
						scope: me
					});
				}
			};
		};
		for (var i = 0; i < me.tbarUser.length; i ++) {
			me.tbar.push (me.tbarUser [i]);
		};
	},
	/*
		Возвращает массив с измененными полями (attr, oldValue, newValue).
	*/
	getChanged: function () {
		var me = this;
		var result = [];
		var items = me.getItems ();
		for (i = 0; i < items.length; i ++) {
			var item = items [i];
			if (item.isDirty ()) {
				var value = item.getValue ();
				if (item.ca.get ("secure")) {
					value = $o.util.sha1 (value);
				};
				var o = {};
				o.attr = item.$attr;
				o.oldValue = item.originalValue;
				o.newValue = value;
				o.fieldLabel = item.fieldLabel;
				o.xtype = item.xtype;
				result.push (o);
			};
		};
		return result;
	},
	enableUnloadMessage: function () {
		this.enabledUnloadMessage = true;
		window.onbeforeunload = function (evt) {
		    var message = $o.getString ("Data is not saved. You will lose changes if you leave the page");
		    if (typeof evt == "undefined") {
		        evt = window.event;
		    };
		    if (evt) {
		        evt.returnValue = message;
		    };
		    return message;
		};
	},
	disableUnloadMessage: function () {
		this.enabledUnloadMessage = false;
		window.onbeforeunload = undefined;
	}
});

/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
	Configurator card (class, classAttr, view, viewAttr)
*/
Ext.define ("$o.CardConf.Widget", {
	extend: "$o.Card.Widget",
	alias: ["widget.$o.cardConf", "widget.$cardConf"],
	initComponent: function () {
		var me = this;
		me.callParent (arguments);
	},
	updateItem: function (item, parentItem) {
		var me = this;
		var n = {
			fieldLabel: item.fieldLabel || item.attr,
			xtype: "textfield",
			anchor: "-20",
			card: me,
			conf: item.conf
		};
		if (me.readOnly) {
			n.readOnly = true;
		};
		if (item.confRef) {
			n.xtype = "conffield";
		};
		if (typeof (item.id) == "number") {
			n.confId = item.id;
			var o = $o.getConfObject (item.conf, item.id);
			if (o) {
				n.value = n.originalValue = o.get (item.attr);
				item.$attr = item.attr;
			};
		} else 
		if (typeof (item.id) == "string") {
			var idAttr = item.attr.split (".")[0];
			var attr = item.attr.split (".")[1];
			me.$source = me.relatives [item.id];
			me.relatives [item.id].targets [me.zid] = me;
			n.$relative = me.relatives [item.id];
			n.$idAttr = idAttr;
			n.$attr = attr;
		};
		if (parentItem && parentItem.xtype == "compositefield") {
			n.style = {
				marginRight: 5
			};
			delete n.fieldLabel;
		};
		delete item.id;
		Ext.applyIf (item, n);
	},
	createFields: function () {
		var me = this;
		var processItem = function (item, parentItem) {
			if (item.conf && item.id && item.attr) {
				me.updateItem (item, parentItem);
			};
			if (item.items) {
				for (var i = 0; i < item.items.length; i ++) {
					processItem (item.items.getAt ? item.items.getAt (i) : item.items [i], item);
				};
			};
		};
		for (var i = 0; i < me.$items.length; i ++) {
			processItem (me.$items [i], null);
		};
		me.add (me.$items);
		me.doLayout ();
	},
	updateFields: function () {
		var me = this;
		var items = me.getItems ();
		for (var i = 0; i < items.length; i ++) {
			var item = items [i];
			if (!item.$attr) {
				continue;
			};
			var confId = item.confId = item.$relative ? item.$relative.getCurrentValue (item.$idAttr) : item.confId;
			if (confId) {
				var o = $o.getConfObject (item.conf, confId);
				if (!item.setValue) {
					console.log (item);
				};
				item.setValue (o.get (item.$attr));
				item.originalValue = o.get (item.$attr);
			};
		};
	},
	save: function (options) {
		options = options || {};
		var me = this;
		var saveFn = function () {
			var items = me.getItems ();
			var objects = {};
			var changed = false;
			for (var i = 0; i < items.length; i ++) {
				var item = items [i];
				var confId = item.confId;
				if (!confId) {
					continue;
				};
				var o = $o.getConfObject (item.conf, confId);
				if (!o) {
					continue;
				};
				objects [confId] = o;
				var v = item.getValue ();
				if (o.get (item.$attr) != v) {
					o.set (item.$attr, v);
					changed = true;
				};
			};
			if (changed) {
				me.fireEvent ("beforeSave");
				$o.startTransaction ({description: "CardConf saving"});
				try {
					for (var confId in objects) {
						var o = objects [confId];
						o.sync ();
					};
					me.fireEvent ("afterSave");
					$o.commitTransaction ();
					if (me.$source) {
						me.$source.refresh ();
					};
				} catch (e) {
					if (me.getEl ()) {
						me.getEl ().unmask (true);
					};
					$o.rollbackTransaction ();
					throw e;
				};
			};
			if (me.getEl ()) {
				me.getEl ().unmask (true);
			};
			if (options && options.success) {
				options.success.call (options.scope || me);
			};
		};
		var items = me.getItems ();
		var msg = "";
		for (var i = 0; i < items.length; i ++) {
			var item = items [i];
			if (item.getActiveError && item.getActiveError ()) {
				var name = item.fieldLabel;
				if (!name && item.ownerCt && item.ownerCt.fieldLabel)  {
					name = item.ownerCt.fieldLabel;
				};
				msg += "<b>" + name + ": " + (item.getValue () == null ? "" : item.getValue ()) + "</b> " + item.getActiveError () + "<br>";
			};
		};
		if (msg) {
			common.message ("<font color=red>" + $o.getString ("Form contains errors") + ":</font><br><br>" + msg);
		} else {
			if (me.getEl ()) {
				me.getEl ().mask ($o.getString ("Saving") + " ...");
			};
			setTimeout (saveFn, 100);
		};
	}
});

/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

Ext.define ("$o.Tree.Widget", {
	extend: "Ext.tree.Panel",
	mixins: {
		baseGrid: "$o.Base.Grid"
	},
	alias: ["widget.$o.tree"],
    useArrows: true,
    rootVisible: false,
    multiSelect: true,
	columnLines: true,
	rowLines: true,
	scroll: true,
	layout: "anchor",
  	initComponent: function () {		
		var me= this;
		var view = me.$view = me.queryId ? $o.viewsMap [me.queryId] : $o.getView ({code: me.$query});
		var viewId = me.viewId = view.get ("id");
		var query = view.get ("query");
		delete me.query;
		var fields = me.createViewModel ({view: view});
		Ext.define ("$o.View." + viewId + ".Model", {
			extend: "Ext.data.Model",
			fields: fields
		});
		me.columns = [];
	    // Открытые узлы (id)
	    me.$opened = [];
		for (var i = 0; i < fields.length; i ++) {
			var f = fields [i];
			var column = {
				text: $o.getString (f.header),
				tooltip: $o.getString (f.header),
				dataIndex: f.name,
				hidden: f.area != 1,
				width: f.width,
				renderer: me.cellRenderer,
				scope: me
            };
			if (!i) {
				column.xtype = "treecolumn";
				column.locked = true;
			};
			if (f.type == "bool") {
				column.renderer = function (v, meta, rec, row, col, store) {
					if (v) {
						v = "Да";
					} else {
//					if (v == 0 || v == false) {
						v = "Нет";
					};
					return me.cellRenderer (v, meta, rec, row, col, store);
				};
//				column.xtype = "booleancolumn";
//				column.trueText = "Да";
//				column.falseText = "Нет";
			};
			me.columns.push (column);
		};
	    me.store = Ext.create ("Ext.data.TreeStore", {
	        model: "$o.View." + viewId + ".Model",
	        autoLoad: false,
	        root: {
	        	expanded: false
	        },
	        proxy: {
	            type: "ajax",
				api: {
					"create": "treegrid?create=1&id=" + viewId + "&cmpId=" + me.id + "&fieldParent=" + me.fields.parent + "&fieldId=" + me.fields.id,
					"read": "treegrid?read=1&id=" + viewId + "&cmpId=" + me.id + "&fieldParent=" + me.fields.parent + "&fieldId=" + me.fields.id,
					"update": "treegrid?update=1&id=" + viewId + "&cmpId=" + me.id + "&fieldParent=" + me.fields.parent + "&fieldId=" + me.fields.id,
					"delete": "treegrid?delete=1&id=" + viewId + "&cmpId=" + me.id + "&fieldParent=" + me.fields.parent + "&fieldId=" + me.fields.id
				}
	            //reader: {
	            //	idProperty: "task"
	            //}
	        },
//	        folderSort: true,
	        listeners: {
	        	load: me.loadListener,
				expand: me.expandListener,
				collapse: me.collapseListener,
	        	scope: me
	        }
	    });
		me.selModel = Ext.create ("Ext.selection.TreeModel", {
			mode: me.singleSelect == false ? "MULTI" : "SINGLE",
			listeners: {
				beforeselect: {
					fn: me.beforeSelectListener,
					scope: me
				},
				selectionchange: {
					fn: me.selectionChangeListener,
					scope: me
				}
			}
		});
		me.bbar = [{
			iconCls: "refresh",
			handler: me.refresh,
			scope: me
		}];
		me.on ("beforerender", me.beforeRenderListener, me);
		me.on ("render", me.renderListener, me);
		me.on ("itemdblclick", function () {
			me.userEventListener ({event: "dblclick"});
		}, me);
		me.on ("cellcontextmenu", function () {
			me.getSelectionModel ().deselectAll ();
		}, me);
		me.buildToolbar ();
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
        me.callParent (arguments);
    },
	beforeRenderListener: function () {
		if (this.getFilter ()) {
			this.store.getRootNode ().expand ();
		};
	},
	renderListener: function () {
		this.checkActions ();
	},
	expandListener: function (rec) {
		if (rec.isRoot ()) {
			return;
		};
		if (this.$opened.indexOf (rec.get (this.fields.id)) == -1) {
			this.$opened.push (rec.get (this.fields.id))
		};
	},
	collapseListener: function (rec) {
		if (rec.isRoot ()) {
			return;
		};
		this.$opened.splice (this.$opened.indexOf (rec.get (this.fields.id)), 1)
	},
	refresh: function (options) {
		var me = this;
		options = options || {};
		var callback = options.callback;
		var record;
		if (me.getSelectionModel ().hasSelection ()) {
			record = me.getSelectionModel ().getSelection ();
			record = record [0];
		};
		if (me.getFilter ()) {
			if (me.store.getRootNode ().isExpanded ()) {
//				me.store.load (Ext.apply (options, {callback: function () {
				me.store.load ({callback: function () {
					if (record && me.getRootNode ().findChild (me.fields.id, record.get (me.fields.id))) {
						for (var i = 0; i < me.records.length; i ++) {
							var rec = me.records [i];
							if (rec.get (me.fields.id) == record.get (me.fields.id)) {
								me.getSelectionModel ().deselectAll ();
								me.getSelectionModel ().select (rec);
								break;
							};
						};
					};
					//me.getSelectionModel ().select (record);
					if (callback) {
						callback.call (me, record, me.getStore (), true);
					};
				}});
			} else {
				me.store.getRootNode ().expand ();
			};
			this.checkActions ();
		};
	},
	loadListener: function (treeStore, node, records, successful, eOpts) {
		var me = this;
		me.records = me.records || [];
		var fieldId = me.fields.id;
		var process = function (records) {
			for (var i = 0; i < records.length; i ++) {
				var rec1 = records [i];
				var has = false;
				for (var j = 0; j < me.records.length; j ++) {
					var rec2 = me.records [j];
					if (rec1.get (fieldId) == rec2.get (fieldId)) {
						me.records [j] = rec1;
						has = true;
						break;
					};
				};
				if (!has) {
					me.records.push (rec1);
				};
				if (rec1.childNodes) {
					process (rec1.childNodes);
				};
			};
		};
		process (records);
	},
	// {filter: ["&id", "=", id]}
	selectRow: function (options) {
		var me = this;
		if (options.filter) {
			var id = options.filter [2];
			for (var i = 0; i < me.records.length; i ++) {
				var rec = me.records [i];
				if (rec.get (me.fields.id) == id) {
					me.getSelectionModel ().deselectAll ();
					me.getSelectionModel ().select (rec);
					break;
				};
			};
		};
	}
});

/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
*/

Ext.define ("$o.Chart.Widget", {
	extend: "Ext.chart.Chart",
	alias: ["widget.$o.chart"],
    style: 'background:#fff',
    animate: true,
    shadow: true,
    overflowY: "auto",
	initComponent: function () {		
		var me = this;
		var view = me.$view = me.queryId ? $o.viewsMap [me.queryId] : $o.getView ({code: me.$query});
		var viewId = me.viewId = view.get ("id");
		var query = view.get ("query");
		delete me.query;

		var nameFields = [me.attrMark];
		var dataFields = [me.attrValue];
		var data = me.getData ();
		me.store = Ext.create ("Ext.data.Store", {
			fields: ["___name", me.attrMark, me.attrValue],
			data: data
		});
        me.axes = [{
            type: 'Numeric',
            position: 'bottom',
            fields: dataFields,
            minimum: 0,
            label: {
                renderer: Ext.util.Format.numberRenderer ('0,0')
            },
            grid: true,
            title: me.titleValue
        }, {
            type: 'Category',
            position: 'left',
            fields: ["___name"],//me.attrMark],
            title: me.titleMark
        }];
        me.series = [{
            type: 'bar',
            axis: 'bottom',
            xField: me.attrMark,
            yField: dataFields,
            title: nameFields,
            tips: {
                trackMouse: true,
                width: 300,
                height: 50,
                renderer: function (storeItem, item) {
                    this.setTitle (item.value [0] + " (" + storeItem.get ("n" + item.yField.substr (1)) + '): ' + (item.value [1] == null ? "" : item.value [1]));
                }
            },                
            label: {
                display: "insideEnd",
                field: nameFields
            }
        }];
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
        me.callParent (arguments);
    },
    getData: function () {
        var me = this;
        var query = me.$view.get ("query");
        query = JSON.parse (query);
        if (me.filter) {
            query.where = query.where || [];
            if (query.where.length) {
                query.where.push ("and");
            };
            var f = $o.util.clone (me.filter);
            for (var i = 0; i < f.length; i ++) {
                for (var j = 1; j < query.select.length; j += 2) {
                    if (f [i] == query.select [j]) {
                        f [i] = query.select [j - 1];
                    };
                };
                if (f [i] && typeof (f [i]) == "object" && f [i].id && f [i].attr) {
                    me.relatives [f [i].id].targets [me.zid] = me;
                    f [i] = me.relatives [f [i].id].getValue (f [i].attr);
                    if (f [i] == undefined) {
                        me.disable ();
                        return [];
                    } else {
                        me.enable ();
                    };
                };
            };
            query.where.push (f);
        };
        var r = $o.execute ({sql: query});
        var data = [];
        for (var i = 0; i < r.length; i ++) {
            var o = {};
            o [me.attrMark] = r.get (i, me.attrMark);
            o [me.attrValue] = r.get (i, me.attrValue);
            o.___name = "";
            data.push (o);
        };
        return data;
    },
	refresh: function (options) {
        var me = this;
        if (me.refreshing) {
            return;
        };
        me.refreshing = 1;
		var me = this;
		options = options || {};
        me.store.loadData (me.getData ());
        me.redraw ();
        me.refreshing = 0;
	}
});

/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

Ext.define ("$o.Image.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.image"],
    border: 0,
	initComponent: function () {		
		var me = this;
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
        me.items = {
            xtype: "image",
            src: me.url,
            width: me.width,
            height: me.height,
            shrinkWrap: true
        };
        me.on ("afterrender", me.refresh, me);
        me.callParent (arguments);
    },
	refresh: function (options) {
        var me = this;
        if (me.attr) {
            var cmp = me.relatives [me.attr.split (".")[0]];
            var attr = me.attr.split (".")[1];
            if (cmp) {
                cmp.targets [me.zid] = me;
                if (cmp.xtype == "$o.card") {
                    var items = cmp.getItems ();
                    var objectId;
                    for (var i = 0; i < items.length; i ++) {
                        if (items [i].objectId) {
                            objectId = items [i].objectId;
                            break;
                        };
                    };
                    if (objectId) {
                        var o = $o.getObject (objectId);
                        if (o.get (attr)) {
                            var ca = $o.getClass (o.get ("classId")).attrs [attr];
                            var src = "files/" + objectId + "-" + ca.get ("id") + "-" + o.get (attr);
                            me.down ("image").setSrc (src);
                        } else {
                            me.down ("image").setSrc (null);
                        };
                    };
                } else {
                    var src = cmp.getValue (attr);
                    me.down ("image").setSrc (src);
                };
            };        
        };
	}
});

/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

Ext.define ("$o.Frame.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.frame"],
    border: 0,
	initComponent: function () {		
		var me = this;
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
        me.html = '<iframe src="' + me.url + '" frameborder="0" width="100%" height="100%">';
        me.on ("afterrender", me.refresh, me);
        me.callParent (arguments);
    },
	refresh: function (options) {
        var me = this;
        if (me.attr) {
            var cmp = me.relatives [me.attr.split (".")[0]];
            var attr = me.attr.split (".")[1];
            if (cmp) {
                cmp.targets [me.zid] = me;
                var url = cmp.getValue (attr);
                me.update ('<iframe src="' + url + '" frameborder="0" width="100%" height="100%">');
            };        
        };
	}
});

/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
*/
//Ext.require ([
//    "Ext.ux.GroupTabRenderer",
//    "Ext.ux.GroupTabPanel"
//]);
Ext.define ("$o.Layout.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layout", "widget.$layout"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		this.relatives = {};
		var layout = this.$layout;
		if (!layout && this.record && this.record.stub) {
			layout = this.record.stub.get ("layout");
			if (!layout && this.record.get ("query")) {
				layout = {
					olap: {
						id: "olap",
						view: this.record.getFullCode ()
					}
				};
			};
		};
		if (typeof (layout) != "object") {
			layout = eval ("(" + layout + ")");
			if (typeof (layout) == "function") {
				layout = layout ();
			};
		};
		delete this.layout;
		this.addEvents (
			"load"
		);
		this.on ("afterrender", function () {
			this.fireEvent ("load");
		}, this);
		this.record = this.record || {};
		this.record.stub = this.record.stub || {};
		this.record.stub.get = this.record.stub.get || function () {};
		$o.app.fireEvent ("viewLayout", {record: this.record, layout: layout});
		this.items = this.process (layout);
		try {
			this.viewFullCode = $o.getView (this.record.get ("id")).getFullCode ();
		} catch (e) {
		};
		this.callParent (arguments);
	},
	processTab: function (o) {
		var item = {
			xtype: "tabpanel",
			zid: o.id,
			items: []
		};
		o.items = o.pages || o.items;
		for (var i = 0; i < o.items.length; i ++) {
			item.items.push (this.process (o.items [i]));
		};
		delete o.id;
		return item;
	},
	processSplit: function (o) {
		var item = {
			layout: "border",
			border: false,
			zid: o.id,
			defaults: {
				border: false
			}
		};
		if (o.orientation == "horizontal") {
			item.items = [{
			    split: true,
			    region: "west",
				width: o.width,
				layout: "fit",
			    items: this.process (o.pages ? o.pages [0] : o.items [0])
			},{
			    region: "center",
				layout: "fit",
			    items: this.process (o.pages ? o.pages [1] : o.items [1])
			}]
		} else {
			item.items = [{
			    split: true,
			    region: "north",
				height: o.height || o.width,
				layout: "fit",
			    items: this.process (o.pages ? o.pages [0] : o.items [0])
			},{
			    region: "center",
				layout: "fit",
				items: this.process (o.pages ? o.pages [1] : o.items [1])
			}]
		};
		delete o.id;
		return item;
	},
	processOlap: function (o) {
		var item = {
			xtype: "$o.grid",
			zview: this,
			relatives: this.relatives,
			$query: o.view,
			zid: o.id,
			lconfig: {
				listeners: {}
			}
		};
		if (o.listeners && o.listeners.dblclick) {
			item.lconfig.listeners.dblclick = $o.util.clone (o.listeners.dblclick);
			delete o.listeners.dblclick;
		};
		if (o.listeners && o.listeners.cellRenderer) {
			item.lconfig.listeners.cellRenderer = $o.util.clone (o.listeners.cellRenderer);
			delete o.listeners.cellRenderer;
		};
		delete o.view;
		delete o.id;
		return item;
	},
	processChart: function (o) {
		var item = {
			xtype: "$o.chart",
			zview: this,
			relatives: this.relatives,
			$query: o.view,
			zid: o.id
		};
		delete o.view;
		delete o.id;
		return item;
	},
	processImage: function (o) {
		var item = {
			xtype: "$o.image",
			zview: this,
			relatives: this.relatives,
			url: o.url,
			attr: o.attr,
			width: o.width,
			height: o.height,
			zid: o.id
		};
		delete o.id;
		return item;
	},
	processFrame: function (o) {
		var item = {
			xtype: "$o.frame",
			zview: this,
			relatives: this.relatives,
			url: o.url,
			attr: o.attr,
			zid: o.id
		};
		delete o.id;
		return item;
	},
	processTreegrid: function (o) {
		var item = {
			xtype: "$o.tree",
			zview: this,
			relatives: this.relatives,
			$query: o.view,
			zid: o.id,
			lconfig: {
				listeners: {}
			}
		};
		if (o.listeners && o.listeners.dblclick) {
			item.lconfig.listeners.dblclick = $o.util.clone (o.listeners.dblclick);
			delete o.listeners.dblclick;
		};
		if (o.listeners && o.listeners.cellRenderer) {
			item.lconfig.listeners.cellRenderer = $o.util.clone (o.listeners.cellRenderer);
			delete o.listeners.cellRenderer;
		};
		delete o.view;
		delete o.id;
		return item;
	},
	processCard: function (o) {
		var item = {
			xtype: "$o.card",
			zview: this,
			relatives: this.relatives,
			zid: o.id
		};
//		delete o.listeners;
		delete o.id;
		return item;
	},
	processCardConf: function (o) {
		var item = {
			xtype: "$o.cardConf",
			zview: this,
			relatives: this.relatives,
			zid: o.id
		};
		delete o.id;
		return item;
	},
	processPanel: function (o) {
		var item = {
			xtype: "panel",
			zview: this,
			relatives: this.relatives,
			zid: o.id
		};
		delete o.id;
		return item;
	},
	process: function (l) {
		var item = {};
		for (var c in l) {
			var o = l [c];
			switch (c) {
			case "tab":
				item = this.processTab (o);
				break;
			case "split":
				item = this.processSplit (o);
				break;
			case "olap":
				item = this.processOlap (o);
				break;
			case "treegrid":
				item = this.processTreegrid (o);
				break;
			case "card":
				item = this.processCard (o);
				break;
			case "cardConf":
				item = this.processCardConf (o);
				break;
			case "panel":
				item = this.processPanel (o);
				break;
			case "chart":
				item = this.processChart (o);
				break;
			case "image":
				item = this.processImage (o);
				break;
			case "frame":
				item = this.processFrame (o);
				break;
			case "calendar":
				break;
			case "designer":
				break;
			default:
				return l;
			};
			o.title = $o.locale.getString (o.title) || $o.locale.getString (o.caption);
			Ext.applyIf (item, o);
		};
		return item;
	},
	getCurrentValue: function (wId, field) {
		var v;
		var w = this.relatives [wId];
		if (w) {
			v = w.getCurrentValue (field);
		};
		return v;
	}
});

Ext.define ("$o.Classes.Widget", {
	extend: "$o.Layout.Widget",
	alias: ["widget.$o.classes", "widget.$classes"],
	initComponent: function () {
		var me = this;
		me.$layout = {
			split: {
				orientation: "horizontal",
				width: 290,
				pages: [{
					treegrid: {
						id: "olap",
				    	view: "system.classes",
				    	fields: {
				    		id: "id",
				    		parent: "parent_id"
				    	},
				    	filter: {
//				    		fn: function () {return ["id", ">=", 1000]},
//				    		childsFn: function () {return [{"___childs": "___fend_id"}, "=", 2147483647, "and", {"___childs": "___fid"}, ">=", 1000]}
				    		fn: function () {return ["end_id", "=", 2147483647, "and", "id", ">=", 1000]},
				    		all: true
				    	},
					    actions: [{
					        fn: function () {
					        	var grid = this;
								$zu.dialog.getNameAndCode ({title: $o.getString ("Class", ":", "Adding"), success: function (name, code) {
									var createSpr = false;
									async.series ([
										function (cb) {
											var clsParent = $o.getClass (grid.getCurrentValue ("id"));
											if (clsParent && clsParent.getFullCode ().split (".")[0] == "spr") {
												common.confirm ({message: $o.getString ("Create standard dictionary (card, view)?"), scope: this, fn: function (btn) {
													if (btn == "yes") {
														createSpr = true;
													}
													cb ();
												}});
											} else {
												cb ();
											}
										}
									], function (err) {
										var tr = $o.startTransaction ({description: 'Create class '});
							        	var o = $o.createClass ();
							        	o.set ("parent", grid.getCurrentValue ("id"));
							        	o.set ("name", name);
							        	o.set ("code", code);
							        	o.sync ();
							        	o.updateDefault ();
							        	if (createSpr) {
							        		me.createSpr (o);
							        	}
										$o.commitTransaction (tr);
									    grid.refresh ({
											callback: function (record, store, success) {
												if (success) {
													grid.selectRow ({filter: ["&id", "=", o.get ("id")]});
												};
											},
											scope: grid
								    	});
									});
								}});
					        },  
					        caption: "create",
					        icon: "new"
					    }, {
					        fn: function () {
								common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
									if (btn == "yes") {
										var id = this.getCurrentValue ("id");
										var tr = $o.startTransaction ({description: 'Remove class ' + id});
							        	var o = $o.getClass (id);
							        	o.remove ();
							        	o.sync ();
										$o.commitTransaction (tr);
							        	this.refresh ();
							        };
							    }});
					        },
					        active: {
					            fn: function () {
					            	var r = this.getCurrentValue ("id") && !this.getCurrentValue ("schema_id");
					            	return r;
					            }
					        },
					        caption: "delete",
					        icon: "delete"
					    }, {
					        fn: function () {
					        	me.showObjects ({classId: this.getCurrentValue ("id")});
					        },
					        active: {
					            fn: function () {
					            	var r = this.getCurrentValue ("id");// && !this.getCurrentValue ("schema_id");
					            	return r;
					            }
					        },
					        caption: $o.getString ("Objects"),
					        iconCls: "gi_file"
					    }],
					    listeners: {
					    	afterrender: function () {
					    		me.olapClasses = this;
					    	}
					    }
					}
				}, {
					tab: {
						pages: [{
							cardConf: {
								id: "commonCard",
								title: $o.getString ("Commons"),
								iconCls: "gi_edit",
								items: [{
									conf: "class", id: "olap", attr: "id.name", fieldLabel: $o.getString ("Name")
								}, {
									conf: "class", id: "olap", attr: "id.code", allowBlank: false, fieldLabel: $o.getString ("Code"), readOnly: true, maskRe: /[A-Za-z0-9\_]/
								}, {
									conf: "class", id: "olap", attr: "id.description", fieldLabel: $o.getString ("Description"), xtype: "textarea", height: 150
								}, {
									conf: "class", id: "olap", attr: "id.format", fieldLabel: $o.getString ("Format function (default: return this.get ('name');)"), xtype: "textarea", height: 200
								}],
								active: {
									fn: function () {
						            	return !this.relatives ["olap"].getCurrentValue ("schema_id");
									}
								}
							}
						}, {
							split: {
								title: $o.getString ("Attributes"),
								iconCls: "gi_file",
								orientation: "vertical",
								height: 400,
								pages: [{
									olap: {
										id: "olapAttrs",
										view: "system.classAttrs",
										filter: ["class_id", "=", {id: "olap", attr: "id"}],
									    actions: [{
									        fn: function () {
												$zu.dialog.getNameAndCodeAndType ({title: $o.getString ("Class attribute", ":", "Adding"), success: function (name, code, type) {
													var cls = $o.getClass (this.relatives ["olap"].getCurrentValue ("id"));
													var cls2 = cls.hasAttrInHierarchy (code);
													if (cls2) {
														common.message ($o.getString ("Attribute already exists in class") + ": " + cls2.toString ());
														return;
													};
													var tr = $o.startTransaction ({description: 'Create class attr'});
										        	var o = $o.createClassAttr ();
										        	o.set ("class", this.relatives ["olap"].getCurrentValue ("id"));
										        	o.set ("name", name);
										        	o.set ("code", code);
										        	o.set ("type", type);
										        	o.set ("removeRule", "set null");
										        	o.sync ();
										        	$o.getClass (o.get ("class")).updateDefault ();
													$o.commitTransaction (tr);
												    this.refresh ({
														callback: function (record, store, success) {
															if (success) {
																this.selectRow ({filter: ["&id", "=", o.get ("id")]});
															};
														},
														scope: this
											    	});
												}, scope: this});
									        },
									        arguments: {
									        	debug: 1
									        },
									        caption: "create",
									        icon: "new",
									        active: {
									            fn: function () {
									            	return !this.relatives ["olap"].getCurrentValue ("schema_id");
									            }
									        }
									    }, {
									        fn: function () {
												common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
													if (btn == "yes") {
														var id = this.getCurrentValue ("id");
														var tr = $o.startTransaction ({description: 'Remove class attr ' + id});
											        	var o = $o.getClassAttr (id);
											        	var clsId = o.get ("class");
											        	o.remove ();
											        	o.sync ();
											        	$o.getClass (clsId).updateDefault ();
														$o.commitTransaction (tr);
											        	this.refresh ();
											        };
											    }});
									        },
									        active: {
									            fn: function () {
									            	return this.getCurrentValue ("id") && !this.relatives ["olap"].getCurrentValue ("schema_id");
									            }
									        },
									        caption: "delete",
									        icon: "delete"
									    }],
							    		cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
								        	if (metaData.column.dataIndex == "type") {
												if (record.get ("type_id")) {
													var cls = $o.getClass (record.get ("type_id"));
													if (cls) {
								        				value = cls.toString ();
								        			}
								        		}
								        	}
								        	return value;
								        }
									}
								}, {
									cardConf: {
										id: "attrCard",
										items: [{
											conf: "classAttr", id: "olapAttrs", attr: "id.name", fieldLabel: $o.getString ("Name")
										}, {
											conf: "classAttr", id: "olapAttrs", attr: "id.code", fieldLabel: $o.getString ("Code"), allowBlank: false, readOnly: true, maskRe: /[A-Za-z0-9\_]/
										}, {
											conf: "classAttr", id: "olapAttrs", attr: "id.type", fieldLabel: $o.getString ("Type"), confRef: "class", readOnly: true
										}, {
											"anchor": "100%",
											"xtype": "fieldcontainer",
											"layout": "hbox",
											"items": [{
												conf: "classAttr", id: "olapAttrs", attr: "id.secure", fieldLabel: $o.getString ("Password"), xtype: "checkbox"
											}, {
												conf: "classAttr", id: "olapAttrs", attr: "id.unique", fieldLabel: $o.getString ("Unique"), xtype: "checkbox", style: "margin-left: 10px"
											}, {
												conf: "classAttr", id: "olapAttrs", attr: "id.notNull", fieldLabel: $o.getString ("Not null"), xtype: "checkbox", style: "margin-left: 10px"
											}, {
												xtype: "compositefield", fieldLabel: $o.getString ("Remove rule"), style: "margin-left: 10px",
												items: [{
													xtype: "combo",
													conf: "classAttr", 
													id: "olapAttrs",
													attr: "id.removeRule", 
													width: 200,
													triggerAction: "all",
													lazyRender: true,
													mode: "local",
													queryMode: "local",
													editable: false,
													store: new Ext.data.ArrayStore ({
														fields: ["id", "text"],
														data: [
															["set null", "Set null)"],
															["cascade", "Cascade"]
														]
													}),
													valueField: "id",
													displayField: "text"
												}]
											}]
										}, {
											conf: "classAttr", id: "olapAttrs", attr: "id.formatFunc", fieldLabel: $o.getString ("Options") + " (JSON)", xtype: "textarea", height: 50
										}, {
											conf: "classAttr", id: "olapAttrs", attr: "id.validFunc", fieldLabel: $o.getString ("Validation function"), xtype: "textarea", height: 30
										}, {
											conf: "classAttr", id: "olapAttrs", attr: "id.description", fieldLabel: $o.getString ("Description"), xtype: "textarea", height: 30
										}],
										active: {
											fn: function () {
												if (this.relatives ["olapAttrs"].getValue ("id")) {
													var ca = $o.getClassAttr (this.relatives ["olapAttrs"].getValue ("id"));
													if (ca.get ("type") >= 1000) {
														this.down ("*[attr=id.removeRule]").enable ();
													} else {
														this.down ("*[attr=id.removeRule]").disable ();
													};
													if (ca.get ("type") == 1) {
														this.down ("*[attr=id.secure]").enable ();
													} else {
														this.down ("*[attr=id.secure]").disable ();
													};
												};
								            	return !this.relatives ["olap"].getCurrentValue ("schema_id");
											}
										}
									}
								}]
							}
						}, {
							split: {
								title: $o.getString ("Actions"),
								iconCls: "gi_wrench",
								orientation: "vertical",
								width: 400,
								pages: [{
									olap: {
										id: "olapActions",
										view: "system.actions",
										filter: ["class_id", "=", {id: "olap", attr: "id"}],
									    actions: [{
									        fn: function () {
												$zu.dialog.getNameAndCode ({title: $o.getString ("Action", ":", "Adding"), success: function (name, code) {
													var tr = $o.startTransaction ({description: 'Create action'});
										        	var o = $o.createAction ();
										        	o.set ("class", this.relatives ["olap"].getCurrentValue ("id"));
										        	o.set ("name", name);
										        	o.set ("code", code);
										        	o.sync ();
													$o.commitTransaction (tr);
												    this.refresh ({
														callback: function (record, store, success) {
															if (success) {
																this.selectRow ({filter: ["&id", "=", o.get ("id")]});
															};
														},
														scope: this
											    	});
												}, scope: this});
									        },  
									        caption: "create",
									        icon: "new",
									        active: {
									            fn: function () {
									            	return !this.relatives ["olap"].getCurrentValue ("schema_id");
									            }
									        }
									    }, {
									        fn: function () {
												common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
													if (btn == "yes") {
														var id = this.getCurrentValue ("id");
														var tr = $o.startTransaction ({description: 'Remove action ' + id});
											        	var o = $o.getAction (id);
											        	o.remove ();
											        	o.sync ();
														$o.commitTransaction (tr);
											        	this.refresh ();
											        };
											    }});
									        },
									        active: {
									            fn: function () {
									            	return this.getCurrentValue ("id") && !this.relatives ["olap"].getCurrentValue ("schema_id");
									            }
									        },
									        caption: "delete",
									        icon: "delete"
									    }, {
									    	fn: function () {
												var a = $o.getAction (this.getCurrentValue ("id"));
												var body = a.get ("body");
												var win = Ext.create ("Ext.Window", {
													width: 800, height: 600, layout: "fit",
													frame: false, border: false, bodyPadding: 1,
													modal: false,
													maximizable: true,
													title: $o.getString ("Action source code") + ": " + a.toString (),
													iconCls: "gi_notes",
													items: {
														name: "body",
														xtype: "codemirrortextarea",
														listeners: {
															afterrender: function () {
																this.setValue (body);
															}
														}
													},
													tbar: [{
														text: $o.getString ("Save"),
														iconCls: "gi_floppy_save",
										            	disabled: this.relatives ["olap"].getCurrentValue ("schema_id"),
														handler: function () {
															a.set ("body", win.down ("*[name=body]").getValue ());
															a.sync ();
															a.initAction ();
															win.close ();
														}
													}, {
														text: $o.getString ("Cancel"),
														iconCls: "gi_remove",
														handler: function () {
															win.close ();
														}
													}]
												});
												win.show ();
										    },
									        active: {
									            fn: function () {
									            	return this.getCurrentValue ("id");
									            }
									        },
									        text: $o.getString ("Source code"),
									        iconCls: "gi_notes"
									    }, {
									    	fn: function () {
									    		var classId = this.getCurrentValue ("class_id");
												var a = $o.getAction (this.getCurrentValue ("id"));
												var l = a.get ("layout");
												l = l || "{}";
												l = JSON.parse (l);
												var layout = l.layout;
												var win = Ext.create ("Ext.Window", {
													width: 800, height: 600, layout: "fit",
													frame: false, border: false, bodyPadding: 1,
													modal: false,
													maximizable: true,
													title: $o.getString ("Action layout") + ": " + a.toString (),
													iconCls: "gi_table",
													items: {
														xtype: "$layoutdesigner",
														name: "layout",
														listeners: {
															afterrender: function () {
																this.setValue (l.layout);
																this.classId = classId;
															}
														}
													},
													tbar: [{
														text: $o.getString ("Save"),
														iconCls: "gi_floppy_save",
										            	disabled: this.relatives ["olap"].getCurrentValue ("schema_id"),
														handler: function () {
															var layout = win.down ("*[name=layout]").getValue ();
															if (layout) {
																if (typeof (layout) == "string") {
																	try {
																		l.layout = JSON.parse (layout);
																	} catch (e) {
																		common.message ($o.getString ("Parsing layout ended with an error"));
																		win.close ();
																		return;
																	};
																};
																if (typeof (layout) == "object") {
																	l.layout = layout;
																};
															} else {
																delete l.layout;
															};
															a.set ("layout", JSON.stringify (l, null, "\t"));
															a.sync ();
															a.initAction ();
															me.actionCard.down ("*[attr=id.layout]").originalValue = JSON.stringify (l, null, "\t");
															win.close ();
														}
													}, {
														text: $o.getString ("Cancel"),
														iconCls: "gi_remove",
														handler: function () {
															win.close ();
														}
													}]
												});
												win.show ();
										    },
									        active: {
									            fn: function () {
									            	return this.getCurrentValue ("id");
									            }
									        },
									        text: $o.getString ("Layout"),
									        iconCls: "gi_table"
									        /*
									    }, {
									    	text: "Обновить действия по умолчанию",
									    	iconCls: "gi_refresh",
									    	handler: function () {
									    		var clsId = this.up ("grid").relatives ["olap"].getValue ("id");
									    		var cls = $o.getClass (clsId);
								    			cls.updateDefault ();
									    	}
									    	*/
									    }],
									    listeners: {
									    	afterrender: function () {
									    		me.olapActions = this;
									    	}
									    }
									}
								}, {
									cardConf: {
										id: "actionCard",
										listeners: {
											afterrender: function () {
												me.actionCard = this;
											},
											afterSave: function () {
												var actionId = this.relatives ["olapActions"].getValue ("id");
												var a = $o.getAction (actionId);
												var layoutField = me.actionCard.down ("*[attr=id.layout]");
												var v = layoutField.originalValue;
												v = JSON.parse (v);
												if (!v || typeof (v) != "object") {
													v = {};
												};
												v ["type"] = me.actionCard.down ("*[name=type]").getValue ();
												v ["serverAction"] = me.actionCard.down ("*[name=serverAction]").getValue ();
												v ["noAuth"] = me.actionCard.down ("*[name=noAuth]").getValue ();
												a.set ("layout", JSON.stringify (v, null, "\t"));
												a.sync ();
												a.initAction ();
											}
										},
										items: [{
											conf: "action", id: "olapActions", attr: "id.name", fieldLabel: $o.getString ("Name"), labelWidth: 150
										}, {
											conf: "action", id: "olapActions", attr: "id.code", fieldLabel: $o.getString ("Code"), allowBlank: false, labelWidth: 150, maskRe: /[A-Za-z0-9\_]/
										}, {
											xtype: "combo",
											name: "type",
											fieldLabel: $o.getString ("Type"),
											triggerAction: "all",
											lazyRender: true,
											mode: "local",
											labelWidth: 150,
											queryMode: "local",
											editable: false,
											store: new Ext.data.ArrayStore ({
												fields: ["id", "text"],
												data: [
													[null, "-"],
													["create", $o.getString ("Adding")],
													["remove", $o.getString ("Removing")],
													["card", $o.getString ("Card")]
												]
											}),
											valueField: "id",
											displayField: "text",
											listeners: {
												select: function () {
													me.actionCard.down ("*[attr=id.layout]").setValue (
														me.actionCard.down ("*[attr=id.layout]").counter ++
													);
													/*
													if (this.getValue () == "create") {
														var cls = $o.getClass (me.olapClasses.getValue ("id"));
														this.up ("*[name=attrCard]").down ("*[name=body]").setValue (
												    		'common.tpl.create.call (this, {\n' +
												    		'\tasWindow: 1,\n' +
												    		'\tclassCode: "' + cls.getFullCode () + '",\n' +
															'\tfn: function (o, options) {\n' +
												    		'\t\toptions.layout = common.tpl.updateTags (\n' +
												    		'\t\t\t' + cls.getFullCode () + '.card.layout, {\n' +
												    		'\t\t\t\tid: o.get ("id")\n' +
												    		'\t\t\t}\n' +
												    		'\t\t)\n' +
												    		'\t}\n' +
												    		'});\n'
														);
													};
													if (this.getValue () == "card") {
														var action = $o.getAction (me.olapActions.getValue ("id"));
														this.up ("*[name=attrCard]").down ("*[name=body]").setValue (
												    		'var me = this;\n' +
												    		'var id = me.getValue ("id") || me.getValue ("a_id");\n' +
												    		'common.tpl.show.call (this, {\n' +
												    		'\tid: id,\n' +
												    		'\tasWindow: 1,\n' +
												    		'\tlayout: common.tpl.updateTags (\n' +
												    		'\t\t' + action.getFullCode () + '.layout, {\n' +
												    		'\t\t\tid: id\n' +
												    		'\t\t}\n' +
												    		'\t)\n' +
												    		'});\n'
														);
													};
													if (this.getValue () == "remove") {
														this.up ("*[name=attrCard]").down ("*[name=body]").setValue (
												    		'common.tpl.remove.call (this);\n'
														);
													};
													*/
												}
											}
										}, {
											xtype: "compositefield",
											fieldLabel: $o.getString ("Server action"),
											labelWidth: 150,
											items: [{
												xtype: "checkbox", name: "serverAction", listeners: {
													change: function () {
														me.actionCard.down ("*[attr=id.layout]").setValue (
															me.actionCard.down ("*[attr=id.layout]").counter ++
														);
														if (this.getValue ()) {
															me.actionCard.down ("*[name=noAuth]").enable ();
															me.actionCard.down ("*[name=displayNoAuth]").enable ();
														} else {
															me.actionCard.down ("*[name=noAuth]").disable ();
															me.actionCard.down ("*[name=displayNoAuth]").disable ();
														};
													}
												}
											}, {
												xtype: "displayfield",
												name: "displayNoAuth",
												value: $o.getString ("Execute no authentication") + ":",
												style: "margin-left: 10px; margin-right: 5px"
											}, {
												xtype: "checkbox", name: "noAuth", labelWidth: 150, listeners: {
													change: function () {
														me.actionCard.down ("*[attr=id.layout]").setValue (
															me.actionCard.down ("*[attr=id.layout]").counter ++
														);
													}
												}
											}]
										}, {
											conf: "action", id: "olapActions", attr: "id.body", xtype: "textarea", hideLabel: true, style: "display: none"
										}, {
											conf: "action", id: "olapActions", attr: "id.layout", xtype: "textarea", hideLabel: true, style: "display: none"
										}],
										active: {
											fn: function () {
												if (this.relatives ["olapActions"].getValue ("id")) {
													var a = $o.getAction (this.relatives ["olapActions"].getValue ("id"));
													var l = a.get ("layout");
													l = l || "{}";
													l = JSON.parse (l);
													this.down ("*[name=type]").setValue (l ["type"]);
													this.down ("*[name=serverAction]").setValue (l ["serverAction"]);
													this.down ("*[name=noAuth]").setValue (l ["noAuth"]);
													if (l ["serverAction"]) {
														this.down ("*[name=noAuth]").enable ();
														this.down ("*[name=displayNoAuth]").enable ();
													} else {
														this.down ("*[name=noAuth]").disable ();
														this.down ("*[name=displayNoAuth]").disable ();
													};
													if (l.system) {
														this.down ("*[iconCls=save]").disable ();
													} else {
														this.down ("*[iconCls=save]").enable ();
													};
													//this.up ("*[name=attrCard]").down ("*[name=body]").setValue (a.get ("body") ? a.get ("body") : "");
													this.down ("*[attr=id.layout]").originalValue = a.get ("layout");
													this.down ("*[attr=id.layout]").counter = 1;
												};
								            	return !this.relatives ["olap"].getCurrentValue ("schema_id");
											}
										}
									}
								}]
							}
						}, {
							olap: {
								id: "olapDependency",
								title: $o.getString ("Dependencies"),
								iconCls: "gi_link",
								view: "system.typeClassAttrs",
								filter: ["type_id", "=", {id: "olap", attr: "id"}],
					    		cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
						        	if (metaData.column.dataIndex == "classCode") {
										var cls = $o.getClass (record.get ("class_id"));
										if (cls) {
					        				value = cls.getFullCode ();
					        			}
						        	}
						        	return value;
						        }
							}
						}]
					}
				}]
			}
		};
		me.callParent (arguments);
	},
	showObjects: function (options) {
		var cls = $o.getClass (options.classId);
		if (!cls.attrsArray.length) {
			common.message ($o.getString ("Class has no attributes"));
			return;
		};
		var win = Ext.create ("Ext.Window", {
			title: $o.getString ("Class objects") + ": " + cls.toString (),
			iconCls: "gi_file",
			width: 800,
			height: 600,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			bodyPadding: 1,
			modal: true,
			items: {
				xtype: "$o.layout",
				$layout: {
					olap: {
						id: "olap",
						classView: options.classId,
						recreateView: true,
						singleSelect: false,
						/*
					    selModel: Ext.create ("Ext.selection.CellModel", {
							mode: "MULTI",
					        listeners: {
								select: function (sm, record, row, column, eOpts) {
									console.log (column);
								}
					        }
					    }),
						*/
						actions: [{
							fn: function () {
								var me = this;
								common.confirm ({message: $o.getString ("Are you sure?"), fn: function (btn) {
									if (btn == "yes") {
										$o.startTransaction ({description: "Remove by admin"});
										_.each (me.getSelectionModel ().getSelection (), function (rec, i) {
											$o.removeObject (rec.get ("id"));
											me.getStore ().remove (rec);
										});
										$o.commitTransaction ();
									};
								}});
							},
							text: $o.getString ("Remove"),
							iconCls: "gi_circle_minus",
							active: "common.recordSelected"
						}, {
							fn: function () {
								var me = this;
								var sql = JSON.parse (me.$view.get ("query"));
								var filter = me.getFilter ();
								if (filter && filter.length) {
									_.each (filter, function (f, i) {
										var index = sql.select.indexOf (f);
										if (index > -1) {
											filter [i] = sql.select [index - 1];
										}
									});
									sql.where = sql.where || [];
									if (sql.where.length) {
										sql.where.push ("and");
									}
									sql.where.push (filter);
								}
								sql.asArray = true;
								var recs = $o.execute (sql);
								common.confirm ({message: $o.getString ("Entries will be deleted") + ": " + recs.length + ". " + $o.getString ("Are you sure?"), fn: function (btn) {
									if (btn == "yes") {
										Ext.MessageBox.show ({
										    title: $o.getString ("Please wait"),
										    msg: $o.getString ("Action in progress") + " ...",
										    progressText: "",
										    width: 300,
										    progress: 1,
										    closable: false
										});	
										setTimeout (function () {
											$o.startTransaction ();
											async.reduce (recs, 0, function (i, rec, cb) {
												Ext.MessageBox.updateProgress (i / recs.length, i + " / " + recs.length);
												$o.removeObject (rec.id);
										        setTimeout (function () {
										        	cb (null, i + 1);
										        }, 1);
										    }, function (err) {
												$o.commitTransaction ();
												Ext.MessageBox.hide ();
												me.refresh ();
											});
										}, 100);
									};
								}});
							},
							text: $o.getString ("Remove all"),
							iconCls: "gi_circle_minus"
						}, {
							fn: function () {
								var me = this;
								var sql = JSON.parse (me.$view.get ("query"));
								var filter = me.getFilter ();
								if (filter && filter.length) {
									_.each (filter, function (f, i) {
										var index = sql.select.indexOf (f);
										if (index > -1) {
											filter [i] = sql.select [index - 1];
										}
									});
									sql.where = sql.where || [];
									if (sql.where.length) {
										sql.where.push ("and");
									}
									sql.where.push (filter);
								}
								sql.asArray = true;
								var recs = $o.execute (sql);
								var win = Ext.create ("Ext.window.Window", {
									title: $o.getString ("Changing the value of"),
									iconCls: "edit",
									closable: true,
									width: 600,
									height: 400,
									layout: "vbox",
									modal: true,
									style: "background-color: #fff",
									bodyStyle: "background-color: #fff",
									bodyPadding: 5,
									items: [{
										xtype: "textfield",
										disabled: true,
										fieldLabel: $o.getString ("Entries will be changed"),
										value: recs.length
									}, {
										xtype: "combo",
										fieldLabel: $o.getString ("Attribute"),
										name: "attr",
										triggerAction: "all",
										lazyRender: true,
										mode: "local",
										queryMode: "local",
										store: {
											type: "json",
											fields: ["id", "name"],
											data: _.map (cls.attrsArray, function (ca) {
												return {id: ca.get ("code"), name: ca.toString ()};
											})
										},
										width: "100%",
										valueField: "id",
										displayField: "name",
										editable: false
									}, {
										xtype: "textfield",
										name: "value",
										fieldLabel: $o.getString ("Value"),
										width: "100%"
									}],
									buttons: [{
										text: $o.getString ("Change"),
										iconCls: "ok",
										handler: function () {
											var attr = win.down ("*[name=attr]").getValue ();
											var value = win.down ("*[name=value]").getValue () || null;
											if (!attr) {
												return common.message ($o.getString ("Choose attribute"));
											}
											Ext.MessageBox.show ({
											    title: $o.getString ("Please wait"),
											    msg: $o.getString ("Action in progress") + " ...",
											    progressText: "",
											    width: 300,
											    progress: 1,
											    closable: false
											});	
											setTimeout (function () {
												$o.startTransaction ();
												async.reduce (recs, 0, function (i, rec, cb) {
													Ext.MessageBox.updateProgress (i / recs.length, i + " / " + recs.length);
													var o = $o.getObject (rec.id);
													o.set (attr, value);
													o.sync ();
											        setTimeout (function () {
											        	cb (null, i + 1);
											        }, 1);
											    }, function (err) {
													$o.commitTransaction ();
													Ext.MessageBox.hide ();
													win.close ();
													me.refresh ();
												});
											}, 100);
										}
									}]
								});
								win.show ();
							},
							text: $o.getString ("Change all"),
							iconCls: "edit"
						}, {
							text: $o.getString ("Import") + " CSV",
							iconCls: "gi_disk_import",
							fn: function () {
								var olap = this;
								var win = Ext.create ("Ext.window.Window", {
									title: $o.getString ("import") + " CSV",
									iconCls: "gi_disk_import",
									closable: true,
									width: 800,
									height: 600,
									layout: "fit",
									modal: true,
									style: "background-color: #fff",
									bodyStyle: "background-color: #fff",
									items: {
										xtype: "importcsvobjects",
										classId: options.classId,
										listeners: {
											imported: function () {
												win.close ();
												olap.refresh ();
											}
										}
									}
								});
								win.show ();
							}
						}]
					}
				}
			}
		});
		win.show ();		
	},
	/*
		Создает справочник
	*/
	createSpr: function (cls) {
		var me = this;
		// card layout
		var l = {
			"type": "card",
			"layout": {
				"designer": 1,
				"card": {
					"id": "card",
					"items": [{
						"anchor": "100%",
						"fieldLabel": $o.getString ("Name"),
						"attr": "name",
						"objectId": "[#id]"
					}, {
						"fieldLabel": $o.getString ("N"),
						"attr": "npp",
						"objectId": "[#id]",
						"width": 200
					}, {
						"anchor": "100%",
						"fieldLabel": $o.getString ("Code"),
						"attr": "code",
						"objectId": "[#id]"
					}],
					"object": [
						{
							"cls": cls.getFullCode (),
							"tag": "[#id]"
						}
					]
				}
			}
		};
		var recs = $o.execute ({
			asArray: true,
		    select: [
		        {"a":"___fid"}, "id"
		    ],
		    from: [
		        {"a":"system.action"}
		    ],
		    where: [
		        {"a": "___fend_id"}, "=", 2147483647, "and", {"a": "___fclass_id"}, "=", cls.get ("id"), "and",
		        {"a":"___fcode"}, "=", "card"
		    ]
		});
		var action = $o.getAction (recs [0].id);
		action.set ("layout", JSON.stringify (l, null, "\t"));
		action.sync ();
		// view
		var viewParent = null;
		var tokens = cls.getFullCode ().split (".");
		for (var i = 0; i < tokens.length - 1; i ++) {
			var code = tokens.slice (0, i + 1).join (".");
			var clsParent = $o.getClass (code);
			var parentId = viewParent ? viewParent.get ("id") : null;
			try {
				viewParent = $o.getView (code);
			} catch (e) {
				viewParent = $o.createView ();
				viewParent.set ("parent", parentId);
				viewParent.set ("name", clsParent.get ("name"));
				viewParent.set ("code", clsParent.get ("code"));
				viewParent.sync ();
			};
		};
		var codeView = cls.getFullCode ();
		/*
		var codeParent = cls.getFullCode ().split (".");
		codeParent.splice (codeParent.length - 1, 1);
		codeParent = codeParent.join (".");
		var viewParent;
		try {
			viewParent = $o.getView (codeParent);
		} catch (e) {
			return common.message ($o.getString ("base view not exists") + " " + codeParent);
		}
		if (!viewParent) {
			return common.message ($o.getString ("base view not exists") + " " + codeParent);
		}
		var codeView = codeParent + "." + cls.get ("code");
		*/
		var view = $o.createView ();
		view.set ("parent", viewParent.get ("id"));
		view.set ("name", cls.get ("name"));
		view.set ("code", cls.get ("code"));
		view.set ("query", JSON.stringify ({
			designer: 1,
			select: [
				{"a": "id"}, "id",
				{"a": "name"}, "name",
				{"a": "code"}, "code",
				{"a": "npp"}, "npp"
			],
			from: [
				{"a": codeView}
			],
			order: [
				{"a": "npp"}, ",", {"a": "name"}
			]
		}, null, "\t"));
		view.set ("layout", JSON.stringify ({
			designer: 1,
			olap: {
				id: "olap",
				view: codeView,
				actions: [
					{
						"fn": codeView + ".card",
						"text": $o.getString ("Open"),
						"iconCls": "gi_edit",
						"active": "common.recordSelected"
					},
					{
						"fn": codeView + ".create",
						"text": $o.getString ("Add"),
						"iconCls": "gi_circle_plus"
					},
					{
						"fn": codeView + ".remove",
						"text": $o.getString ("Remove"),
						"iconCls": "gi_circle_minus",
						"active": "common.recordSelected"
					}
				]
			}
		}, null, "\t"));
		view.set ("iconCls", "gi_book");
		view.sync ();
		// view attrs
		_.each ([{
			code: "id", name: "id", width: 75, area: 0
		}, {
			code: "name", name: $o.getString ("Name"), width: 500, area: 1
		}, {
			code: "code", name: $o.getString ("Code"), width: 75, area: 0
		}, {
			code: "npp", name: $o.getString ("N"), width: 75, area: 0
		}], function (o, i) {
			var va = $o.createViewAttr ();
			va.set ("view", view.get ("id"));
			va.set ("code", o.code);
			va.set ("name", o.name);
			va.set ("width", o.width);
			va.set ("area", o.area);
			va.set ("order", i + 1);
			va.sync ();
		});
	}
});
		
Ext.define ("$o.Views.Widget", {
	extend: "$o.Layout.Widget",
	alias: ["widget.$o.views", "widget.$views"],
	initComponent: function () {
		var me = this;
		me.$layout = {
			split: {
				orientation: "horizontal",
				width: 290,
				pages: [{
					treegrid: {
						id: "olap",
						view: "system.views",
						fields: {
							id: "id",
							parent: "parent_id"
						},
						filter: {
				    		fn: function () {return ["system", "is null", "and", "end_id", "=", 2147483647]},
				    		all: true
	//						fn: function () {return ["system", "is null"]},
	//						childsFn: function () {return [{"___childs": "___fsystem"}, "is null", "and", {"___childs": "___fend_id"}, "=", 2147483647]}
						},
						actions: [{
							fn: function () {
								$zu.dialog.getNameAndCode ({title: $o.getString ("View", ":", "Adding"), success: function (name, code) {
									var tr = $o.startTransaction ({description: 'Create view'});
									var o = $o.createView ();
									o.set ("parent", this.getCurrentValue ("id"));
									o.set ("name", name);
									o.set ("code", code);
									o.sync ();
									$o.commitTransaction (tr);
									this.refresh ({
										callback: function (record, store, success) {
											if (success) {
												this.selectRow ({filter: ["&id", "=", o.get ("id")]});
											};
										},
										scope: this
									});
								}, scope: this});
							},  
							caption: "create",
							icon: "new"
						}, {
							fn: function () {
								common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
									if (btn == "yes") {
										var id = this.getCurrentValue ("id");
										var tr = $o.startTransaction ({description: 'Remove view ' + id});
										var o = $o.getView (id);
										o.remove ();
										o.sync ();
										$o.commitTransaction (tr);
										this.refresh ();
									};
								}});
							},
							active: {
								fn: function () {
									var r = this.getCurrentValue ("id") && !this.getCurrentValue ("schema_id");
									return r;
								}
							},
							caption: "delete",
							icon: "delete"
						}, {
							fn: function () {
								var record = $o.viewsMap [this.getCurrentValue ("id")];
								$o.app.show.call ($o.app, {record: record});
							},  
							active: {
								fn: function () {
									var r = this.getCurrentValue ("id");
									return r;
								}
							},
							caption: $o.getString ("Review"),
							iconCls: "gi_eye_open"
						}]
					}
				}, {
					tab: {
						listeners: {
							tabchangeTODO: function (tabPanel, panel) {	
								var me = this;
								if (panel.title == $o.getString ("Query") || panel.title == $o.getString ("Layout")) {
									var field = panel.getItems () [0];
									var value = field.getValue ();
									var dom = Ext.getDom (field.inputEl);
									if (me.editor) {
										me.editor.toTextArea ();
									};
									var height = panel.getHeight (true);
									Ext.util.CSS.updateRule (".CodeMirror-scroll", "height", height + "px");
									me.editor = CodeMirror.fromTextArea (dom, {
										lineNumbers: true,
										indentUnit: 4,
										readOnly: false,
										mode: {
											name: 'javascript',
											json: true
										}
									});
									me.editor.setValue (value);
								};
							}
						},
						pages: [{
							cardConf: {
								id: "commonCard",
								title: $o.getString ("Commons"),
								iconCls: "gi_edit",
								tbar: [{
									text: $o.getString ("Dependencies"),
									iconCls: "gi_link",
									handler: function () {
										var viewId = this.up ("*[name=views]").relatives ["olap"].getValue ("id");
										var path = $o.getView (viewId).getFullCode ();
										var data = [];
										_.each ($o.viewsMap, function (o, id) {
											if (o.get ("layout") && o.get ("layout").indexOf (path) > -1) {
												data.push ({
													id: o.get ("id"), path: o.getFullCode (), name: o.get ("name")
												});
											};
										});
										var win = Ext.create ("Ext.Window", {
											width: 600,
											height: 600,
											layout: "fit",
											frame: false,
											border: false,
											style: "background-color: #ffffff",
											bodyStyle: "background-color: #ffffff",
											title: $o.getString ("Dependencies") + ": " + $o.getString ("Views"),
											iconCls: "gi_link",
											bodyPadding: 5,
											modal: 1,
											items: {
												xtype: "grid",
												name: "grid",
												store: {
													type: "json",
													fields: ["id", "path", "name"],
													data: data
												},
												columns: [{
													text: "id",
													dataIndex: "id"
												}, {
													text: $o.getString ("Code"),
													dataIndex: "path"
												}, {
													text: $o.getString ("Name"),
													dataIndex: "name"
												}],
												width: "100%",
												forceFit: true,
												columnLines: true,
												rowLines: true
											}
										});
										win.show ();
									}
								}],
								items: [{
									conf: "view", id: "olap", attr: "id.name", fieldLabel: $o.getString ("Name")
								}, {
									conf: "view", id: "olap", attr: "id.code", fieldLabel: $o.getString ("Code"), allowBlank: false, maskRe: /[A-Za-z0-9\_]/
								}, {
									conf: "view", id: "olap", attr: "id.parent", fieldLabel: $o.getString ("Parent"), confRef: "view", choose: {type: "view", id: "system.views", attr: "olap.id", width: 500, height: 400}
								}, {
									conf: "view", id: "olap", attr: "id.description", fieldLabel: $o.getString ("Description"), xtype: "textarea", height: 150
								}, {
									conf: "view", id: "olap", attr: "id.iconCls", fieldLabel: $o.getString ("Icon"), xtype: "$iconselector"
								}],
								active: {
									fn: function () {
										return !this.relatives ["olap"].getCurrentValue ("schema_id");
									}
								}
							}
						}, {
							cardConf: {
								id: "queryCard",
								title: $o.getString ("Query"),
								iconCls: "gi_cogwheel",
								tbar: [{
									text: $o.getString ("Setting the table columns"),
									iconCls: "gi_table",
									handler: function () {
										var win = Ext.create ("Ext.Window", {
											width: 800,
											height: 600,
											layout: "fit",
											frame: false,
											border: false,
											style: "background-color: #ffffff",
											bodyStyle: "background-color: #ffffff",
											title: $o.getString ("Setting the table columns"),
											bodyPadding: 5,
											modal: 1,
											maximizable: true,
											items: {
												xtype: "$querycolumns",
												viewId: this.up ("*[name=views]").relatives ["olap"].getValue ("id"),
												schemaId: this.up ("*[name=views]").relatives ["olap"].getCurrentValue ("schema_id")
											}
										});
										win.show ();
									}
								}],
								listeners: {
									beforeSave: function () {
										var me = this;
										var query = me.down ("*[attr=id.query]").getValue ();
										query = eval ("(" + query + ")");
										query.limit = 1;
										var r = $o.execute ({sql: query, noException: 1});
										if (r.error) {
											common.message ($o.getString ("Error in query") + ":\n" + r.error);
										};
									}
								},
								items: [{
									/*
									conf: "view", id: "olap", attr: "id.query", hideLabel: true, xtype: "textarea", anchor: "100% 100%", fieldStyle: {
										"fontFamily": "courier new",
										"fontSize": "11px"
									}
									*/
									//anchor: "100% 100%",
									flex: 1, width: "100%",
									border: 0,
									layout: "fit",
									items: [{
										conf: "view", id: "olap", attr: "id.query", hideLabel: true, xtype: "$querydesigner"
									}]
								}],
								active: {
									fn: function () {
										return !this.relatives ["olap"].getCurrentValue ("schema_id");
									}
								}
							}
						}, {
							cardConf: {
								id: "layoutCard",
								title: $o.getString ("Layout"),
								iconCls: "gi_table",
								items: [{
									//anchor: "100% 100%",
									flex: 1, width: "100%",
									border: 0,
									layout: "fit",
									items: [{
										/*
										conf: "view", id: "olap", attr: "id.layout", hideLabel: true, xtype: "textarea", fieldStyle: {
											"fontFamily": "courier new",
											"fontSize": "11px"
										}
										*/
										conf: "view", id: "olap", attr: "id.layout", hideLabel: true, xtype: "$layoutdesigner"
									}]
								}],
								active: {
									fn: function () {
										return !this.relatives ["olap"].getCurrentValue ("schema_id");
									}
								}
							}
						}/*, {
							split: {
								title: "Атрибуты",
								iconCls: "gi_file",
								orientation: "vertical",
								height: 300,
								pages: [{
									olap: {
										id: "olapAttrs",
										view: "system.viewAttrs",
										filter: ["view_id", "=", {id: "olap", attr: "id"}],
										actions: [{
											fn: function () {
												$zu.dialog.getNameAndCode ({title: "Добавление атрибута представления", success: function (name, code) {
													var tr = $o.startTransaction ({description: 'Create view attr'});
													var o = $o.createViewAttr ();
													o.set ("view", this.relatives ["olap"].getCurrentValue ("id"));
													o.set ("name", name);
													o.set ("code", code);
													o.set ("area", 1);
													o.set ("width", 75);
													o.sync ();
													$o.commitTransaction (tr);
													this.refresh ({
														callback: function (record, store, success) {
															if (success) {
																this.selectRow ({filter: ["&id", "=", o.get ("id")]});
															};
														},
														scope: this
													});
												}, scope: this});
											},  
											caption: "create",
											icon: "new",
											active: {
												fn: function () {
													return !this.relatives ["olap"].getCurrentValue ("schema_id");
												}
											}
										}, {
											fn: function () {
												common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
													if (btn == "yes") {
														var id = this.getCurrentValue ("id");
														var tr = $o.startTransaction ({description: 'Remove view attr ' + id});
														var o = $o.getViewAttr (id);
														o.remove ();
														o.sync ();
														$o.commitTransaction (tr);
														this.refresh ();
													};
												}});
											},
											active: {
												fn: function () {
													return this.getCurrentValue ("id") && !this.relatives ["olap"].getCurrentValue ("schema_id");
												}
											},
											caption: "delete",
											icon: "delete"
										}]
									}
								}, {
									cardConf: {
										id: "attrCard",
										items: [{
											conf: "viewAttr", id: "olapAttrs", attr: "id.name", fieldLabel: "Наименование"
										}, {
											conf: "viewAttr", id: "olapAttrs", attr: "id.code", fieldLabel: "Код", allowBlank: false, maskRe: /[A-Za-z0-9\_]/
										}, {
											xtype: "compositefield", fieldLabel: "Видимый",
											items: [{
												conf: "viewAttr", id: "olapAttrs", attr: "id.area", xtype: "checkbox", width: 100
											}]
										}, {
											xtype: "compositefield", fieldLabel: "№ пп",
											items: [{
												conf: "viewAttr", id: "olapAttrs", attr: "id.order", xtype: "numberfield", width: 100
											}]
										}, {
											xtype: "compositefield", fieldLabel: "Ширина",
											items: [{
												conf: "viewAttr", id: "olapAttrs", attr: "id.width", xtype: "numberfield", width: 100
											}]
										}],
										active: {
											fn: function () {
												return !this.relatives ["olap"].getCurrentValue ("schema_id");
											}
										}
									}
								}]
							}
						}*/]
					}
				}]
			}
		};
		me.callParent (arguments);
	}
});

Ext.define ("$o.LayoutEditor", {
	extend: "Ext.panel.Panel",
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.tbar = [{
			text: "Ок",
			name: "ok",
			iconCls: "gi_ok",
			handler: me.save,
			scope: me
		}, {
			text: $o.getString ("Cancel"),
			name: "cancel",
			iconCls: "gi_remove",
			handler: function () {
				me.up ("window").close ();
			}
		}, {
			text: $o.getString ("Convert to splitter"),
			name: "make_split",
			iconCls: "gi_share_alt",
			handler: function () {
				var ta = me.down ("codemirrortextarea[name='json']");
				var cmp = {
					split: {
						id: "cmp-" + (me.layoutDesigner.counter ++),
						orientation: "horizontal",
						width: "50%",
						items: [JSON.parse (ta.getValue ()), me.layoutDesigner.createEmpty ()]
					}
				};
				ta.setValue (JSON.stringify (cmp, null, "\t"));
				me.save ({convertion: 1});
			},
			scope: me
		}, {
			text: $o.getString ("Convert to tabs"),
			name: "make_tab",
			iconCls: "gi_bookmark",
			handler: function () {
				var ta = me.down ("codemirrortextarea[name='json']");
				var tabCmp = JSON.parse (ta.getValue ());
				tabCmp [me.cmpCode].title = tabCmp [me.cmpCode].title || "Закладка";
				var cmp = {
					tab: {
						id: "cmp-" + (me.layoutDesigner.counter ++),
						items: [tabCmp]
					}
				};
				ta.setValue (JSON.stringify (cmp, null, "\t"));
				me.save ({convertion: 1});
			},
			scope: me
		}];
		me.addEvents ("beforesave", "aftersave", "change");
		this.callParent (arguments);
	},
	changeAttr: function (attr, value) {
		var me = this;
		var ta = me.down ("codemirrortextarea[name='json']");
		var cmp = ta.getValue ();
		cmp = JSON.parse (cmp);
		var tokens = attr.split (".");
		var root = cmp [me.cmpCode];
		for (var i = 0; i < tokens.length; i ++) {
			root [tokens [i]] = root [tokens [i]] || {};
			if (i == tokens.length - 1) {
				root [tokens [i]] = value;
				break;
			};
			root = root [tokens [i]];
		};
		if (attr == "title" && !value) {
			delete cmp [me.cmpCode][attr];
		};
		if (attr == "filter" && (!value || value.length == 0)) {
			delete cmp [me.cmpCode][attr];
		};
		me.value = cmp;
		ta.setValue (JSON.stringify (cmp, null, "\t"));
	},
	save: function (options) {
		var me = this;
		me.fireEvent ("beforesave", options);
		var ta = me.down ("codemirrortextarea[name='json']");
//		try {
			var value = JSON.parse (ta.getValue ());
			me.value = value;
			me.fireEvent ("aftersave", value);
			me.fireEvent ("change", value);
//		} catch (e) {
//			common.message ("Ошибка: " + (e.message || e));
//		};
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});

Ext.define ("$o.LayoutOlap.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layoutolap", "widget.$layoutolap"],
	cmpCode: "olap",
	initComponent: function () {
		var me = this;
		me.value = me.value || {
			olap: {
				id: "cmp-" + (me.layoutDesigner.counter ++)
			}
		};
		var filterAction = null;
		if (me.value.olap.filter && typeof (me.value.olap.filter) == "string") {
			filterAction = $o.getAction (me.value.olap.filter).get ("id");
		};
		me.items = {
			xtype: "tabpanel",
			items: [{
				layout: "vbox",
				title: $o.getString ("Commons"),
				iconCls: "gi_edit",
				bodyPadding: 5,
				items: [{
					xtype: "textfield",
					width: "100%", 
					labelWidth: 150,
					fieldLabel: $o.getString ("Identifier"),
					name: "id",
					style: "margin-top: 5px;",
					value: me.value.olap.id,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
							me.down ("*[name=filter]").setCmpId (this.getValue ());
						}
					}
				}, {
					xtype: "textfield",
					labelWidth: 150,
					width: "100%", 
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.olap.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					labelWidth: 150,
					width: "100%", 
					name: "iconCls",
					value: me.value.olap.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "$conffield", 
					fieldLabel: $o.getString ("Query"),
					labelWidth: 150,
					name: "view", 
					value: me.value.olap.view, 
					width: "100%",
					confRef: "view",
					choose: {
						type: "custom", fn: function () {
							var objectfield = this;
							dialog.getView ({hasQuery: 1, success: function (options) {
								objectfield.setValue (options.id);
							}});
						}
					},
					listeners: {
						afterrender: function () {
							me.validator ();
						},
						change: function () {
							me.validator ();
							var viewCode = this.getValue () ? $o.getView (this.getValue ()).getFullCode () : undefined;
							me.changeAttr ("view", viewCode)
							//me.down ("*[name=filter]").setValue ([]);
							me.down ("*[name=filter]").setViewId (viewCode ? $o.getView (viewCode).get ("id") : null);
							me.down ("*[name=total]").setViewId (viewCode ? $o.getView (viewCode).get ("id") : null);
						}
					}
				}, {
					xtype: "checkbox",
					width: "100%", 
					name: "wordWrap",
					labelWidth: 150,
					fieldLabel: $o.getString ("Word wrap"),
					checked: me.value.olap.wordWrap,
					listeners: {
						change: function () {
							me.changeAttr ("wordWrap", this.getValue ())
						}
					}
				}, {
					xtype: "checkbox",
					width: "100%", 
					name: "groupedColumns",
					labelWidth: 150,
					fieldLabel: $o.getString ("Grouped header"),
					checked: me.value.olap.groupedColumns,
					listeners: {
						change: function () {
							me.changeAttr ("groupedColumns", this.getValue ())
						}
					}
				}, {
					fieldLabel: $o.getString ("Filter from action"),
					xtype: "$conffield", 
					labelWidth: 150,
					name: "filterAction", 
					value: filterAction,
					width: "100%",
					confRef: "action",
					choose: {
						type: "custom", fn: function () {
							var f = this;
							dialog.getAction ({success: function (options) {
								f.setValue (options.id);
							}});
						}

					},
					listeners: {
						change: function (value) {
							if (value) {
								value = $o.getAction (value).getFullCode ();
								me.down ("*[name=filter]").setValue (null);
								me.down ("*[name=filter]").disable ();
							} else {
								me.down ("*[name=filter]").enable ();
							};
							me.changeAttr ("filter", value);
						}
					}
				}, {
					layout: "hbox",
					width: "100%",
					border: 0,
					flex: 1,
					items: [{
						layout: "fit",
						width: "30%",
						height: "100%",
						title: $o.getString ("Menu"),
						iconCls: "gi_list",
						bodyPadding: 2,
						items: {
							xtype: "$actiondesigner",
							name: "actions",
							value: me.value.olap.actions,
							listeners: {
								change: function (value) {
									me.changeAttr ("actions", value)
								}
							}
						}
					}, {
						layout: "fit",
						width: "40%",
						height: "100%",
						title: $o.getString ("Filter"),
						iconCls: "gi_filter",
						bodyPadding: 2,
						style: "margin-left: 1px",
						items: {
							xtype: "$layoutfilter",
							name: "filter",
							layoutDesigner: me.layoutDesigner,
							disabled: filterAction ? true : false,
							value: filterAction ? null : me.value.olap.filter,
							$cmpId: me.value.olap.id,
							$viewId: me.value.olap.view,
							listeners: {
								change: function (value) {
									me.changeAttr ("filter", value);
									me.validator.call (this);
								}
							}
						}
					}, {
						layout: "fit",
						width: "30%",
						height: "100%",
						title: $o.getString ("Totals"),
						iconCls: "gi_calculator",
						bodyPadding: 2,
						style: "margin-left: 1px",
						items: {
							xtype: "$layouttotal",
							name: "total",
							layoutDesigner: me.layoutDesigner,
							value: me.value.olap.total,
							viewId: me.value.olap.view ? $o.getView (me.value.olap.view).get ("id") : null,
							listeners: {
								change: function (value) {
									me.changeAttr ("total", value)
								}
							}
						}
					}]
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Events"),
				iconCls: "gi_wifi_alt",
				border: 0,
				items: {
					xtype: "$eventdesigner",
					name: "events",
					value: me.value.olap.listeners,
					$events: ["afterrender", "dblclick", "cellRenderer"],
					listeners: {
						changeevent: function (value) {
							me.changeAttr ("listeners", value)
						}
					}
				}
			}, {
				layout: "fit",
				title: $o.getString ("Source code"),
				iconCls: "gi_notes",
				border: 0,
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};
		this.callParent (arguments);
	},
	validator: function () {
		var me = this;
		var of = me.down ("*[name='view']");
		if (of.getValue ()) {
			if (!$o.getView (of.getValue ()).get ("query")) {
				common.message ($o.getString ("Selected view does not contain a query"));
				me.down ("button[name='ok']").disable ();
			} else {
				me.down ("button[name='ok']").enable ();
			};
		} else {
			me.down ("button[name='ok']").disable ();
		};
		return true;
	}
});

Ext.define ("$o.LayoutTreegrid.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layouttreegrid", "widget.$layouttreegrid"],
	cmpCode: "treegrid",
	initComponent: function () {
		var me = this;
		me.value = me.value || {
			treegrid: {
				id: "cmp-" + (me.layoutDesigner.counter ++)
			}
		};
		var dataAttrs = me.getData ();
		me.items = {
			xtype: "tabpanel",
			items: [{
				layout: "vbox",
				title: $o.getString ("Commons"),
				iconCls: "gi_edit",
				bodyPadding: 5,
				items: [{
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Identifier"),
					name: "id",
					style: "margin-top: 5px;",
					value: me.value.treegrid.id,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.treegrid.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					},
					validator: me.validator
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.treegrid.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "$conffield", 
					fieldLabel: $o.getString ("Query"),
					name: "view", 
					value: me.value.treegrid.view, 
					width: "100%",
					confRef: "view",
					choose: {
						type: "custom", fn: function () {
							var field = this;
							dialog.getView ({hasQuery: 1, success: function (options) {
								field.setValue (options.id);
								me.changeAttr ("view", options.id ? $o.getView (options.id).getFullCode () : undefined)
								var data = me.getData ();
								me.down ("*[name='idAttr']").getStore ().loadData (data);
								me.down ("*[name='idAttr']").setValue (null);
								me.down ("*[name='parent']").getStore ().loadData (data);
								me.down ("*[name='parent']").setValue (null);
								me.validator.call (field);
							}});
						}
					},
					listeners: {
						afterrender: function () {
							me.validator.call (this);
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Node identifier"),
					name: "idAttr",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: new Ext.data.ArrayStore ({
						fields: ["id", "text"],
						data: dataAttrs
					}),
					valueField: "id",
					displayField: "text",
					value: me.value.treegrid.fields ? me.value.treegrid.fields.id : null,
					validator: me.validator
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Parent node identifier"),
					name: "parent",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: new Ext.data.ArrayStore ({
						fields: ["id", "text"],
						data: dataAttrs
					}),
					valueField: "id",
					displayField: "text",
					value: me.value.treegrid.fields ? me.value.treegrid.fields.parent : null,
					validator: me.validator
				}, {
					layout: "fit",
					width: "100%",
					flex: 1,
					title: $o.getString ("Menu"),
					iconCls: "gi_list",
					bodyPadding: 2,
					items: {
						xtype: "$actiondesigner",
						name: "actions",
						value: me.value.treegrid.actions,
						listeners: {
							change: function (value) {
								me.changeAttr ("actions", value)
							}
						}
					}
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Events"),
				iconCls: "gi_wifi_alt",
				border: 0,
				items: {
					xtype: "$eventdesigner",
					name: "events",
					value: me.value.treegrid.listeners,
					$events: ["dblclick"],
					listeners: {
						changeevent: function (value) {
							me.changeAttr ("listeners", value)
						}
					}
				}
			}, {
				layout: "fit",
				title: $o.getString ("Source code"),
				iconCls: "gi_notes",
				border: 0,
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};
		this.callParent (arguments);
	},
	getData: function () {
		var me = this;
		var r = [];
		if (me.value.treegrid.view) {
			var v = $o.getView (me.value.treegrid.view);
			for (var attr in v.attrs) {
				var va = v.attrs [attr];
				if (va.get ("classAttr")) {
					var ca = $o.getClassAttr (va.get ("classAttr"));
					if (!(ca.get ("type") == 2 || ca.get ("type") == 12 || ca.get ("type") >= 1000)) {
						continue;
					};
				};
				r.push ([attr, va.toString ()]);
			};
		};
		return r;
	},
	validator: function () {
		var me = this.up ("panel[cmpCode='treegrid']");
		var of = me.down ("*[name='view']");
		var idField = me.down ("*[name='idAttr']");
		var parentField = me.down ("*[name='parent']");
		if (!idField.getValue () || !parentField.getValue () || idField.getValue () == parentField.getValue ()) {
			me.down ("button[name='ok']").disable ();
			return true;
		};
		if (idField.getValue () && parentField.getValue ()) {
			me.changeAttr ("fields", {
				id: idField.getValue (),
				parent: parentField.getValue ()
			})
		};
		if (of.getValue ()) {
			if (!$o.getView (of.getValue ()).get ("query")) {
				common.message ($o.getString ("Selected view does not contain a query"));
				me.down ("button[name='ok']").disable ();
			} else {
				me.down ("button[name='ok']").enable ();
			};
		} else {
			me.down ("button[name='ok']").disable ();
		};
		return true;
	}
});

Ext.define ("$o.LayoutSplit.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layoutsplit"],
	cmpCode: "split",
	initComponent: function () {
		var me = this;
		me.value = me.value || {
			split: {
				id: "cmp-" + (me.layoutDesigner.counter ++),
				orientation: "horizontal",
				width: "50%",
				items: [
					me.layoutDesigner.createEmpty (), me.layoutDesigner.createEmpty ()
				]
			}
		};
		var w = me.value.split.width || me.value.split.height;
		var ed;
		if (typeof (w) == "string") {
			ed = "%";
			w = w.substr (0, w.length - 1);
		} else {
			ed = "px";
		};
		me.items = {
			xtype: "tabpanel",
			items: [{
				layout: "vbox",
				title: $o.getString ("Commons"),
				iconCls: "gi_edit",
				bodyPadding: 5,
				items: [{
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Identifier"),
					name: "id",
					style: "margin-top: 5px;",
					value: me.value.split.id,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.split.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.split.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Orientation"),
					name: "orientation",
					width: "100%",
					triggerAction: "all",
					lazyRender: true,
					mode: "local",
					queryMode: "local",
					editable: false,
					store: new Ext.data.ArrayStore ({
						fields: ["id", "text"],
						data: [
							["horizontal", $o.getString ("Horizontal")],
							["vertical", $o.getString ("Vertical")]
						]
					}),
					valueField: "id",
					displayField: "text",
					style: "margin-top: 5px;",
					value: me.value.split.orientation,
					listeners: {
						select: function () {
							me.changeAttr ("orientation", this.getValue ());
						}
					}
				}, {
					xtype: "compositefield",
					fieldLabel: $o.getString ("Width (height) of left (top) component"),
					items: [{
						xtype: "numberfield",
						name: "width",
						value: w,
						width: 100,
						validator: function (value) {
							if (this.getValue ()) {
								me.down ("button[name='ok']").enable ();
							} else {
								me.down ("button[name='ok']").disable ();
							};
							if (me.down ("*[name=ed]").getValue () == "%") {
								me.changeAttr ("width", this.getValue () + "%");
							} else {
								me.changeAttr ("width", Number (this.getValue ()));
							};
							return true;
						}
					}, {
						xtype: "combo",
						name: "ed",
						width: 50,
						triggerAction: "all",
						lazyRender: true,
						mode: "local",
						queryMode: "local",
						editable: false,
						store: new Ext.data.ArrayStore ({
							fields: ["id", "text"],
							data: [
								["%", "%"],
								["px", "px"]
							]
						}),
						valueField: "id",
						displayField: "text",
						style: "margin-left: 2px;",
						value: ed,
						listeners: {
							select: function () {
								if (this.getValue () == "%") {
									if (me.down ("*[name=width]").getValue () > 90) {
										me.down ("*[name=width]").setValue (90)
									};
									me.changeAttr ("width", me.down ("*[name=width]").getValue () + "%");
								} else {
									me.changeAttr ("width", Number (me.down ("*[name=width]").getValue ()));
								};
							}
						}
					}]
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Source code"),
				iconCls: "gi_notes",
				border: 0,
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};			
		this.callParent (arguments);
	}
});

Ext.define ("$o.LayoutTab.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layouttab"],
	cmpCode: "tab",
	initComponent: function () {
		var me = this;
		var cmp = me.layoutDesigner.createEmpty ();
		cmp.panel.title = $o.getString ("Tab");
		me.value = me.value || {
			tab: {
				id: "cmp-" + (me.layoutDesigner.counter ++),
				items: [cmp]
			}
		};
		me.items = {
			xtype: "tabpanel",
			items: [{
				layout: "vbox",
				title: $o.getString ("Commons"),
				iconCls: "gi_edit",
				bodyPadding: 5,
				items: [{
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Identifier"),
					name: "id",
					style: "margin-top: 5px;",
					value: me.value.tab.id,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.tab.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.tab.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Source code"),
				iconCls: "gi_notes",
				border: 0,
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};			
		this.callParent (arguments);
	}
});

Ext.define ("$o.LayoutCondition.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layoutcondition", "widget.$layoutcondition"],
	layout: "vbox",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.filter = me.filter || [];
		me.value = {};
		me.tbar = [{
			text: "Ок",
			iconCls: "gi_ok",
			name: "save",
			disabled: 1,
			handler: me.save,
			scope: me
		}, {
			text: $o.getString ("Cancel"),
			iconCls: "gi_remove",
			name: "cancel",
			handler: function () {
				me.up ("window").close ();
			}
		}];
		var dataAttrs = [];
		for (var attr in me.$view.attrs) {
			var a = me.$view.attrs [attr];
			dataAttrs.push ([attr, a.toString ()]);
		};
		me.items = [{
			xtype: "combo",
			fieldLabel: $o.getString ("And", "/", "Or"),
			labelWidth: 200,
			name: "and_or",
			width: 350,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: [
					["and", $o.getString ("And")],
					["or", $o.getString ("Or")]
				]
			}),
			valueField: "id",
			displayField: "text"
			/*
		}, {
			xtype: "checkbox",
			name: "brackets",
			labelWidth: 200,
			fieldLabel: "Условие в скобках"
			*/
		}, {
			xtype: "combo",
			fieldLabel: $o.getString ("Attribute of this component"),
			name: "attr",
			width: "100%",
			labelWidth: 200,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: dataAttrs
			}),
			valueField: "id",
			displayField: "text",
			validator: me.validator
		}, {
			xtype: "combo",
			fieldLabel: $o.getString ("Operator"),
			labelWidth: 200,
			name: "oper",
			width: 350,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: [
					["=", $o.getString ("equal") + " (=)"],
					["<>", $o.getString ("not equal") + " (<>)"],
					["<", $o.getString ("less") + " (<)"],
					[">", $o.getString ("more") + " (>)"],
					["<=", $o.getString ("less or equal") + " (<=)"],
					[">=", $o.getString ("more or equal") + " (>=)"],
					["is null", $o.getString ("empty") + " (is null)"],
					["is not null", $o.getString ("not null") + " (is not null)"],
					["in", $o.getString ("one of list") + " (in)"]
				]
			}),
			valueField: "id",
			displayField: "text",
			listeners: {
				select: function () {
					var v = this.getValue ();
					if (v == "is null" || v == "is not null") {
						me.down ("*[name='value']").disable ();
						me.down ("*[name='attrValue']").disable ();
					} else {
						me.down ("*[name='value']").enable ();
						if (v == "in") {
							me.down ("*[name='attrValue']").disable ();
						} else {
							me.down ("*[name='attrValue']").enable ();
						};
					};
				}
			},
			validator: me.validator
		}, {
			xtype: "textfield",
			fieldLabel: $o.getString ("Value"),
			labelWidth: 200,
			width: "100%",
			name: "value",
			validator: me.validator
		}, {			
			xtype: "combo",
			fieldLabel: $o.getString ("Attribute of another component"),
			name: "attrValue",
			width: "100%",
			labelWidth: 200,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: me.getOtherAttrs ()
			}),
			valueField: "id",
			displayField: "text",
			validator: me.validator
		}];
		if (!me.filter.length) {
			me.items.splice (0, 1);
		};
		me.items [0].style = "margin-top: 5px;";
		me.addEvents ("aftersave");
		this.callParent (arguments);
	},
	validator: function (value) {
		var me = this.up ("panel");
		var andOrField = me.down ("*[name='and_or']");
		var attrField = me.down ("*[name='attr']");
		var operField = me.down ("*[name='oper']");
		var valueField = me.down ("*[name='value']");
		var attrValueField = me.down ("*[name='attrValue']");
		if (andOrField && !andOrField.getValue ()) {
			me.down ("button[name='save']").disable ();
			return true;
		};
		if (attrField.getValue () && operField.getValue () && (
			operField.getValue () == "is null" || operField.getValue () == "is not null" || valueField.getValue () || attrValueField.getValue ()
		)) {
			me.down ("button[name='save']").enable ();
			if (operField.getValue () == "is null" || operField.getValue () == "is not null") {
				me.value = [attrField.getValue (), operField.getValue ()];
			} else {
				var val = valueField.getValue ();
				if (attrValueField.getValue ()) {
					var v = attrValueField.getValue ();
					val = {id: v.split (":")[0], attr: v.split (":")[1]};
				};
				me.value = [attrField.getValue (), operField.getValue (), val];
			};
//			var bracketsField = me.down ("*[name='brackets']");
//			if (bracketsField && bracketsField.getValue ()) {
//				me.value = [andOrField.getValue (), [me.value]];
//			} else {
			if (andOrField) {
				me.value = [andOrField.getValue ()].concat (me.value);
			};
//			};
		} else {
			me.down ("button[name='save']").disable ();
			me.value = [];
		};
		return true;
	},
	getOtherAttrs: function () {
		var me = this;
		var r = [];
		var get = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (layout [a].id && layout [a].view && layout [a].id != me.$cmpId) {
						var v = $o.getView (layout [a].view);
						for (var attr in v.attrs) {
							r.push ([layout [a].id + ":" + attr, layout [a].id + ":" + v.attrs [attr].toString ()]);
						};
					};
					get (layout [a]);
				};
			};
		};
		get (me.layoutDesigner.value);
		return r;
	},
	save: function () {
		var me = this;
		me.fireEvent ("aftersave", me.value);
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});

Ext.define ("$o.LayoutFilter.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layoutfilter", "widget.$layoutfilter"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.value = me.value || [];
		if (!me.classMode) {
			me.$view = $o.getView (me.$viewId);
		};
		var grid = me.getItems ();
		grid.width = "100%";
		grid.flex = 1;
		me.items = grid;
    	me.tbar = [{
    		text: $o.getString ("Add"),
    		name: "create",
    		iconCls: "gi_circle_plus",
    		handler: me.createCondition,
    		scope: me
    	}, {
    		text: $o.getString ("Clear"),
    		name: "delete",
    		iconCls: "gi_circle_minus",
    		scope: me,
    		handler: function () {
				me.value = [];
				me.build ();
				me.fireEvent ("change", me.value);		
    		}
    	}];
		me.addEvents ("change");
		this.callParent (arguments);
	},
	build: function () {
		var me = this;
		var items = me.getItems ();
		me.removeAll ();
		me.add (items);
		me.doLayout ();
	},
	createCondition: function () {
		var me = this;
		var conditionType = "$o.layoutcondition"
		if (me.classMode) {
			conditionType = "$o.querycondition"; 
		};
		if (me.reportMode) {
			conditionType = "$o.reportcondition"; 
		};
		var win = Ext.create ("Ext.Window", {
			width: 600,
			height: 400,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: $o.getString ("Condition"),
			iconCls: "gi_filter",
			bodyPadding: 5,
			modal: 1,
			items: {
				xtype: conditionType,
				filter: me.value,
				$cmpId: me.$cmpId,
				$view: me.$view,
				$classes: me.$classes,
				$classAliases: me.$classAliases,
				$aliases: me.$aliases,
				layoutDesigner: me.layoutDesigner,
				listeners: {
					aftersave: function (value) {
						win.close ();
						me.value = me.value || [];
						me.value = me.value.concat (value);
						me.build ();
						me.fireEvent ("change", me.value);		
					}
				}
			}
		});
		win.show ();
	},
	getItems: function () {
		var me = this;
		var data = [];
		function getConditions (arr, n) {
			for (var i = 0; i < arr.length; i ++) {
				var npp = (n ? n : "") + (i + 1) + ".";
				var space = "";
				if (npp.split (".").length > 2) {
					for (var j = 0; j < npp.length; j ++) {
						space += "_";
					};
				};
				if (Ext.isArray (arr [i])) {
					getConditions (arr [i], npp);
				} else {
					if (arr [i + 2] == "and" || arr [i + 2] == "or" || i == arr.length - 2) {
						data.push ({
							attr: space + me.getAttrName (arr [i]),
							oper: me.getOperName (arr [i + 1])
						});
						i += 2;
					} else {
						data.push ({
							attr: space + me.getAttrName (arr [i]),
							oper: me.getOperName (arr [i + 1]),
							value: me.getValueName (arr [i + 2])
						});
						i += 3;
					};
					if (i < arr.length) {
						data.push ({
							attr: space + (arr [i] == "and" ? "И" : "ИЛИ")
						});
					};
				};
			};
		};
		if (me.value) {
			getConditions (me.value);
		};
	    var store = Ext.create ("Ext.data.Store", {
	        data: data,
	        fields: [{
	        	name: "attr", type: "string"
			}, {
	        	name: "oper", type: "string"
			}, {
	        	name: "value", type: "string"
	        }]
	    });
		var grid = Ext.create ("Ext.grid.Panel", {
			store: store,
			columns: [{
				header: $o.getString ("Attribute"), width: 100, dataIndex: "attr", renderer: me.cellRenderer
			}, {
				header: $o.getString ("Operator"), width: 100, dataIndex: "oper", renderer: me.cellRenderer
			}, {
				header: $o.getString ("Value"), width: 100, dataIndex: "value", renderer: me.cellRenderer
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		return grid;
	},
	getAttrName: function (attr, viewCode) {
		var me = this;
		var r = attr;
		if (viewCode && $o.getView (viewCode).attrs [attr]) {
			r = $o.getView (viewCode).attrs [attr].toString ();
		} else
		if (!me.classMode && me.$view.attrs [attr]) {
			r = me.$view.attrs [attr].toString ();
		} else
		if (me.classMode && typeof (attr) == "object") {
			var clsId, alias; for (alias in attr) {break;};
			for (var i = 0; i < me.$aliases.length; i ++) {
				if (me.$aliases [i] == alias) {
					var cls = $o.getClass (me.$classes [i]);
					if (cls.attrs [attr [alias]]) {
						r = alias + ":" + cls.attrs [attr [alias]].toString ();
						break;
					};
				};
			};
		};
		return r;
	},
	getOperName: function (oper) {
		var o = {};
		o ["="] = $o.getString ("equal") + " (=)";
		o ["<>"] = $o.getString ("not equal") + " (<>)";
		o ["<"] = $o.getString ("less") + " (<)";
		o [">"] = $o.getString ("more") + " (>)";
		o ["<="] = $o.getString ("less or equal") + " (<=)";
		o [">="] = $o.getString ("more or equal") + " (>=)";
		o ["is null"] = $o.getString ("empty") + " (is null)";
		o ["is not null"] = $o.getString ("not null") + " (is not null)";
		o ["in"] = $o.getString ("one of list") + " (in)";
		return o [oper];
	},
	getValueName: function (v) {
		var me = this;
		if (Ext.isArray (v)) {
			return v.join (", ");
		} else
		if (typeof (v) == "object") {
			if (me.classMode) {
				return me.getAttrName (v);
			} else {
				var cmp = me.layoutDesigner.getCmp (v.id);
				var cmpCode = me.layoutDesigner.getCmpCode (v.id);
				var otherView = cmp [cmpCode].view;
				return me.getAttrName (v.attr, otherView);
			};
		} else {
			return v;
		};
	},
	cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
		if (value) {
			var tip = value;
			if (typeof (tip) == "string") {
				tip = tip.split ('"').join ("'");
			}
			metaData.tdAttr = 'data-qtip="' + tip + '"';
		};
		return value;
	},
	setValue: function (value) {
		var me = this;
		me.value = value;
		me.build ();
	},
	setViewId: function (id) {
		var me = this;
		me.$viewId = id;
		me.$view = $o.getView (me.$viewId);
	},
	setCmpId: function (id) {
		var me = this;
		me.$cmpId = id;
	},
	setClasses: function (classes, classAliases, aliases) {
		var me = this;
		me.$classes = classes;
		me.$classAliases = classAliases;
		me.$aliases = aliases;
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});

Ext.define ("$o.LayoutCard.Widget", {
	extend: "$o.LayoutEditor",
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	alias: ["widget.$o.layoutcard", "widget.$layoutcard"],
	cmpCode: "card",
	initComponent: function () {
		var me = this;
		var id = me.layoutDesigner ? ("cmp-" + me.layoutDesigner.counter ++) : "card";
		me.value = me.value || {
			card: {
				id: id,
				items: []
			}
		};
		me.value.card.object = me.value.card.object || [];
		if (!Ext.isArray (me.value.card.object)) {
			me.value.card.object = [me.value.card.object];
		};
		var items = [{
			layout: "column",
			border: 0,
			width: "100%",
			items: [{
				columnWidth: 0.5,
				border: 0,
				items: [{
					xtype: "compositefield",
					width: 375,
					labelWidth: 100,
					fieldLabel: $o.getString ("Identifier"),
					style: "margin-top: 5px;",
					items: [{
						xtype: "textfield",
						name: "id",
						value: me.value.card.id,
						listeners: {
							change: function () {
								me.changeAttr ("id", this.getValue ());
							}
						}
					}, {
						xtype: "displayfield", value: $o.getString ("Read only") + ":", style: "margin-left: 5px;"
					}, {
						xtype: "checkbox",
						name: "readOnly",
						value: me.value.card.readOnly,
						listeners: {
							change: function () {
								me.changeAttr ("readOnly", this.getValue ());
							}
						}
					}]
				}, {
					xtype: "textfield",
					labelWidth: 100,
					width: 375,
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.card.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					labelWidth: 100,
					width: 375, 
					name: "iconCls",
					value: me.value.card.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}]
			}, {
				columnWidth: 0.5,
				border: 0,
				style: "margin-left: 5px",
				items: [{
					xtype: "grid",
					name: "tags",
					store: {
						xtype: "store",
						fields: ["clsName", "cls", "tag", "cmpAttrName", "cmpAttr"],
						data: []
					},
					columns: [{
						text: $o.getString ("Class of object"), dataIndex: "clsName", flex: 2
					}, {
						text: $o.getString ("Tag of object"), dataIndex: "tag", flex: 1
					}, {
						text: $o.getString ("Object by attribute of component"), dataIndex: "cmpAttrName", flex: 2
					}, {
						text: "cls", dataIndex: "cls", hidden: true
					}, {
						text: "cmpAttr", dataIndex: "cmpAttr", hidden: true
					}],
					tbar: [{
						text: $o.getString ("Add"),
						iconCls: "gi_circle_plus",
						handler: function () {
							var win = Ext.create ("Ext.Window", {
								title: $o.getString ("Tag", ":", "Adding"),
								width: 600,
								height: 400,
								layout: "vbox",
							    bodyPadding: 5,
								border: false,
								resizable: true,
								closable: true,
								style: "background-color: #ffffff",
								bodyStyle: "background-color: #ffffff",
								tbar: [{
									text: $o.getString ("Add"),
									iconCls: "gi_circle_plus",
									handler: function () {
										var store = me.down ("*[name=tags]").getStore ();
										var clsId = win.down ("*[name=cls]").getValue ();
										var tag = win.down ("*[name=tag]").getValue ();
										store.insert (store.getCount (), {
											cls: clsId,
											clsName: clsId ? $o.getClass (clsId).toString () : null,
											tag: tag,
											cmpAttr: win.down ("*[name=cmpAttr]").getValue ()
										});
										if (clsId) {
											me.value.card.object.push ({cls: $o.getClass (clsId).getFullCode (), tag: tag});
										} else {
											me.value.card.object.push ({tag: tag});
										};
										win.close ();
									}
								}],
								items: [{
									xtype: "$conffield", 
									fieldLabel: $o.getString ("Object class"),
									labelWidth: 200,
									name: "cls", 
									width: "100%",
									confRef: "class",
									choose: {
										type: "custom", fn: function () {
											var field = this;
											dialog.getClass ({success: function (options) {
												field.setValue (options.id);
											}});
										}
									}
								}, {
									xtype: "textfield",
									fieldLabel: $o.getString ("Tag of object"),
									labelWidth: 200,
									width: "100%",
									name: "tag"
								}, {
									xtype: "combo",
									fieldLabel: $o.getString ("Object by attribute of component"),
									name: "cmpAttr",
									anchor: "100%",
									labelWidth: 200,
									mode: "local",
									queryMode: "local",
									editable: false,
									store: new Ext.data.ArrayStore ({
										fields: ["id", "text"],
										data: me.layoutDesigner ? me.getViewCmpAttrs (JSON.parse (me.layoutDesigner.getValue ())) : []
									}),
									width: "100%",
									valueField: "id",
									displayField: "text"
								}]
							});
							win.show ();							
						}
					}, {
						text: $o.getString ("Remove"),
						iconCls: "gi_circle_minus",
						handler: function () {
							var grid = me.down ("*[name=tags]");
							if (grid.getSelectionModel ().hasSelection ()) {
								var rec = grid.getSelectionModel ().getSelection ()[0];
								for (var i = 0; i < me.value.card.object.length; i ++) {
									if (rec.get ("cls")) {
										var cls = $o.getClass (rec.get ("cls"));
										if (cls.getFullCode () == me.value.card.object [i].cls) {
											me.value.card.object.splice (i, 1);
											break;
										};
									};
									if (rec.get ("cmpAttr")) {
										if (rec.get ("cmpAttr") == me.value.card.object [i].cmpAttr) {
											me.value.card.object.splice (i, 1);
											break;
										};
									};
								};
								grid.getStore ().remove (rec);
							};
						}
					}],
					width: "100%",
					forceFit: true,
					height: 90,
					border: 1,
					selModel: Ext.create ("Ext.selection.RowModel", {
						mode: "SINGLE",
						listeners: {
							selectionchange: function (sm, records) {
								if (records.length) {
									var clsId = records [0].get ("cls");
									me.down ("*[name=cardDesigner]").setClassId (clsId, records [0].get ("tag"));
									me.down ("*[name=cardDesigner]").down ("*[name=tree]").getSelectionModel ().deselectAll ();
								};
							},
							scope: me
						}
					}),
					listeners: {
						afterrender: function () {
							if (me.value.card.object) {
								if (!Ext.isArray (me.value.card.object)) {
									me.value.card.object = [me.value.card.object];
								};
								for (var i = 0; i < me.value.card.object.length; i ++) {
									var cls = $o.getClass (me.value.card.object [i].cls);
									me.value.card.object [i].cls = cls.get ("id");
									me.value.card.object [i].clsName = cls.toString ();
								};
								this.getStore ().loadData (me.value.card.object);
							};
						}
					}
				}]
			}]
		}];
		items.push ({
			layout: "fit",
			title: $o.getString ("Card", ":", "Attributes"),
			name: "cardDesigner",
			width: "100%",
			border: 1,
			flex: 1,
			xtype: "$carddesigner",
			layoutCard: me,
			value: me.value.card.items
		});
		me.items = {
			xtype: "tabpanel",
			items: [{
				layout: "vbox",
				title: $o.getString ("Commons"),
				iconCls: "gi_edit",
				bodyPadding: 5,
				items: items
			}, {
				layout: "fit",
				title: $o.getString ("Events"),
				iconCls: "gi_wifi_alt",
				border: 0,
				items: {
					xtype: "$eventdesigner",
					name: "events",
					value: me.value.card.listeners,
					$events: ["aftersave", "afterrender", "beforerender"],
					listeners: {
						changeevent: function (value) {
							me.changeAttr ("listeners", value)
						}
					}
				}
			}, {
				layout: "fit",
				title: "Исходный код",
				iconCls: "gi_notes",
				border: 0,
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};
		me.addEvents ("change");
		me.on ("beforesave", function (options) {
			if (!options.convertion) {
				me.value.card.items = me.down ("*[name=cardDesigner]").getValue ();
				for (var i = 0; i < me.value.card.object.length; i ++) {
					delete me.value.card.object [i].clsName;
					me.value.card.object [i].cls = $o.getClass (me.value.card.object [i].cls).getFullCode ();
				};
				me.down ("*[name=json]").setValue (JSON.stringify (me.value, null, "\t"));
			};
		});
		this.callParent (arguments);
	},
	validator: function () {
		var me = this.up ("panel");
		if (me.down ("*[name=cls]").getValue () && (me.down ("*[name=tag]").getValue () || me.down ("*[name=cmpAttr]").getValue ())) {
			me.up ("window").down ("button[name=ok]").enable ();
		} else {
			me.up ("window").down ("button[name=ok]").disable ();
		};
		return true;
	},
	getViewCmpAttrs: function (layout) {
		var me = this;
		try {
			if (typeof (layout) == "string") {
				layout = eval ("(" + layout + ")");
			};
		} catch (e) {
		};
		if (!layout) {
			return [];
		};
		var data = [];
		me.cmpAttrId = {};
		var get = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (layout [a].id && layout [a].view) {
						v = $o.getView (layout [a].view);
						for (var attr in v.attrs) {
							var va = v.attrs [attr];
							if (va.get ("classAttr")) {
								var ca = $o.getClassAttr (va.get ("classAttr"));
								if (!(ca.get ("type") == 2 || ca.get ("type") == 12 || ca.get ("type") >= 1000)) {
									continue;
								};
							};
							data.push ([layout [a].id + "." + attr, layout [a].id + ":" + va.toString ()]);
							me.cmpAttrId [layout [a].id + "." + attr] = va.get ("id");
						};
					};
					get (layout [a]);
				};
			};
		};
		get (layout);
		return data;
	},
	setValue: function (value) {
		var me = this;
		me.value = value;
		me.value.card.object = me.value.card.object || [];
		if (!Ext.isArray (me.value.card.object)) {
			me.value.card.object = [me.value.card.object];
		};
		me.down ("*[name=json]").setValue (JSON.stringify (value, null, "\t"));
		me.build ();
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});

Ext.define ("$o.LayoutTotal.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layouttotal", "widget.$layouttotal"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.value = me.value || {};
    	me.tbar = [{
    		text: $o.getString ("Clear"),
    		name: "delete",
    		iconCls: "gi_circle_minus",
    		scope: me,
    		handler: function () {
				me.value = {};
				me.build ();
				me.fireEvent ("change", me.value);		
    		}
    	}];
	    me.store = Ext.create ("Ext.data.Store", {
	        data: [],
	    	autoSync: true,
	        fields: [{
	        	name: "attr", type: "string"
			}, {
	        	name: "total", type: "string"
	        }],
	        listeners: {
	        	datachanged: me.datachanged,
	        	scope: me
	        }
	    });
		var cellEditing = new Ext.grid.plugin.CellEditing ({
	        clicksToEdit: 1
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: $o.getString ("Attribute"), dataIndex: "attr"
			}, {
				header: $o.getString ("Total"), width: 100, dataIndex: "total", editor: {
					xtype: "combo",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: new Ext.data.ArrayStore ({
						fields: ["id", "text"],
				        data: [
				        	["sum", $o.getString ("Sum")],
				        	["avg", $o.getString ("Average")],
				        	["max", $o.getString ("Max")],
				        	["min", $o.getString ("Min")]
				        ]
					}),
					valueField: "id",
					displayField: "text"
				}, renderer: function (value, metaData, record, rowIndex, colIndex, store) {
					metaData.tdAttr += ' style=";border: 1px gray solid;"';
					switch (value) {
					case "sum":
						value = $o.getString ("Sum");
						break;
				    case "avg":
				    	value = $o.getString ("Average");
				    	break;
				    case "max":
				    	value = $o.getString ("Max");
				    	break;
				    case "min":
				    	value = $o.getString ("Min");
				    };
					return value;
			    }
			}],
			plugins: [cellEditing],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.items = me.grid;
		me.addEvents ("change");
		me.build ();
		this.callParent (arguments);
	},
	datachanged: function () {
		var me = this;
		if (me.store) {
			me.value = {};
			for (var i = 0; i < me.store.getCount (); i ++) {
				if (me.store.getAt (i).get ("total")) {
					me.value [me.store.getAt (i).get ("attr")] = me.store.getAt (i).get ("total");
				};
			};
			me.fireEvent ("change", me.value);		
		};
	},
	setViewId: function (viewId) {
		var me = this;
		if (me.viewId != viewId) {
			me.value = {};
		};
		me.viewId = viewId;
		me.build ();
	},
	build: function () {
		var me = this;
		var view = $o.getView (me.viewId) || {};
		var data = [];
		for (var attr in view.attrs) {
			var va = view.attrs [attr];
			if (!va.get ("classAttr") || $o.getClassAttr (va.get ("classAttr")).get ("type") == 2) {
				data.push ([attr, me.value [attr]]);
			};
		};
		me.store.loadData (data);
	}
});

Ext.define ("$o.LayoutChart.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layoutchart", "widget.$layoutchart"],
	cmpCode: "chart",
	border: 1,
	initComponent: function () {
		var me = this;
		me.value = me.value || {
			chart: {
				id: "cmp-" + (me.layoutDesigner.counter ++)
			}
		};
		me.storeMark = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: []
		});
		me.storeValue = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: []
		});
		me.items = {
			xtype: "tabpanel",
			items: [{
				layout: "vbox",
				title: $o.getString ("Commons"),
				iconCls: "gi_edit",
				bodyPadding: 5,
				items: [{
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Identifier"),
					name: "id",
					style: "margin-top: 5px;",
					value: me.value.chart.id,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
							me.down ("*[name=filter]").setCmpId (this.getValue ());
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.chart.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.chart.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "$conffield", 
					fieldLabel: $o.getString ("Query"),
					name: "view", 
					value: me.value.chart.view, 
					width: "100%",
					confRef: "view",
					choose: {
						type: "custom", fn: function () {
							var me = this;
							system.view.selectQuery ({success: function (options) {
								me.setValue (options.value);
								me.fireEvent ("change", options.value);
							}});
						}
					},
					listeners: {
						afterrender: function () {
							me.validator ();
						},
						change: function () {
							me.validator.call (this);
							var viewCode = this.getValue () ? $o.getView (this.getValue ()).getFullCode () : undefined;
							me.changeAttr ("view", viewCode)
							me.down ("*[name=filter]").setViewId (viewCode ? $o.getView (viewCode).get ("id") : null);
							me.updateStores (this.getValue ());
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Mark", ":", "Attribute"),
					name: "attrMark",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: me.storeMark,
					value: me.value.chart.attrMark,
					valueField: "id",
					displayField: "text",
					validator: me.validator,
					listeners: {
						select: function () {
							me.changeAttr ("attrMark", this.getValue ());
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Value", ":", "Attribute"),
					name: "attrValue",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: me.storeValue,
					value: me.value.chart.attrValue,
					valueField: "id",
					displayField: "text",
					validator: me.validator,
					listeners: {
						select: function () {
							me.changeAttr ("attrValue", this.getValue ());
						}
					}
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Title of marks"),
					width: "100%",
					name: "titleMark",
					validator: me.validator,
					value: me.value.chart.titleMark,
					listeners: {
						change: function () {
							me.changeAttr ("titleMark", this.getValue ());
						}
					}
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Title of values"),
					width: "100%",
					name: "titleValue",
					validator: me.validator,
					value: me.value.chart.titleValue,
					listeners: {
						change: function () {
							me.changeAttr ("titleValue", this.getValue ());
						}
					}
				}, {
					layout: "fit",
					width: "100%",
					flex: 1,
					title: $o.getString ("Filter"),
					iconCls: "gi_filter",
					bodyPadding: 2,
					items: {
						xtype: "$layoutfilter",
						name: "filter",
						layoutDesigner: me.layoutDesigner,
						value: me.value.chart.filter,
						$cmpId: me.value.chart.id,
						$viewId: me.value.chart.view,
						listeners: {
							change: function (value) {
								me.changeAttr ("filter", value);
								me.validator.call (this);
							}
						}
					}
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Source code"),
				iconCls: "gi_notes",
				border: 0,
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};
		this.callParent (arguments);
	},
	updateStores: function (viewId) {
		var me = this;
		me.down ("*[name=attrMark]").setValue (null);
		me.down ("*[name=attrValue]").setValue (null);
		var data = [];
		if (viewId) {
			var view = $o.getView (viewId);
			for (var attr in view.attrs) {
				data.push ([attr, view.attrs [attr].toString ()]);
			};
		};
		me.storeMark.loadData (data);
		data = [];
		if (viewId) {
			var view = $o.getView (viewId);
			for (var attr in view.attrs) {
				var va = view.attrs [attr];
				if (!va.get ("classAttr") || $o.getClassAttr (va.get ("classAttr")).get ("type") == 2) {
					data.push ([attr, va.toString ()]);
				};
			};
		};
		me.storeValue.loadData (data);
	},
	validator: function () {
		var me = this.up ("window");
		if (me.down ("*[name=view]").getValue () && me.down ("*[name=attrMark]").getValue () && me.down ("*[name=attrValue]").getValue ()) {
			me.down ("button[name='ok']").enable ();
		} else {
			me.down ("button[name='ok']").disable ();
		};
		return true;
	}
});

Ext.define ("$o.LayoutImage.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layoutimage", "widget.$layoutimage"],
	cmpCode: "image",
	border: 1,
	initComponent: function () {
		var me = this;
		me.value = me.value || {
			image: {
				id: "cmp-" + (me.layoutDesigner.counter ++)
			}
		};
		me.store = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: me.getOtherAttrs ()
		});
		me.items = {
			xtype: "tabpanel",
			items: [{
				layout: "vbox",
				title: $o.getString ("Commons"),
				iconCls: "gi_edit",
				bodyPadding: 5,
				items: [{
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Identifier"),
					name: "id",
					style: "margin-top: 5px;",
					value: me.value.image.id,
					validator: me.validator,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
							me.down ("*[name=filter]").setCmpId (this.getValue ());
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.image.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.image.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Reference") + " (URL)",
					name: "url",
					value: me.value.image.url,
					validator: me.validator,
					listeners: {
						change: function () {
							me.changeAttr ("url", this.getValue ());
							me.down ("*[name=attr]").setValue (null);
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Component attribute"),
					name: "attr",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: me.store,
					value: me.value.image.attr,
					valueField: "id",
					displayField: "text",
					validator: me.validator,
					listeners: {
						select: function () {
							me.changeAttr ("attr", this.getValue ());
							me.down ("*[name=url]").setValue (null);
						}
					}
				}, {
					xtype: "numberfield",
					width: 300, 
					fieldLabel: $o.getString ("Width"),
					name: "width",
					value: me.value.image.width,
					validator: me.validator,
					listeners: {
						change: function () {
							me.changeAttr ("width", this.getValue ());
						}
					}
				}, {
					xtype: "numberfield",
					width: 300, 
					fieldLabel: $o.getString ("Height"),
					name: "height",
					value: me.value.image.height,
					validator: me.validator,
					listeners: {
						change: function () {
							me.changeAttr ("height", this.getValue ());
						}
					}
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Source code"),
				iconCls: "gi_notes",
				border: 0,
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};
		this.callParent (arguments);
	},
	getOtherAttrs: function () {
		var me = this;
		var r = [];
		var get = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (layout [a].id && layout [a].id != me.$cmpId) {
						if (layout [a].view) {
							var v = $o.getView (layout [a].view);
							for (var attr in v.attrs) {
								var va = v.attrs [attr];
								//if ((a == "card" && va.get ("classAttr") && $o.getClassAttr (va.get ("classAttr")).get ("type") == 5) || 
								//	(a != "card" && va.get ("classAttr") && $o.getClassAttr (va.get ("classAttr")).get ("type") == 1)
								if (va.get ("classAttr") && $o.getClassAttr (va.get ("classAttr")).get ("type") == 5) {
									r.push ([layout [a].id + "." + attr, layout [a].id + ":" + va.toString ()]);
								};
							};
						};
						if (a == "card" && layout [a].object && layout [a].object.cls) {
							var cls = $o.getClass (layout [a].object.cls);
							function getAttrs (items) {
								if (items) {
									for (var i = 0; i < items.length; i ++) {
										var item = items [i];
										var ca = cls.attrs [item.attr];
										if (item.objectId && item.attr && ca && ca.get ("type") == 5) {
											r.push ([layout [a].id + "." + item.attr, layout [a].id + ":" + ca.toString ()]);
										};
										if (item.items) {
											getAttrs (item.items);
										};
									};
								};
							};
							getAttrs (layout [a].items);
						};
					};
					get (layout [a]);
				};
			};
		};
		get (me.layoutDesigner.value);
		return r;
	},
	validator: function () {
		var me = this.up ("window");
		if (me.down ("*[name=id]").getValue () && (me.down ("*[name=url]").getValue () || me.down ("*[name=attr]").getValue ())) {
			me.down ("button[name='ok']").enable ();
		} else {
			me.down ("button[name='ok']").disable ();
		};
		return true;
	}
});

Ext.define ("$o.LayoutFrame.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layoutframe", "widget.$layoutframe"],
	cmpCode: "frame",
	border: 0,
	initComponent: function () {
		var me = this;
		me.value = me.value || {
			frame: {
				id: "cmp-" + (me.layoutDesigner.counter ++)
			}
		};
		me.store = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: me.getOtherAttrs ()
		});
		me.items = {
			xtype: "tabpanel",
			items: [{
				layout: "vbox",
				title: $o.getString ("Commons"),
				iconCls: "gi_edit",
				bodyPadding: 5,
				items: [{
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Identifier"),
					name: "id",
					style: "margin-top: 5px;",
					value: me.value.frame.id,
					validator: me.validator,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
							me.down ("*[name=filter]").setCmpId (this.getValue ());
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.frame.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.frame.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Reference") + " (URL)",
					name: "url",
					value: me.value.frame.url,
					validator: me.validator,
					listeners: {
						change: function () {
							me.changeAttr ("url", this.getValue ());
							me.down ("*[name=attr]").setValue (null);
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Component attribute"),
					name: "attr",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: me.store,
					value: me.value.frame.attr,
					valueField: "id",
					displayField: "text",
					validator: me.validator,
					listeners: {
						select: function () {
							me.changeAttr ("attr", this.getValue ());
							me.down ("*[name=url]").setValue (null);
						}
					}
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Source code"),
				iconCls: "gi_notes",
				border: 0,
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};
		this.callParent (arguments);
	},
	getOtherAttrs: function () {
		var me = this;
		var r = [];
		var get = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (layout [a].id && layout [a].view && layout [a].id != me.$cmpId) {
						var v = $o.getView (layout [a].view);
						for (var attr in v.attrs) {
							var va = v.attrs [attr];
							if ((a == "olap" || a == "treegrid") && va.get ("classAttr") && $o.getClassAttr (va.get ("classAttr")).get ("type") == 1) {
								r.push ([layout [a].id + "." + attr, layout [a].id + ":" + va.toString ()]);
							};
						};
					};
					get (layout [a]);
				};
			};
		};
		get (me.layoutDesigner.value);
		return r;
	},
	validator: function () {
		var me = this.up ("window");
		if (me.down ("*[name=id]").getValue () && (me.down ("*[name=url]").getValue () || me.down ("*[name=attr]").getValue ())) {
			me.down ("button[name='ok']").enable ();
		} else {
			me.down ("button[name='ok']").disable ();
		};
		return true;
	}
});

Ext.define ("$o.ActionDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.actiondesigner", "widget.$actiondesigner"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.tbar = [{
			text: $o.getString ("Open"),
			iconCls: "gi_edit",
			handler: me.edit,
			scope: me
		}, {
			text: $o.getString ("Add"),
			iconCls: "gi_circle_plus",
			handler: me.create,
			scope: me
		}, {
			text: $o.getString ("Remove"),
			iconCls: "gi_circle_minus",
			handler: me.remove,
			scope: me
		}];
	    me.store = Ext.create ("Ext.data.Store", {
	        data: [],
	        fields: [{
	        	name: "action", type: "string"
			}, {
	        	name: "id", type: "string"
	        }]
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: $o.getString ("Action"), width: 100, dataIndex: "action", renderer: me.cellRenderer
			}, {
				header: "id", width: 100, dataIndex: "id", hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false,
			viewConfig: {
				plugins: {
					ptype: "gridviewdragdrop"
				},
				listeners: {
					drop: function (node, data, dropRec, dropPosition) {
						var list = [];
						for (var j = 0; j < me.store.getCount (); j ++) {
							for (var i = 0; i < me.value.length; i ++) {
								if (me.value [i].actionId == me.store.getAt (j).get ("id")) {
									list.push (me.value [i]);
									break;
								};
							};
						};
						me.value = list;
						me.fireEvent ("change", me.value);		
					}
				}
			}
		});
		me.items = me.grid;
		me.on ("afterrender", function () {
			if (me.value) {
				me.setValue (me.value);
			};
		});
		this.callParent (arguments);
	},
	create: function () {
		var me = this;
		dialog.getObject ({
			title: $o.getString ("Select", "actions"),
			width: 800,
			height: 600,
			layout: {
				split: {
					orientation: "horizontal",
					width: 300,
					items: [{
						treegrid: {
							id: "olapClasses",
							title: $o.getString ("Classes"),
							view: "system.classes",
						    fields: {
						        id: "id",
						        parent: "parent_id"
						    },
						    filter: ["id", ">=", 1000]
						}
					}, {
						olap: {
							id: "olap",
							title: $o.getString ("Actions"),
							view: "system.actions",
							singleSelect: false,
							filter: ["class_id", "=", {id: "olapClasses", attr: "id"}]
						}
					}]
				}
			},
			attr: "olap.id",
			success: function (options) {
				var values = options.values;
				for (var i = 0; i < values.length; i ++) {
					var a = $o.getAction (values [i]);
					var cls = $o.getClass (a.get ("class"));
					var fn = cls.getFullCode () + "." + a.get ("code");
					var o = {
						actionId: a.get ("id"),
						fn: fn,
						text: a.get ("name")
					};
					if (a.get ("layout")) {
						var l = JSON.parse (a.get ("layout"));
						if (l ["type"] == "create") {
							o.iconCls = "gi_circle_plus";
						};
						if (l ["type"] == "remove") {
							o.iconCls = "gi_circle_minus";
							o.active = "common.recordSelected";
						};
						if (l ["type"] == "card") {
							o.iconCls = "gi_edit";
							o.active = "common.recordSelected";
						};
					};
					me.value = me.value || [];
					me.value.push (o);
				};
				me.build ();
				me.fireEvent ("change", me.value);		
			}
		});
	},
	edit: function () {
		var me = this;
		var v, i;
		if (me.grid.getSelectionModel ().hasSelection ()) {
			var rec = me.grid.getSelectionModel ().getSelection ()[0];
			var actionId = rec.get ("id");
			for (i = 0; i < me.value.length; i ++) {
				if (me.value [i].actionId == actionId || me.value [i].fn == actionId) {
					v = me.value [i];
					break;
				};
			};
		} else {
			return;
		};
		var win = Ext.create ("Ext.Window", {
			width: 600,
			height: 600,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: $o.getString ("Action"),
			bodyPadding: 5,
			modal: 1,
			items: {
				xtype: "$actioncard",
				value: v,
				listeners: {
					aftersave: function (value) {
						win.close ();
						me.value [i] = value;
						me.build ();
						if (value.actionId) {
							var a = $o.getAction (value.actionId);
							a.initAction ();
						};
						me.fireEvent ("change", me.value);		
					}
				}
			}
		});
		win.show ();
	},
	remove: function () {
		var me = this;
		if (me.grid.getSelectionModel ().hasSelection ()) {
			var rec = me.grid.getSelectionModel ().getSelection ()[0];
			var actionId = rec.get ("id");
			for (var i = 0; i < me.value.length; i ++) {
				if (me.value [i].actionId == actionId || me.value [i].fn == actionId) {
					me.value.splice (i, 1);
					break;
				};
			};
			me.build ();
			me.fireEvent ("change", me.value);
		};
	},
	build: function () {
		var me = this;
		var data = [];
		for (var i = 0; i < me.value.length; i ++) {
			if (me.value [i].actionId) {
				var action = $o.getAction (me.value [i].actionId);
				data.push ({
					action: action.toString (),
					id: me.value [i].actionId
				});
			} else {
				data.push ({
					action: me.value [i].text,
					id: me.value [i].fn
				});
			};
		};
		me.store.loadData (data);
	},
	setValue: function (value) {
		var me = this;
		me.value = value;
		me.build ();
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});

Ext.define ("$o.ActionCard.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.actioncard", "widget.$actioncard"],
	layout: "vbox",
	border: false,
	defaults: {
		border: false
	},
	bodyPadding: 1,
	initComponent: function () {
		var me = this;
		me.value = me.value || {};
		me.tbar = [{
			text: "Ок",
			iconCls: "gi_ok",
			handler: me.save,
			name: "save",
			disabled: 1,
			scope: me
		}, {
			text: $o.getString ("Cancel"),
			iconCls: "gi_remove",
			handler: function () {
				me.up ("window").close ();
			},
			name: "cancel"
		}];
		me.items = [{
			xtype: "$conffield", 
			fieldLabel: $o.getString ("Action"),
			name: "action", 
			width: "100%",
			confRef: "action",
			style: "margin-top: 5px",
			choose: {
				type: "layout", attr: "olap.id", width: 600, height: 400, layout: {
					split: {
						orientation: "horizontal",
						width: 300,
						items: [{
							treegrid: {
								id: "olapClasses",
								view: "system.classes",
							    fields: {
							        id: "id",
							        parent: "parent_id"
							    },
							    filter: {
							        fn: function () {return ["id", ">=", 1000]}
							    }
							}
						}, {
							olap: {
								id: "olap",
								view: "system.actions",
								filter: ["class_id", "=", {id: "olapClasses", attr: "id"}]
							}
						}]
					}
				}
			},
			listeners: {
				change: function () {
					if (this.getValue ()) {
						var a = $o.getAction (this.getValue ());
						var cls = $o.getClass (a.get ("class"));
						/*
						var fn = cls.getFullCode () + "." + a.get ("code");
						try {
							fn = eval (fn);
						} catch (e) {
							fn = null;
						};
						if (!fn) {
							this.setValue (null);
							common.message ("Для выбора данного действия необходима сборка проекта и перезагрузка страницы веб-обозревателя.");
							return;
						};
						*/
//						me.down ("*[name=class]").setValue (cls.toString ());
						me.down ("*[name=name]").setValue (a.get ("name"));
						if (a.get ("layout")) {
							var l = JSON.parse (a.get ("layout"));
							if (l ["type"] == "create") {
								me.down ("*[name=iconCls]").setValue ("gi_circle_plus");
							};
							if (l ["type"] == "remove") {
								me.down ("*[name=iconCls]").setValue ("gi_circle_minus");
								me.down ("*[name=activeRecordSelected]").setValue (1);
							};
							if (l ["type"] == "card") {
								me.down ("*[name=iconCls]").setValue ("gi_edit");
								me.down ("*[name=activeRecordSelected]").setValue (1);
							};
						};
//					} else {
//						me.down ("*[name=class]").setValue ("");
					};
					me.validator ();
				}
			}
		}, {
			xtype: "textfield",
			width: "100%",
			fieldLabel: $o.getString ("Function"),
			name: "fn",
			value: me.value.actionId ? "" : me.value.fn,
			validator: me.validator
		}, {
			xtype: "textfield",
			width: "100%",
			fieldLabel: $o.getString ("Name"),
			name: "name",
			value: me.value.text
		}, {
			xtype: "$iconselector",
			width: "100%", 
			name: "iconCls",
			value: me.value.iconCls
		}, {
			xtype: "checkbox",
			name: "activeRecordSelected",
			fieldLabel: $o.getString ("Active when record selected"),
			checked: me.value.active == "common.recordSelected"
		}, {
			title: $o.getString ("Options"),
			width: "100%",
			flex: 1,
			xtype: "$actionargs",
			value: me.value.arguments,
			listeners: {
				change: function (value) {
					me.value.arguments = value;
				}
			}
		}];
		me.on ("afterrender", function () {
			me.down ("*[name=action]").setValue (me.value.actionId);
		});
		me.addEvents ("aftersave");
		this.callParent (arguments);
	},
	validator: function () {
		var panel = this.up ("panel");
		if (panel.down ("*[name=action]").getValue () || panel.down ("*[name=fn]").getValue ()) {
			panel.down ("*[name=save]").enable ();
		} else {
			panel.down ("*[name=save]").disable ();
		};
		return true;
	},
	save: function () {
		var me = this;
		var actionId = me.down ("*[name=action]").getValue ();
		var fn;
		var v = me.value;
		if (actionId) {
			v.actionId = actionId;
			var action = $o.getAction (actionId);
			var cls = $o.getClass (action.get ("class"));
			fn = cls.getFullCode () + "." + action.get ("code"); 
		} else {
			fn = me.down ("*[name=fn]").getValue ();
		};
		v.fn = fn;
		if (me.down ("*[name=name]").getValue ()) {
			v.text = me.down ("*[name=name]").getValue ();
		};
		if (me.down ("*[name=iconCls]").getValue ()) {
			v.iconCls = me.down ("*[name=iconCls]").getValue ();
		};
		if (me.down ("*[name=activeRecordSelected]").getValue ()) {
			v.active = "common.recordSelected";
		};
		me.fireEvent ("aftersave", v);
	}
});



Ext.define ("$o.ActionArgs.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.actionargs", "widget.$actionargs"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.value = me.value || {};
		me.tbar = [{
			text: $o.getString ("Add"),
			iconCls: "gi_circle_plus",
			handler: me.create,
			scope: me
		}, {
			text: $o.getString ("Remove"),
			iconCls: "gi_circle_minus",
			handler: me.remove,
			scope: me
		}];
	    me.store = Ext.create ("Ext.data.Store", {
	    	autoSync: true,
	        data: me.getData (),
	        fields: [{
	        	name: "arg", type: "string"
			}, {
	        	name: "value", type: "string"
	        }],
	        listeners: {
	        	datachanged: me.datachanged,
	        	scope: me
	        }
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: $o.getString ("Option"), width: 150, dataIndex: "arg", renderer: me.cellRenderer, editor: {
		            xtype: "textfield"
		        }
			}, {
				header: $o.getString ("Value"), flex: 1, dataIndex: "value", renderer: me.cellRenderer, editor: {
		            xtype: "textfield"
		        }
			}],
			plugins: [Ext.create ("Ext.grid.plugin.CellEditing", {
		        clicksToEdit: 1
		    })],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.items = me.grid;
		me.addEvents ("change");
		this.callParent (arguments);
	},
	getData: function () {
		var me = this;
		var data = [];
		for (var arg in me.value) {
			data.push ({
				arg: arg, value: me.value [arg]
			});
		};
		return data;
	},
    cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
    	var me = this;
    	var field = metaData.column.dataIndex;
		metaData.tdAttr += ' style=";border: 1px gray solid;"';
		return value;
    },
	datachanged: function () {
		var me = this;
		if (me.store) {
			var v = {};
			for (var i = 0; i < me.store.getCount (); i ++) {
				var rec = me.store.getAt (i);
				if (rec.get ("arg") && rec.get ("value")) {
					v [rec.get ("arg")] = rec.get ("value");
				};
			};
			me.value = v;
			me.fireEvent ("change", me.value);
		};
	},
	create: function () {
		var me = this;
		me.store.insert (me.store.getCount (), {});
	},
	remove: function () {
		var me = this;
		if (me.grid.getSelectionModel ().hasSelection ()) {
			var rec = me.grid.getSelectionModel ().getSelection ()[0];
			me.store.remove (rec);
			var arg = rec.get ("arg");
			delete me.value [arg];
		};
	}
});

Ext.define ("$o.EventDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.eventdesigner", "widget.$eventdesigner"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.tbar = [{
			text: $o.getString ("Open"),
			iconCls: "gi_edit",
			handler: me.edit,
			scope: me
		}, {
			text: $o.getString ("Add"),
			iconCls: "gi_circle_plus",
			handler: me.create,
			scope: me
		}, {
			text: $o.getString ("Remove"),
			iconCls: "gi_circle_minus",
			handler: me.remove,
			scope: me
		}];
	    me.store = Ext.create ("Ext.data.Store", {
	        data: [],
	        fields: [{
	        	name: "event", type: "string"
			}, {
	        	name: "action", type: "string"
			}, {
	        	name: "fn", type: "string"
	        }]
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: $o.getString ("Event"), flex: 1, dataIndex: "event", renderer: me.cellRenderer
			}, {
				header: $o.getString ("Action"), flex: 2, dataIndex: "action", renderer: me.cellRenderer
			}, {
				header: "fn", width: 100, dataIndex: "fn", hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.items = me.grid;
		me.on ("afterrender", function () {
			me.setValue (me.value);
		});
		me.addEvents ("changeevent");
		this.callParent (arguments);
	},
	create: function () {
		var me = this;
		var win = Ext.create ("Ext.Window", {
			width: 600,
			height: 400,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: "Событие",
			bodyPadding: 5,
			modal: 1,
			items: {
				xtype: "$eventcard",
				$events: me.$events,
				listeners: {
					aftersave: function (value) {
						win.close ();
						me.value [value.event] = value;
						delete value.event;
						me.build ();
						me.fireEvent ("changeevent", me.value);		
					}
				}
			}
		});
		win.show ();
	},
	edit: function () {
		var me = this;
		var v;
		if (me.grid.getSelectionModel ().hasSelection ()) {
			var rec = me.grid.getSelectionModel ().getSelection ()[0];
			v = me.value [rec.get ("event")];
			v.event = rec.get ("event");
		} else {
			return;
		};
		var win = Ext.create ("Ext.Window", {
			width: 600,
			height: 400,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: $o.getString ("Event"),
			bodyPadding: 5,
			modal: 1,
			items: {
				xtype: "$eventcard",
				value: v,
				$events: me.$events,
				listeners: {
					aftersave: function (value) {
						win.close ();
						me.value [value.event] = value;
						delete value.event;
						me.build ();
						me.fireEvent ("changeevent", me.value);
					}
				}
			}
		});
		win.show ();
	},
	remove: function () {
		var me = this;
		if (me.grid.getSelectionModel ().hasSelection ()) {
			var rec = me.grid.getSelectionModel ().getSelection ()[0];
			delete me.value [rec.get ("event")];
			me.build ();
			me.fireEvent ("changeevent", me.value);
		};
	},
	build: function () {
		var me = this;
		var data = [];
		for (var event in me.value) {
			var action = $o.getAction (me.value [event].fn);
			data.push ({
				event: event,
				action: action ? action.toString () : me.value [event].fn,
				fn: me.value [event].fn
			});
		};
		me.store.loadData (data);
	},
	setValue: function (value) {
		var me = this;
		value = value || {};
		for (var event in value) {
			if (typeof (value [event]) == "string") {
				value [event] = {
					fn: value [event]
				};
			};
		};
		me.value = value;
		me.build ();
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});

Ext.define ("$o.EventCard.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.eventcard", "widget.$eventcard"],
	layout: "vbox",
	border: false,
	defaults: {
		border: false
	},
	bodyPadding: 1,
	initComponent: function () {
		var me = this;
		me.value = me.value || {};
		me.tbar = [{
			text: "Ок",
			iconCls: "gi_ok",
			handler: me.save,
			name: "save",
			disabled: 1,
			scope: me
		}, {
			text: $o.getString ("Cancel"),
			iconCls: "gi_remove",
			handler: function () {
				me.up ("window").close ();
			},
			name: "cancel"
		}];
		var action = $o.getAction (me.value.fn);
		var data = [];
		for (var i = 0; i < me.$events.length; i ++) {
			data.push ([me.$events [i], me.$events [i]]);
		};
		me.items = [{
			xtype: "combo",
			name: "event",
			fieldLabel: $o.getString ("Event"),
			width: "100%",
			triggerAction: "all",
			lazyRender: true,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: data
			}),
			value: me.value.event,
			validator: me.validator,
			style: "margin-top: 5px",
			valueField: "id",
			displayField: "text"
		}, {
			xtype: "$conffield", 
			fieldLabel: $o.getString ("Action"),
			name: "action", 
			width: "100%",
			confRef: "action",
			choose: {
				type: "layout", attr: "olap.id", width: 600, height: 400, layout: {
					split: {
						orientation: "horizontal",
						width: 300,
						items: [{
							treegrid: {
								id: "olapClasses",
								view: "system.classes",
							    fields: {
							        id: "id",
							        parent: "parent_id"
							    },
							    filter: {
							        fn: function () {return ["id", ">=", 1000]}
							    }
							}
						}, {
							olap: {
								id: "olap",
								view: "system.actions",
								filter: ["class_id", "=", {id: "olapClasses", attr: "id"}]
							}
						}]
					}
				}
			},
			listeners: {
				change: function () {
					if (this.getValue ()) {
						var a = $o.getAction (this.getValue ());
						var cls = $o.getClass (a.get ("class"));
						/*
						var fn = cls.getFullCode () + "." + a.get ("code");
						try {
							fn = eval (fn);
						} catch (e) {
							fn = null;
						};
						if (!fn) {
							this.setValue (null);
							common.message ("Для выбора данного действия необходима сборка проекта и перезагрузка страницы веб-обозревателя.");
							return;
						};
						*/
					};
					me.validator ();
				}
			}
		}, {
			xtype: "textfield",
			width: "100%",
			fieldLabel: $o.getString ("Function"),
			name: "fn",
			value: action ? "" : me.value.fn,
			validator: me.validator
		}, {
			title: $o.getString ("Options"),
			width: "100%",
			flex: 1,
			xtype: "$actionargs",
			value: me.value.arguments,
			listeners: {
				change: function (value) {
					me.value.arguments = value;
				}
			}
		}];
		me.on ("afterrender", function () {
			if (action) {
				me.down ("*[name=action]").setValue (action.get ("id"));
			};
		});
		me.addEvents ("aftersave");
		this.callParent (arguments);
	},
	validator: function () {
		var panel = this.up ("panel");
		if (panel.down ("*[name=event]").getValue () && (
			panel.down ("*[name=action]").getValue () || panel.down ("*[name=fn]").getValue ()
		)) {
			panel.down ("*[name=save]").enable ();
		} else {
			panel.down ("*[name=save]").disable ();
		};
		return true;
	},
	save: function () {
		var me = this;
		var fn;
		var actionId = me.down ("*[name=action]").getValue ();
		if (actionId) {
			var action = $o.getAction (actionId);
			var cls = $o.getClass (action.get ("class"));
			fn = cls.getFullCode () + "." + action.get ("code"); 
		} else {
			fn = me.down ("*[name=fn]").getValue ();
		};
		var v = me.value;
		v.fn = fn;
		v.event = me.down ("*[name=event]").getValue ();
		me.fireEvent ("aftersave", v);
	}
});



Ext.define ("$o.LayoutDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layoutdesigner", "widget.$layoutdesigner"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.initCounter (me.value);
		me.value = me.value || me.createEmpty ();
		me.treeStore = Ext.create ('Ext.data.TreeStore', {
		    root: {
		        expanded: true,
		        children: []
		    }
		});
		me.items = {
			xtype: "tabpanel",
			items: [{
				title: $o.getString ("Constructor"),
				iconCls: "gi_adjust_alt",
				layout: "border",
				name: "constructor",
				border: false,
				items: [{
				    split: true,
					width: 230,
				    region: "east",
					layout: "fit",
				    items: {
			    		xtype: "treepanel",
					    store: me.treeStore,
					    rootVisible: false,
				    	title: $o.getString ("Navigator"),
				    	iconCls: "gi_search",
				    	border: 0,
				    	tbar: [{
				    		text: $o.getString ("Open"),
				    		iconCls: "gi_edit",
				    		name: "edit",
				    		handler: me.edit,
				    		scope: me,
				    		disabled: 1
				    	}, {
				    		text: $o.getString ("Add"),
				    		iconCls: "gi_circle_plus",
				    		name: "create",
				    		handler: function () {
								var cmp = me.createEmpty ();
								cmp.panel.title = "Закладка";
								var tp = me.getCmp (me.selected.id);
								tp.tab.items.push (cmp);
								me.addCmp (cmp.panel.id);
				    		},
				    		scope: me,
				    		disabled: 1
				    	}, {
				    		text: $o.getString ("Remove"),
				    		iconCls: "gi_circle_minus",
				    		name: "delete",
				    		handler: function () {
								common.confirm ({message: "Вы уверены?", scope: this, fn: function (btn) {
									if (btn == "yes") {
										if (!me.removeTab (me.selected.id)) {
											var cmp = me.createEmpty ();
											var c = me.getCmp (me.selected.id);
											for (var a in c) {
												delete c [a];
											};
											Ext.apply (c, cmp);
											me.value.designer = 1;
										};
					    				me.down ("button[name='delete']").disable ();
										me.build ();
									}
								}});
				    		},
				    		scope: me,
				    		disabled: 1
				    	}],
				    	bbar: [{
				    		text: $o.getString ("Cancel action"),
				    		iconCls: "gi_history",
				    		name: "prevValue",
				    		disabled: 1,
				    		handler: function () {
				    			me.value = JSON.parse (me.prevValue.pop ());
				    			if (!me.prevValue.length) {
									me.down ("button[name='prevValue']").disable ();
				    			};
				    			me.build ({back: 1});
				    		}
				    	}],
				    	listeners: {
				    		select: function (srm, record, index, eOpts) {
				    			if (record) {
									var id = record.get ("text").split ("(id:")[1].split (")")[0];
									var code = me.getCmpCode (id);
									if (code != "panel") {
					    				me.down ("button[name='edit']").enable ();
					    				me.selected = {
					    					record: record,
					    					id: id,
					    					code: code
					    				};
					    			} else {
					    				me.down ("button[name='edit']").disable ();
					    			};
					    			if (code == "tab") {
					    				me.down ("button[name='create']").enable ();
					    			} else {
					    				me.down ("button[name='create']").disable ();
					    			};
					    			if (code != "panel") {
				    					me.down ("button[name='delete']").enable ();
				    				} else {
				    					me.down ("button[name='delete']").disable ();
				    				};
				    			}
				    		}
				    	}
				    }
				}, {
				    region: "center",
					layout: "fit",
					border: 0,
					style: "border: 1px solid #00ff00; margin: 1px",
					bodyPadding: 1,
				    items: {
						xtype: "$o.layout",
						$layout: $o.util.clone (me.value)
				    }
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Source code"),
				iconCls: "gi_notes",
				name: "source",
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};
		me.addEvents ("change");
		me.on ("afterrender", me.setHandlers);
		this.callParent (arguments);
	},
	edit: function () {
		var me = this;
		var id = me.selected.id;
		var code = me.selected.code;
		var win = Ext.create ("Ext.Window", {
			width: me.getCmpWidth (code),
			height: me.getCmpHeight (code),
		    resizeable: false,
			border: false,
			title: me.getCmpName (code),
			iconCls: me.getCmpIconCls (code),
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			modal: 1,
			layout: "fit",
			items: {
				xtype: "$o.layout" + code,
				layoutDesigner: me,
				value: me.getCmpValue (id),
				listeners: {
					aftersave: function () {
						win.close ();
						me.replaceCmp (id, this.getValue ());
						me.build ();
						me.fireEvent ("change", me.getValue ());
					}
				}
			}
		});
		win.show ();
	},
	getCmpCode: function (id) {
		var me = this;
		var find = function (layout) {
			if (typeof (layout) == "object") {
				for (var a in layout) {
					if (layout [a]) {
						if (layout [a].id == id) {
							return a;
						};
						var r = find (layout [a]);
						if (r) {
							return r;
						};
					};
				};
			};
			if (layout.items) {
				for (var i = 0; i < layout.items.length; i ++) {
					var r = find (layout.items [i]);
					if (r) {
						return r;
					};
				};
			};
		};
		return find (me.value);
	},
	getCmpValue: function (id) {
		var me = this;
		var find = function (layout) {
			if (typeof (layout) == "object") {
				for (var a in layout) {
					if (layout [a]) {
						if (layout [a].id == id) {
							return layout;
						};
						var r = find (layout [a]);
						if (r) {
							return r;
						};
					};
				};
			};
			if (layout.items) {
				for (var i = 0; i < layout.items.length; i ++) {
					var r = find (layout.items [i]);
					if (r) {
						return r;
					};
				};
			};
		};
		return find (me.value);
	},
	getCmpName: function (code) {
		switch (code) {
		case "split":
			return $o.getString ("Splitter");
			break;
		case "tab":
			return $o.getString ("Tabs");
			break;
		case "olap":
			return $o.getString ("Table");
			break;
		case "treegrid":
			return $o.getString ("Tree");
			break;
		case "card":
			return $o.getString ("Card");
			break;
		case "chart":
			return $o.getString ("Chart");
			break;
		case "image":
			return $o.getString ("Image");
			break;
		case "frame":
			return $o.getString ("Frame");
			break;
		case "panel":
			return $o.getString ("Empty");
			break;
		};
	},
	getCmpIconCls: function (code) {
		switch (code) {
		case "split":
			return "gi_share_alt";
			break;
		case "tab":
			return "gi_share_alt";
			break;
		case "olap":
			return "gi_table";
			break;
		case "treegrid":
			return "gi_leaf";
			break;
		case "card":
			return "gi_edit";
			break;
		case "chart":
			return "gi_charts";
			break;
		case "image":
			return "gi_picture";
			break;
		case "frame":
			return "gi_globe_af";
			break;
		case "panel":
			return "gi_file";
			break;
		};
	},
	getCmpWidth: function (code) {
		switch (code) {
		case "split":
			return 600;
			break;
		case "tab":
			return 600;
			break;
		case "olap":
			return 800;
			break;
		case "treegrid":
			return 600;
			break;
		case "card":
			return 800;
			break;
		case "chart":
			return 600;
			break;
		case "image":
			return 600;
			break;
		case "frame":
			return 600;
			break;
		}
	},
	getCmpHeight: function (code) {
		switch (code) {
		case "split":
			return 400;
			break;
		case "tab":
			return 400;
			break;
		case "olap":
			return 600;
			break;
		case "treegrid":
			return 600;
			break;
		case "card":
			return 600;
			break;
		case "chart":
			return 600;
			break;
		case "image":
			return 600;
			break;
		case "frame":
			return 600;
			break;
		}
	},
	getTreeRecord: function (layout) {
		var me = this;
		layout = layout || me.value;
		var code; for (code in layout) {if (code != "designer") break;};
		var cmp = layout [code];
		var rec = {
			text: me.getCmpName (code) + (cmp.title ? (": " + cmp.title) : "") + " (id:" + cmp.id + ")"
		};
		if (cmp.items && code != "panel" && code != "card") {
			rec.expanded = 0;
			rec.children = [];
			for (var i = 0; i < cmp.items.length; i ++) {
				rec.children.push (me.getTreeRecord (cmp.items [i]));
			};
		} else {
			rec.leaf = 1;
		}
		return rec;
	},
	initCounter: function (l) {
		var me = this;
		l = l || {};
		me.counter = me.counter || 1;
		if (typeof (l) == "object") {
			for (var a in l) {
				if (l [a]) {
					me.initCounter (l [a]);
				};
			};
		};
		if (l.items) {
			for (var i = 0; i < l.items.length; i ++) {
				me.initCounter (l.items [i]);
			};
		};
		if (l.id) {
			var n = l.id.split ("-");
			if (n.length > 1 && Number (n [1]) >= me.counter) {
				me.counter = Number (n [1]) + 1;
			};
		};
	},
	createEmpty: function () {
		var me = this;
		var id = "cmp-" + (me.counter ++);
		var cmp = {
			panel: {
				id: id,
				layout: {
					type: "vbox",
					align: "center",
					pack: "center"
				}, 
				items: [{
					xtype: "button",
					text: $o.getString ("Select", "component"),
					iconCls: "gi_edit",
					name: "selectCmp",
					cmpId: id
				}]
			}
		};
		return cmp;
	},
	build: function (options) {
		var me = this;
		options = options || {};
		var container = me.down ("*[region='center']");
		container.removeAll ();
		container.add ({
			xtype: "$o.layout",
			$layout: me.updateLayoutTags ($o.util.clone (me.value))
//			$layout: $o.util.clone (me.value)
		});
		container.doLayout ();
		me.setHandlers ();
		me.treeStore.getRootNode ().removeAll ();
		me.treeStore.getRootNode ().appendChild (
		    me.getTreeRecord ()
		);
		me.down ("button[name='edit']").disable ();
		if (!options.back) {
			me.prevValue = me.prevValue || [];
			me.prevValue.push (me.down ("codemirrortextarea[name='json']").getValue ());
			me.down ("button[name='prevValue']").enable ();
		};
		me.down ("codemirrortextarea[name='json']").setValue (JSON.stringify (me.value, null, "\t"));
	},
	selectCmp: function (options) {
		var me = this;
		var onClick = function () {
			options.success (this.cmpCode);
			win.close ();
		};
		var win = Ext.create ("Ext.Window", {
			width: 560,
			height: 100,
		    bodyPadding: 5,
		    resizeable: false,
			border: false,
			title: $o.getString ("Select", "component"),
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			modal: 1,
			layout: "hbox",
			items: [{
				xtype: "button",
				text: $o.getString ("Table"),
				cmpCode: "olap",
				iconCls: "gib_table",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Tree"),
				cmpCode: "treegrid",
				iconCls: "gib_leaf",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Card"),
				cmpCode: "card",
				iconCls: "gib_edit",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Chart"),
				cmpCode: "chart",
				iconCls: "gib_charts",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Image"),
				cmpCode: "image",
				iconCls: "gib_picture",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Frame"),
				cmpCode: "frame",
				iconCls: "gib_globe_af",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Splitter"),
				cmpCode: "split",
				iconCls: "gib_share_alt",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Tabs"),
				cmpCode: "tab",
				iconCls: "gib_bookmark",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}]
		});
		win.show ();
	},
	getCmp: function (id) {
		var me = this;
		var get = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (layout [a].id == id) {
						return layout;
					};
					var c = get (layout [a]);
					if (c) {
						return c;
					};
				};
			};
		};
		return get (me.value);
	},
	// Удаляет закладку (последнюю не удаляет)
	removeTab: function (id) {
		var me = this;
		var remove = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (a == "tab" && layout [a].items.length > 1) {
						for (var i = 0; i < layout [a].items.length; i ++) {
							var code; for (code in layout [a].items [i]) {break;};
							if (layout [a].items [i][code].id == id) {
								layout [a].items.splice (i, 1);
								return 1;
							};
						};
					};
					var i = remove (layout [a]);
					if (i) {
						return i;
					};
				};
			};
		};
		return remove (me.value);
	},
	replaceCmp: function (id, cmpNew) {
		var me = this;
		var replace = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (layout [a].id == id && ["split", "tab", "olap", "treegrid", "card", "cardConf", "chart", "image", "frame", "panel"].indexOf (a) > -1) {
						delete layout [a];
						Ext.apply (layout, cmpNew);
						return;
					};
					replace (layout [a]);
				};
			};
		};
		replace (me.value);
	},
	addCmp: function (id) {
		var me = this;
		me.addCmpActive = 1;
		me.selectCmp ({success: function (code) {
			var win = Ext.create ("Ext.Window", {
				width: me.getCmpWidth (code),
				height: me.getCmpHeight (code), 
			    resizeable: false,
				border: false,
				title: me.getCmpName (code),
				iconCls: me.getCmpIconCls (code),
				style: "background-color: #ffffff",
				bodyStyle: "background-color: #ffffff",
				modal: 1,
				layout: "fit",
				items: {
					xtype: "$o.layout" + code,
					layoutDesigner: me,
					listeners: {
						aftersave: function () {
							me.addCmpActive = 0;
							win.close ();
							me.replaceCmp (id, this.getValue ());
							me.build ();
							me.fireEvent ("change", me.getValue ());
						}
					}
				}
			});
			win.show ();
		}});
	},
	getValue: function () {
		var me = this;
		var v = me.down ("codemirrortextarea[name='json']").getValue ();
		return v;
	},
	setValue: function (value) {
		var me = this;
		if (!value) {
			me.counter = 1;
			value = me.createEmpty ();
			value.designer = 1;
		} else
		if (typeof (value) == "string") {
			try {
				value = JSON.parse (value);
				if (!value.designer) {
					throw "invalid";
				};
			} catch (e) {
				var container = me.down ("*[region='center']");
				container.removeAll ();
				container.add ({
					layout: {
						type: "vbox",
						align: "center",
						pack: "center"
					}, 
					items: [{
						xtype: "label",
						text: $o.getString ("Sorry, we could not decode the source code layout")
					}]
				});
				me.treeStore.getRootNode ().removeAll ();
				me.down ("button[name='edit']").disable ();
				me.down ("button[name='create']").disable ();
				me.down ("button[name='delete']").disable ();
				me.down ("button[name='prevValue']").disable ();
				me.value = value;
				me.down ("codemirrortextarea[name='json']").setValue (value);
				me.down ("tabpanel").setActiveTab (me.down ("panel[name=source]"));
				return;
			};
		};
		me.value = value;
		me.initCounter (me.value);
		me.build ();
		me.prevValue = [];
		me.down ("button[name='prevValue']").disable ();
	},
	setReadOnly: function (ro) {
		var me = this;
		/*
		if (ro) {
			me.disable ();
		} else {
			me.enable ();
		};
		*/
	},
	/*
		each.card: {
			items: [{
				objectId: "[#id]" -> $o.createObject (card.object.cls, "local")
			}]
			-> readOnly: 1
		}
	*/
	updateLayoutTags: function (l) {
		var me = this;
		var noCls = null;
		var process = function (layout) {
			if (typeof (layout) == "object") {
				for (var a in layout) {
					if (layout [a]) {
						if (a == "card" && layout [a].object) {
							layout [a].readOnly = 1;
							var id = {};
							var tags = layout [a].object.length ? layout [a].object : [layout [a].object];
							for (var j = 0; j < tags.length; j ++) {
								var o = $o.createObject (tags [j].cls, "local");
								id [tags [j].tag] = o.get ("id");
							};
							function processItems (items) {
								for (var i = 0; i < items.length; i ++) {
									var item = items [i];
									if (item.objectId && item.objectId.substr && item.objectId.substr (0, 2) == "[#") {
										if (id [item.objectId]) {
											item.objectId = id [item.objectId];
										} else {
											noCls = layout [a].id;
										};
									};
									if (item.items) {
										processItems (item.items);
									};
								};
							};
							processItems (layout [a].items);
						} else
						if (a == "card" && !layout [a].object) {
							layout [a].items = [];
						} else
						/*
						if (Ext.isArray (layout [a])) {
							for (var i = 0; i < layout [a].length; i ++) {
								if (layout [a][i] && layout [a][i].substr && layout [a][i].substr (0, 2) == "[#") {
									layout [a][i] = 0;
								};
							};
						} else
						*/
						if (typeof (layout [a]) == "string") {
							if (layout [a].substr (0, 2) == "[#") {
								layout [a] = 0;
							};
						} else {
							process (layout [a]);
						};
					};
				};
				if (layout.items) {
					for (var i = 0; i < layout.items.length; i ++) {
						process (layout.items [i]);
					};
				};
			};
		};
		process (l);
		if (noCls) {
			common.message ($o.getString ("Class of object in the card is not defined") + ": " + noCls);
		};
		return l;
	},
	setHandlers: function () {
		var me = this;
		var buttons = me.query ("button[name='selectCmp']");
		for (var i = 0; i < buttons.length; i ++) {
			buttons [i].on ("click", function () {
				if (!me.addCmpActive) {
					me.addCmp (this.cmpId);
				};
			});
		};
	}
});
 
Ext.define ("$o.QuerySort.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.querysort", "widget.$querysort"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.value = me.value || [];
		me.tbar = [{
			text: $o.getString ("Add"),
			handler: me.create,
			iconCls: "gi_circle_plus",
			scope: me
		}, {
			text: $o.getString ("Clear"),
			iconCls: "gi_circle_minus",
			handler: me.clear,
			scope: me
		}];
	    me.store = Ext.create ("Ext.data.Store", {
	        data: [],
	        fields: [{
	        	name: "attr", type: "string"
			}, {
	        	name: "dir", type: "string"
			}, {
	        	name: "alias", type: "string"
			}, {
	        	name: "dir_id", type: "string"
	        }]
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: $o.getString ("Attribute"), width: 100, dataIndex: "attr", renderer: me.cellRenderer
			}, {
				header: $o.getString ("Sort"), width: 100, dataIndex: "dir", renderer: me.cellRenderer
			}, {
				header: "alias", width: 100, dataIndex: "attr_id", hidden: true
			}, {
				header: "dir_id", width: 100, dataIndex: "dir_id", hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.items = me.grid;
		me.addEvents ("change");
		this.callParent (arguments);
	},
	cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
		if (value) {
			var tip = value;
			if (typeof (tip) == "string") {
				tip = tip.split ('"').join ("'");
			}
			metaData.tdAttr = 'data-qtip="' + tip + '"';
		};
		return value;
	},
	setClasses: function (classes, classAliases, aliases) {
		var me = this;
		me.$classes = classes;
		me.$classAliases = classAliases;
		me.$aliases = aliases;
	},
	create: function () {
		var me = this;
		var data = [];
		for (var i = 0; i < me.$classes.length; i ++) {
			var cls = $o.getClass (me.$classes [i]);
			data.push ([me.$aliases [i] + ":id", me.$aliases [i] + ":id"]);
			for (var attr in cls.attrs) {
				data.push ([me.$aliases [i] + ":" + attr, me.$aliases [i] + ":" + cls.attrs [attr].toString ()]);
			};
		};
		var win = Ext.create ("Ext.Window", {
			width: 400,
			height: 150,
			layout: "vbox",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: $o.getString ("Select", "attribute"),
			iconCls: "gi_file",
			bodyPadding: 5,
			modal: 1,
			tbar: [{
				text: "Ок",
				iconCls: "gi_ok",
				name: "create",
				disabled: 1,
				handler: function () {
					var attr = win.down ("*[name=attr]").getValue ();
					me.value = me.value || [];
					if (me.value.length) {
						me.value.push (",");
					};
					var o = {};
					o [attr.split (":")[0]] = attr.split (":")[1];
					me.value.push (o);
					if (win.down ("*[name=dir]").getValue () == "DESC") {
						me.value.push ("DESC");
					} else {
						me.value.push ("ASC");
					};
					me.build ();
					win.close ();
					me.fireEvent ("change", me.value);
				}
			}, {
				text: $o.getString ("Cancel"),
				iconCls: "gi_remove",
				handler: function () {
					win.close ();
				}
			}],
			items: [{
				/*
				xtype: "$conffield", 
				fieldLabel: "Атрибут",
				name: "attr", 
				width: "100%",
				confRef: "classAttr",
				$classes: me.$classes,
				choose: {
					type: "custom", fn: me.chooseClassAttr
				},
				listeners: {
					change: function (value) {
						if (value) {
							win.down ("*[name=create]").enable ();
						} else {
							win.down ("*[name=create]").disable ();
						};
					}
				}
				*/
				xtype: "combo",
				fieldLabel: $o.getString ("Attribute"),
				name: "attr",
				width: "100%",
				mode: "local",
				queryMode: "local",
				editable: false,
				store: new Ext.data.ArrayStore ({
					fields: ["id", "text"],
					data: data
				}),
				valueField: "id",
				displayField: "text",
				listeners: {
					select: function () {
						if (this.getValue ()) {
							win.down ("*[name=create]").enable ();
						} else {
							win.down ("*[name=create]").disable ();
						};
					}
				}
			}, {
				xtype: "combo",
				fieldLabel: $o.getString ("Sort"),
				name: "dir",
				width: "100%",
				mode: "local",
				queryMode: "local",
				editable: false,
				store: new Ext.data.ArrayStore ({
					fields: ["id", "text"],
					data: [
						["ASC", $o.getString ("Sort ascending")],
						["DESC", $o.getString ("Sort descending")]
					]
				}),
				valueField: "id",
				displayField: "text"
			}]
		});
		win.show ();
	},
	clear: function () {
		var me = this;
		me.setValue ([]);
	},
	build: function () {
		var me = this;
		var data = [];
		if (me.value) {
			for (var i = 0; i < me.value.length; i += 2) {
				if (me.value [i] == ",") {
					i ++;
				};
				var r = {};
				if (me.value [i + 1] == "DESC") {
					r.dir = $o.getString ("Sort descending");
					r.dir_id = "DESC";
				} else {
					r.dir = $o.getString ("Sort ascending");
					r.dir_id = "ASC";
				};
				var alias; for (alias in me.value [i]) {break;};
				var attr = me.value [i][alias];
				for (var j = 0; j < me.$aliases.length; j ++) {
					if (me.$aliases [j] == alias) {
						var cls = $o.getClass (me.$classes [j]);
						r.attr = alias + ":" + cls.attrs [attr].toString ();
						r.alias = alias;
						break;
					};
				};
				data.push (r);
			};
		};
		me.store.loadData (data);
	},
	setValue: function (value) {
		var me = this;
		me.value = value;
		me.build ();
		me.fireEvent ("change", value);
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});

Ext.define ("$o.QuerySelect.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.queryselect", "widget.$queryselect"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.value = me.value || [];
		me.tbar = [{
    		text: $o.getString ("Choose"),
    		iconCls: "gi_edit",
    		handler: me.addAttrs,
    		scope: me
		}];
	    me.store = Ext.create ("Ext.data.Store", {
	        data: [],
	        fields: [{
	        	name: "name", type: "string"
			}, {
	        	name: "clsName", type: "string"
			}, {
	        	name: "clsFrom", type: "string"
			}, {
	        	name: "clsId", type: "number"
			}, {
	        	name: "attr", type: "string"
			}, {
	        	name: "alias", type: "string"
	        }],
			sorters: [{
				property: "name",
				direction: "ASC"
			}]	        
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: $o.getString ("Attribute"), width: 100, dataIndex: "name", renderer: me.cellRenderer
			}, {
				header: $o.getString ("Alias"), width: 100, dataIndex: "alias", renderer: me.cellRenderer
			}, {
				header: $o.getString ("Class"), width: 100, dataIndex: "clsName", renderer: me.cellRenderer
			}, {
				header: "clsFrom", width: 100, dataIndex: "clsFrom", hidden: true
			}, {
				header: "clsId", width: 100, dataIndex: "clsId", hidden: true
			}, {
				header: "attr", width: 100, dataIndex: "attr", hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.items = me.grid;
		me.addEvents ("change");
		this.callParent (arguments);
	},
	cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
		if (value) {
			var tip = value;
			if (typeof (tip) == "string") {
				tip = tip.split ('"').join ("'");
			}
			metaData.tdAttr = 'data-qtip="' + tip + '"';
		};
		return value;
	},
	updateSelect: function () {
		var me = this;
		me.value = [];
		for (var i = 0; i < me.store.getCount (); i ++) {
			var o = {};
			o [me.store.getAt (i).get ("clsFrom")] = me.store.getAt (i).get ("attr");
			me.value.push (o);
			me.value.push (me.store.getAt (i).get ("alias"));
		};
		me.fireEvent ("change", me.value);
	},
	addAttrs: function () {
		var me = this;
		if (!me.$classes.length) {
			common.message ($o.getString ("Select", "class"));
			return;
		};
		var tabs = [];
		for (var i = 0; i < me.$classes.length; i ++) {
			var cls = $o.getClass (me.$classes [i]);
			var data = [{
				attr: "id", name: "id", alias: i ? (me.$aliases [i] + "_id") : "id"
			}];
			var valueSelected = [];
			for (var j = 0; j < me.store.getCount (); j ++) {
				if (me.store.getAt (j).get ("clsFrom") == me.$aliases [i] && me.store.getAt (j).get ("attr") == "id") {
					valueSelected.push ("id");
					data [0].alias = me.store.getAt (j).get ("alias");
				};
			};
			for (var attr in cls.attrs) {
				var ca = cls.attrs [attr];
				var o = {
					attr: attr, 
					name: ca.toString (), 
					clsName: $o.getClass (ca.get ("class")).toString (),
					alias: i ? (me.$aliases [i] + "_" + attr) : attr
				};
				for (var j = 0; j < me.store.getCount (); j ++) {
					if (me.store.getAt (j).get ("clsFrom") == me.$aliases [i] && me.store.getAt (j).get ("attr") == attr) {
						valueSelected.push (attr);
						o.alias = me.store.getAt (j).get ("alias");
					};
				};
				data.push (o);
			};
		    var store = Ext.create ("Ext.data.Store", {
		        data: data,
		        fields: [{
		        	name: "name", type: "string"
				}, {
		        	name: "clsName", type: "string"
				}, {
		        	name: "attr", type: "string"
				}, {
		        	name: "alias", type: "string"
		        }],
				sorters: [{
					property: "name",
					direction: "ASC"
				}]	        
		    });
			var cellEditing = new Ext.grid.plugin.CellEditing ({
		        clicksToEdit: 1
		    });    
		    var clickedColIndex;
		    var selModel = Ext.create ("Ext.selection.CheckboxModel", {
				mode: "MULTI",
				valueSelected: valueSelected,
				checkOnly: true
			});
			var grid = Ext.create ("Ext.grid.Panel", {
				tbar: i ? [{
					text: $o.getString ("Aliases by attribute code"),
					iconCls: "gi_sort-by-alphabet",
					handler: function () {
						var store = this.up ("grid").getStore ();
						for (var i = 0; i < store.getCount (); i ++) {
							var rec = store.getAt (i);
							var a = rec.get ("alias");
							if (a.split ("_").length == 2) {
								rec.set ("alias", a.split ("_")[1]);
							};
						};
					}
				}] : [],
				store: store,
				columns: [{
					header: $o.getString ("Attribute"), width: 100, dataIndex: "name", renderer: me.cellRenderer
				}, {
					header: $o.getString ("Alias"), width: 100, dataIndex: "alias", renderer: me.cellRenderer,
			        editor: {
			            xtype: "textfield"
			        }
				}, {
					header: $o.getString ("Class"), width: 100, dataIndex: "clsName", renderer: me.cellRenderer
				}, {
					header: "attr", width: 100, dataIndex: "attr", hidden: true
				}],
				plugins: [cellEditing],
				selModel: selModel,
				forceFit: true,
				frame: false,
				deferRowRender: false,
				listeners: {
					afterrender: function () {
						for (var j = 0; j < this.getSelectionModel ().valueSelected.length; j ++) {
							this.getSelectionModel ().select (this.getStore ().findRecord ("attr", this.getSelectionModel ().valueSelected [j], 0, false, false, true), true);
						};
					}
				}
			});
			tabs.push ({
				title: me.$aliases [i] + ":" + cls.toString (),
				alias: me.$aliases [i],
				name: "tab",
				cls: cls,
				layout: "fit",
				selModel: selModel,
				items: grid
			});
		};
		var win = Ext.create ("Ext.Window", {
			width: 600,
			height: 600,
		    resizeable: false,
			border: false,
			title: $o.getString ("Select attributes (use mouse and Shift, Ctrl)"),
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			modal: 1,
			layout: "fit",
			items: {
				xtype: "tabpanel",
				deferredRender: false,
				items: tabs
			},
			tbar: [{
				text: "Ок",
				iconCls: "gi_ok",
				handler: function () {
					var data = [];
					var tabs = win.down ("tabpanel").query ("panel[name=tab]");
					for (var i = 0; i < tabs.length; i ++) {
						var tab = tabs [i];
						var selected = [];
						if (tab.selModel.hasSelection ()) {
							selected = tab.selModel.getSelection ();
						};
						for (var j = 0; j < selected.length; j ++) {
							data.push ({
								name: tabs [i].alias + ":" + (tab.cls.attrs [selected [j].get ("attr")] ? tab.cls.attrs [selected [j].get ("attr")].toString () : selected [j].get ("attr")),
								clsName: tab.cls.toString (),
								clsFrom: me.$aliases [i],
								clsId: tab.cls.get ("id"),
								attr: selected [j].get ("attr"),
								alias: selected [j].get ("alias")
							});
						};
					};
					me.store.loadData (data);
					win.close ();
					me.updateSelect ();
				}
			}, {
				text: $o.getString ("Cancel"),
				iconCls: "gi_remove",
				handler: function () {
					win.close ();
				}
			}]
		});
		win.show ();
	},
	setClasses: function (classes, classAliases, aliases) {
		var me = this;
		me.$classes = classes;
		me.$classAliases = classAliases;
		me.$aliases = aliases;
	},
	build: function () {
		var me = this;
		var data = [];
		if (me.value) {
			for (var i = 0; i < me.value.length; i += 2) {
				var clsId, cls, alias; for (alias in me.value [i]) {break;};
				var attr = me.value [i][alias];
				for (var j = 0; j < me.$aliases.length; j ++) {
					if (me.$aliases [j] == alias) {
						cls = $o.getClass (me.$classes [j]);
					};
				};
				data.push ({
					name: alias + ":" + (cls.attrs [attr] ? cls.attrs [attr].toString () : attr),
					clsName: cls.toString (),
					clsFrom: alias,
					clsId: cls.get ("id"),
					attr: attr,
					alias: me.value [i + 1]
				});
			};
		};
		me.store.loadData (data);
	},
	setValue: function (value) {
		var me = this;
		me.value = value;
		me.build ();
		me.fireEvent ("change", value);
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});

Ext.define ("$o.QueryCondition.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.querycondition", "widget.$querycondition"],
	layout: "vbox",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.filter = me.filter || [];
		me.value = {};
		me.tbar = [{
			text: "Ок",
			iconCls: "gi_ok",
			name: "save",
			disabled: 1,
			handler: me.save,
			scope: me
		}, {
			text: $o.getString ("Cancel"),
			iconCls: "gi_remove",
			name: "cancel",
			handler: function () {
				me.up ("window").close ();
			}
		}];
		var data = [];
		for (var i = 0; i < me.$classes.length; i ++) {
			var cls = $o.getClass (me.$classes [i]);
			data.push ([me.$aliases [i] + ":id", me.$aliases [i] + ":id"]);
			for (var attr in cls.attrs) {
				data.push ([me.$aliases [i] + ":" + attr, me.$aliases [i] + ":" + cls.attrs [attr].toString ()]);
			};
		};
		me.items = [{
			xtype: "combo",
			fieldLabel: $o.getString ("And/or"),
			name: "and_or",
			width: 250,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: [
					["and", $o.getString ("and")],
					["or", $o.getString ("or")]
				]
			}),
			valueField: "id",
			displayField: "text",
			validator: me.validator
			/*
		}, {
			xtype: "checkbox",
			name: "brackets",
			labelWidth: 200,
			fieldLabel: "Условие в скобках"
			*/
		}, {
			xtype: "combo",
			fieldLabel: $o.getString ("Attribute") + " 1",
			name: "attr1",
			width: "100%",
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: data
			}),
			valueField: "id",
			displayField: "text",
			validator: me.validator
		}, {
			xtype: "combo",
			fieldLabel: $o.getString ("Operator"),
			name: "oper",
			width: 250,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: [
					["=", $o.getString ("equal") + " (=)"],
					["<>", $o.getString ("not equal") + " (<>)"],
					["<", $o.getString ("less") + " (<)"],
					[">", $o.getString ("more") + " (>)"],
					["<=", $o.getString ("less or equal") + " (<=)"],
					[">=", $o.getString ("more  or equal") + " (>=)"],
					["is null", $o.getString ("null") + " (is null)"],
					["is not null", $o.getString ("not null") + " (is not null)"],
					["in", $o.getString ("one of list") + " (in)"]
				]
			}),
			valueField: "id",
			displayField: "text",
			listeners: {
				select: function () {
					var v = this.getValue ();
					if (v == "is null" || v == "is not null") {
						me.down ("*[name='value']").disable ();
						me.down ("*[name='attr2']").disable ();
					} else {
						me.down ("*[name='value']").enable ();
						if (v == "in") {
							me.down ("*[name='attr2']").disable ();
						} else {
							me.down ("*[name='attr2']").enable ();
						};
					};
				}
			},
			validator: me.validator
		}, {
			xtype: "textfield",
			fieldLabel: $o.getString ("Value"),
			width: "100%",
			name: "value",
			validator: me.validator
		}, {
			xtype: "combo",
			fieldLabel: $o.getString ("Attribute") + " 2",
			name: "attr2",
			width: "100%",
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: data
			}),
			valueField: "id",
			displayField: "text",
			listeners: {
				select: function () {
					if (this.getValue ()) {
						me.down ("*[name=save]").enable ();
					} else {
						me.down ("*[name=save]").disable ();
					};
					me.validator ();
				}
			}
		}];
		if (!me.filter.length) {
			me.items.splice (0, 1);
		};
		me.items [0].style = "margin-top: 5px;";
		me.addEvents ("aftersave");
		this.callParent (arguments);
	},
	validator: function (value) {
		var me = this.up ("panel");
		var andOrField = me.down ("*[name='and_or']");
		var attr1Field = me.down ("*[name='attr1']");
		var operField = me.down ("*[name='oper']");
		var valueField = me.down ("*[name='value']");
		var attr2Field = me.down ("*[name='attr2']");
		if (andOrField && !andOrField.getValue ()) {
			me.down ("button[name='save']").disable ();
			return true;
		};
		if (attr1Field.getValue () && operField.getValue () && (
			operField.getValue () == "is null" || operField.getValue () == "is not null" || valueField.getValue () || attr2Field.getValue ()
		)) {
			me.down ("button[name='save']").enable ();
			var attr1 = attr1Field.getValue ();
			var o1 = {};
			o1 [attr1.split (":")[0]] = attr1.split (":")[1];
			if (operField.getValue () == "is null" || operField.getValue () == "is not null") {
				me.value = [o1, operField.getValue ()];
			} else {
				var val = valueField.getValue ();
				if (attr2Field.getValue ()) {
					var attr2 = attr2Field.getValue ();
					val = {};
					val [attr2.split (":")[0]] = attr2.split (":")[1];
				};
				me.value = [o1, operField.getValue (), val];
			};
//			var bracketsField = me.down ("*[name='brackets']");
//			if (bracketsField && bracketsField.getValue ()) {
//				me.value = [andOrField.getValue (), [me.value]];
//			} else {
			if (andOrField) {
				me.value = [andOrField.getValue ()].concat (me.value);
			};
//			};
		} else {
			me.down ("button[name='save']").disable ();
			me.value = [];
		};
		return true;
	},
	save: function () {
		var me = this;
		me.fireEvent ("aftersave", me.value);
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});

Ext.define ("$o.QueryDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.querydesigner", "widget.$querydesigner"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.store = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: []
		});
		me.items = {
			xtype: "tabpanel",
			items: [{
				title: $o.getString ("Constructor"),
				iconCls: "gi_adjust_alt",
				layout: "border",
				name: "constructor",
				border: false,
				items: [{
				    split: true,
				    region: "north",
					height: 315,
					layout: "fit",
					border: 0,
				    items: {
				    	layout: "vbox",
				    	bodyPadding: 5,
				    	items: [{
				    		xtype: "compositefield",
				    		items: [{
								xtype: "$conffield", 
								fieldLabel: $o.getString ("Class"),
								name: "class", 
								width: 400,
								confRef: "class",
								choose: {
									type: "custom", fn: function () {
										var objectfield = this;
										dialog.getClass ({success: function (options) {
											objectfield.setValue (options.id);
										}});
									}
								},
								listeners: {
									change: function () {
										me.updateAttrsStore ();
										me.validator ();
										me.updateFrom ();
										me.updateClasses ();
									}
								}
							}, {
								xtype: "displayfield",
								value: $o.getString ("Alias") + ":",
								style: "margin-left: 5px",
								width: 70
							}, {
								xtype: "textfield",
								name: "alias",
								width: 100,
								listeners: {
									change: function () {
										me.updateAttrsStore ();
										me.validator ();
										me.updateFrom ();
										me.updateClasses ();
									}
								}
							}]
						}, {
							title: $o.getString ("Additional classes"),
					    	iconCls: "gi_cogwheels",
							flex: 1,
							width: "100%",
							layout: "hbox",
							name: "classes",
							autoScroll: true,
							bodyPadding: 5,
					    	tbar: [{
					    		text: $o.getString ("Add"),
					    		iconCls: "gi_circle_plus",
					    		handler: me.addClass,
					    		scope: me
					    	}]
				    	}]
				    }
				}, {
				    region: "center",
					layout: "border",
					border: 0,
				    items: [{
					    split: true,
						width: 300,
					    region: "west",
						layout: "fit",
						border: 1,
						bodyPadding: 1,
					    items: {
					    	title: $o.getString ("Attributes"),
					    	iconCls: "gi_file",
					    	xtype: "$queryselect",
							name: "attrs",
					    	listeners: {
					    		change: function (value) {
									var v = me.decodeQuery ();
									if (!v) {
										return;
									};
									v.select = value;
									me.down ("codemirrortextarea[name='json']").setValue (JSON.stringify (v, null, "\t"));
					    		}
					    	}
						}
					}, {
					    region: "center",
						layout: "fit",
						border: 0,
					    items: {
							layout: "border",
							border: 0,
						    items: [{
							    split: true,
								width: 300,
							    region: "west",
								layout: "fit",
								border: 1,
								bodyPadding: 1,
							    items: {
							    	title: $o.getString ("Filter"),
							    	iconCls: "gi_filter",
									xtype: "$layoutfilter",
									name: "filter",
									classMode: 1,
									listeners: {
										change: me.updateFilter,
										scope: me
									}
								}
							}, {
							    region: "center",
								layout: "fit",
								border: 1,
								bodyPadding: 1,
							    items: {
							    	title: $o.getString ("Sort"),
							    	iconCls: "gi_sort-by-order",
							    	name: "sort",
							    	xtype: "$querysort",
							    	listeners: {
							    		change: function (value) {
											var v = me.decodeQuery ();
											if (!v) {
												return;
											};
											v.order = value;
											me.down ("codemirrortextarea[name='json']").setValue (JSON.stringify (v, null, "\t"));
							    		}
							    	}
							    }
							}]
					    }
					}]
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Source code"),
				iconCls: "gi_notes",
				name: "source",
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};
		this.callParent (arguments);
	},
	decodeQuery: function () {
		var me = this;
		var container = me.down ("*[name=constructor]");
		container.getEl ().unmask (true);
		var v = me.down ("codemirrortextarea[name='json']").getValue ();
		try {
			v = JSON.parse (v);
			return v;
		} catch (e) {
			container.getEl ().mask ($o.getString ("Sorry, we could not decode the source code layout"));
			me.down ("tabpanel").setActiveTab (me.down ("panel[name=source]"));
		};
	},
	updateFrom: function () {
		var me = this;
		// class
		var selectedClass = me.down ("*[name=class]").getValue ();
		if (!selectedClass) {
			return;
		};
		var selectedClassCode = $o.getClass (selectedClass).getFullCode ();
		var v = me.decodeQuery ();
		if (!v) {
			return;
		};
		v.from = [{"a": selectedClassCode}];
		// classes
		var sc = me.down ("*[name=classes]").query ("panel");
		for (var i = 0; i < sc.length; i ++) {
			var n = sc [i].n;
			var clsId = me.down ("*[name=class_" + n + "]").getValue ();
			var attr1 = me.down ("*[name=attr1_" + n + "]").getValue ();
			var attr2 = me.down ("*[name=attr2_" + n + "]").getValue ();
			var join = me.down ("*[name=join_" + n + "]").getValue ();
			if (clsId && attr1 && attr2 && join) {
				var cls = {};
				cls [n] = $o.getClass (clsId).getFullCode ();
				v.from = v.from.concat (join, cls, "on");
				var a1 = {};
				a1 [attr1.split (":")[0]] = attr1.split (":")[1];
				var a2 = {};
				a2 [attr2.split (":")[0]] = attr2.split (":")[1];
				v.from.push ([a1, "=", a2]);
			};
		};
		me.down ("codemirrortextarea[name='json']").setValue (JSON.stringify (v, null, "\t"));
	},
	addClass: function (n) {
		if (typeof (n) == "object") {
			n = null;
		};
		var me = this;
		var classes = me.down ("*[name=classes]");
		if (!n) {
			var panels = classes.query ("panel");
			var aliases = "abcdefghijklmnopqrstuvwxyz";
			for (var i = 0; i < aliases.length; i ++) {
				var has = 0;
				for (var j = 0; j < panels.length; j ++) {
					if (panels [j].n == aliases [i]) {
						has = 1;
						break;
					};
				};
				if (!has && aliases [i] != me.down ("*[name=alias]").getValue ()) {
					n = aliases [i];
					break;
				};
			};
		};
		classes.add ({
			layout: "vbox",
			bodyPadding: 5,
			width: 300,
			n: n,
			style: "margin-right: 5px",
			items: [{
				xtype: "$conffield", 
				fieldLabel: $o.getString ("Class"),
				width: "100%",
				labelWidth: 100,
				name: "class_" + n, 
				confRef: "class",
				choose: {
					type: "layout", attr: "olap.id", width: 500, height: 400, layout: {
						treegrid: {
							id: "olap",
							view: "system.classes",
						    fields: {
						        id: "id",
						        parent: "parent_id"
						    },
						    filter: {
						        fn: function () {return ["id", ">=", 1000, "and", "end_id", "=", 2147483647]}
						    }
						}
					}
				},
				listeners: {
					change: function () {
						me.updateAttrsStore ();
						var attr1 = this.up ("*").down ("*[fieldLabel='" + $o.getString ("Attribute") + " 1']");
						var attr2 = this.up ("*").down ("*[fieldLabel='" + $o.getString ("Attribute") + " 2']");
						if (!attr1.getValue () && !attr2.getValue ()) {
							var cls1 = me.down ("*[name=class]").getValue ();
							var cls2 = this.getValue ();
							if (cls1 && cls2) {
								var attrs1 = $o.getClass (cls1).attrs;
								var alias1 = me.down ("*[name=alias]").getValue ();
								var alias2 = this.up ("*").down ("*[fieldLabel='" + $o.getString ("Alias") + "']").getValue ();
								for (var attr in attrs1) {
									var ca = attrs1 [attr];
									if (ca.get ("type") == cls2) {
										attr1.setValue (alias1 + ":" + attr);
										attr2.setValue (alias2 + ":id");
										break;
									};
								};
							};
						};
						me.validator ();
						me.updateFrom ();
						me.updateClasses ();
					}
				}
			}, {
				xtype: "textfield",
				fieldLabel: $o.getString ("Alias"),
				name: "alias_" + n,
				value: n,
				listeners: {
					change: function () {
						me.updateAttrsStore ();
						me.validator ();
						me.updateFrom ();
						me.updateClasses ();
					}
				}
			}, {
				xtype: "combo",
				fieldLabel: $o.getString ("Attribute") + " 1",
				name: "attr1_" + n,
				width: "100%",
				labelWidth: 100,
				mode: "local",
				queryMode: "local",
				editable: false,
				store: me.store,
				valueField: "id",
				displayField: "text",
				listeners: {
					select: function () {
						me.validator ();
						me.updateFrom ();
					}
				}
			}, {
				xtype: "combo",
				fieldLabel: $o.getString ("Attribute") + " 2",
				name: "attr2_" + n,
				width: "100%",
				labelWidth: 100,
				mode: "local",
				queryMode: "local",
				editable: false,
				store: me.store,
				valueField: "id",
				displayField: "text",
				listeners: {
					select: function () {
						me.validator ();
						me.updateFrom ();
					}
				}
			}, {
				xtype: "combo",
				fieldLabel: $o.getString ("Union"),
				name: "join_" + n,
				width: "100%",
				labelWidth: 100,
				mode: "local",
				queryMode: "local",
				editable: false,
				store: new Ext.data.ArrayStore ({
					fields: ["id", "text"],
					data: [["left-join", $o.getString ("External")], ["inner-join", $o.getString ("Internal")]]
				}),
				value: "left-join",
				valueField: "id",
				displayField: "text",
				listeners: {
					select: function () {
						me.validator ();
						me.updateFrom ();
					}
				}
			}, {
				xtype: "button",
				text: $o.getString ("Remove"),
				iconCls: "gi_circle_minus",
				style: "margin-top: 5px",
				handler: function () {
					var p = this.up ("panel");
					classes.remove (p);
					classes.doLayout ();
					me.updateAttrsStore ();
					me.validator ();
					me.updateFrom ();
					me.updateClasses ();

				}
			}]
		});
		classes.doLayout ();
	},
	updateFilter: function (value) {
		var me = this;
		var v = me.decodeQuery ();
		if (!v) {
			return;
		};
		v.where = value;
		me.down ("codemirrortextarea[name='json']").setValue (JSON.stringify (v, null, "\t"));
	},
	updateClasses: function () {
		var me = this;
		var classArr = [], classAliases = {}, aliases = [];
		function setAlias (clsId, alias) {
			classAliases [clsId] = alias;
			var cls = $o.getClass (clsId);
			if (cls.get ("parent")) {
				setAlias (cls.get ("parent"), alias);
			};
		};
		var clsId = me.down ("*[name=class]").getValue (), cls;
		if (clsId) {
			classArr.push (clsId);
			setAlias (clsId, me.down ("*[name=alias]").getValue ());
			aliases.push (me.down ("*[name=alias]").getValue ());
		};
		var classes = me.down ("*[name=classes]").query ("panel");
		for (var i = 0; i < classes.length; i ++) {
			var clsId = me.down ("*[name=class_" + classes [i].n + "]").getValue ();
			var alias = me.down ("*[name=alias_" + classes [i].n + "]").getValue ();
			if (clsId) {
				classArr.push (clsId);
				setAlias (clsId, alias);
				aliases.push (alias);
			};
		};
		me.down ("*[name=attrs]").setClasses (classArr, classAliases, aliases);
		me.down ("*[name=filter]").setClasses (classArr, classAliases, aliases);
		me.down ("*[name=sort]").setClasses (classArr, classAliases, aliases);
	},
	validator: function () {
		var me = this;
	},
	clear: function () {
		var me = this;
		me.down ("*[name=class]").setValue (null);
		me.down ("*[name=classes]").removeAll ();
		me.down ("*[name=attrs]").setValue (null);
		me.down ("*[name=filter]").setValue (null);
		me.down ("*[name=sort]").setValue (null);
	},
	buildForm: function (v) {
		var me = this;
		v = v || {};
		me.down ("*[name=alias]").setValue ("a");
		if (v.from && v.from.length) {
			var clsCode; for (clsCode in v.from [0]) {break;};
			me.down ("*[name=alias]").setValue (clsCode);
			clsCode = v.from [0][clsCode];
			var cls = $o.getClass (clsCode);
			me.down ("*[name=class]").setValue (cls.get ("id"));
			for (var i = 1; i < v.from.length; i += 4) {
				var alias; for (alias in v.from [i + 1]) {break;};
				var n = alias;
				me.addClass (n);
				var clsAdd = $o.getClass (v.from [i + 1][alias]);
				me.down ("*[name=class_" + n + "]").setValue (clsAdd.get ("id"));
				var attr1 = v.from [i + 3][0];
				for (alias in attr1) {
					me.down ("*[name=attr1_" + n + "]").setValue (alias + ":" + attr1 [alias]);
					break;
				};
				var attr2 = v.from [i + 3][2];
				for (alias in attr2) {
					me.down ("*[name=attr2_" + n + "]").setValue (alias + ":" + attr2 [alias]);
					break;
				};
				if (v.from [i] == "left-join") {
					me.down ("*[name=join_" + n + "]").setValue ("left-join");
				} else {
					me.down ("*[name=join_" + n + "]").setValue ("inner-join");
				};
			};
		};
		if (v.select) {
			me.down ("*[name=attrs]").setValue (v.select);
		};
		if (v.where) {
			me.down ("*[name=filter]").setValue (v.where);
		};
		if (v.order) {
			me.down ("*[name=sort]").setValue (v.order);
		};
	},
	getValue: function () {
		var me = this;
		return me.down ("codemirrortextarea[name='json']").getValue ();
	},
	updateAliases: function (v) {
		if (!v) {
			return;
		};
		var me = this;
		var aliases = {}, alias;
		if (v.from) {
			for (alias in v.from [0]) {break;};
			aliases [alias] = "a";
			var n = 1;
			for (var i = 1; i < v.from.length; i += 4) {
				for (alias in v.from [i + 1]) {break;};
				aliases [alias] = "c" + n;
				n ++;
			};
			function update (o) {
				if (!o) {
					return;
				};
				if (Ext.isArray (o)) {
					for (var i = 0; i < o.length; i ++) {
						update (o [i]);
					};
				} else
				if (typeof (o) == "object") {
					for (alias in o) {break;};
					if (alias != aliases [alias]) {
						o [aliases [alias]] = o [alias];
						delete o [alias];
					};
				};
			};
			update (v.select);
			update (v.from);
			update (v.where);
			update (v.order);
		};
	},
	setValue: function (value) {
		var me = this;
		var container = me.down ("*[name=constructor]");
		container.getEl ().unmask (true);
		if (!value) {
			value = {
				designer: 1
			};
		};
		var text = typeof (value) == "object" ? JSON.stringify (value, null, "\t") : value;
		me.down ("codemirrortextarea[name='json']").setValue (text);
		if (typeof (value) == "string") {
			try {
				value = JSON.parse (value);
				if (!value.designer) {
					throw "invalid";
				};
			} catch (e) {
				container.getEl ().mask ($o.getString ("Sorry, we could not decode the source code layout"));
				me.down ("tabpanel").setActiveTab (me.down ("panel[name=source]"));
				return;
			};
		};
		me.clear ();
		//me.updateAliases (value);
		me.buildForm (value);
		me.down ("codemirrortextarea[name='json']").setValue (text);
	},
	setReadOnly: function (ro) {
		var me = this;
		/*
		if (ro) {
			me.disable ();
		} else {
			me.enable ();
		};
		me.ro = ro;
		*/
	},
	updateAttrsStore: function () {
		var me = this;
		var data = [];
		var classes = me.query ("*[confRef=class]");
		var aliases = [me.down ("*[name=alias]")].concat (me.query ("*[fieldLabel=" + $o.getString ("Alias") + "]"));
		for (var i = 0; i < classes.length; i ++) {
			if (!classes [i].getValue () || !aliases [i].getValue ()) {
				continue;
			};
			var alias;
			for (var j = 0; j < aliases.length; j ++) {
				if ((classes [i].name.split ("_") == 1 && aliases [j].name.split ("_") == 1) ||
					(classes [i].name.split ("_")[1] == aliases [j].name.split ("_")[1])
				) {
					alias = aliases [j].getValue ();
					break;
				};
			};
			data.push ([alias + ":id", alias + ":id"]);
			var clsId = classes [i].getValue ();
			var cls = $o.getClass (clsId);
			for (var attr in cls.attrs) {
				var ca = cls.attrs [attr];
				if (ca.get ("type") == 2 || ca.get ("type") == 12 || ca.get ("type") >= 1000) {
					data.push ([alias + ":" + attr, alias + ":" + ca.toString ()]);
				};
			};
		};
		me.store.loadData (data);
	}
});


Ext.define ("$o.QueryColumns.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.querycolumns", "widget.$querycolumns"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.$view = $o.getView (me.viewId);
		if (me.updateAttrs ()) {
			me.items = {
				/*
				anchor: "100% 100%",
				border: 0,
				layout: "fit",
				items: [{
					*/
					xtype: "$o.layout",
					border: 1,
					$layout: {
						split: {
							orientation: "vertical",
							height: 100,
							items: [{
								layout: "fit",
								xtype: "$o.layout",
								$layout: {
									olap: {
										id: "olap",
										view: me.$view.getFullCode (),
										hideBottomToolbar: 1,
										groupedColumns: true,
										listeners: {
											columnresize: me.onColumnResize,
											columnmove: me.onColumnMove,
											columnhide: me.onColumnHide,
											columnshow: me.onColumnShow,
											scope: me
										}
									}
								},
								listeners: {
									afterrender: function () {
										me.olapContainer = this;
									}
								}
							}, {
								split: {
									title: $o.getString ("Columns"),
									iconCls: "gi_file",
									orientation: "vertical",
									height: 185,
									pages: [{
										olap: {
											id: "olapAttrs",
											view: "system.viewAttrs",
											filter: ["view_id", "=", me.viewId],
											listeners: {
												afterrender: function () {
													me.olapAttrs = this;
												}
											}
										}
									}, {
										cardConf: {
											id: "attrCard",
											items: [{
												conf: "viewAttr", id: "olapAttrs", attr: "id.name", fieldLabel: $o.getString ("Name")
											}, {
												conf: "viewAttr", id: "olapAttrs", attr: "id.code", fieldLabel: $o.getString ("Code"), allowBlank: false, maskRe: /[A-Za-z0-9\_]/
											}, {
												xtype: "compositefield", fieldLabel: $o.getString ("Visible"),
												items: [{
													conf: "viewAttr", id: "olapAttrs", attr: "id.area", xtype: "checkbox", width: 100
												}]
											}, {
												xtype: "compositefield", fieldLabel: $o.getString ("N"),
												items: [{
													conf: "viewAttr", id: "olapAttrs", attr: "id.order", xtype: "numberfield", width: 100
												}]
											}, {
												xtype: "compositefield", fieldLabel: $o.getString ("Width"),
												items: [{
													conf: "viewAttr", id: "olapAttrs", attr: "id.width", xtype: "numberfield", width: 100
												}]
											}],
											active: {
												fn: function () {
													return !me.schemaId;
												}
											},
											listeners: {
												afterSave: function () {
													me.olapContainer.removeAll ();
													me.olapContainer.add ({
														layout: "fit",
														xtype: "$o.layout",
														$layout: {
															olap: {
																id: "olap",
																view: me.$view.getFullCode (),
																hideBottomToolbar: 1,
																groupedColumns: true,
																listeners: {
																	columnresize: me.onColumnResize,
																	columnmove: me.onColumnMove,
																	columnhide: me.onColumnHide,
																	columnshow: me.onColumnShow
																}
															}
														}
													});
													me.olapContainer.updateLayout ();
												}
											}
										}
									}]
								}
							}]
						}
					}
				//}]
			};
			me.dockedItems = {
				dock: "top",
				height: 60,
				layout: "vbox",
				border: 0,
				bodyPadding: 5,
				defaults: {
					width: "100%"
				},
				items: [{
					xtype: "label",
					text: "- " + $o.getString ("To hide / show a column use context menu of any column")
				}, {
					xtype: "label",
					text: "- " + $o.getString ("Drag the column to modify its location")
				}, {
					xtype: "label",
					text: "- " + $o.getString ("Width of columns set in the header of table at the column boundaries")
				}]
			};
		};
		this.callParent (arguments);
	},
	getClassAndClassAttr: function (viewAttrCode, query) {
		var me = this;
		var classes = {}, alias;
		for (alias in query.from [0]) {break;};
		classes [alias] = $o.getClass (query.from [0][alias]);
		for (var i = 1; i < query.from.length; i += 4) {
			for (alias in query.from [i + 1]) {break;};
			classes [alias] = $o.getClass (query.from [i + 1][alias]);
		};
		for (var i = 1; i < query.select.length; i += 2) {
			if (query.select [i] == viewAttrCode) {
				for (alias in query.select [i - 1]) {break;};
				var caCode = query.select [i - 1][alias];
				return [classes [alias], classes [alias].attrs [caCode]];
			};
		};
	},
	updateAttrs: function () {
		var me = this;
		var query, attrs = [];
		try {
			query = JSON.parse (me.$view.get ("query"));
			// query attrs -> view attrs
			var npp = 1;
			for (var attr in me.$view.attrs) {
				if (me.$view.attrs [attr].order && me.$view.attrs [attr].order >= npp) {
					npp = me.$view.attrs [attr].order + 1;
				};
			};
			for (var i = 1; i < query.select.length; i += 2) {
				var attr = query.select [i];
				attrs.push (attr);
				if (!me.$view.attrs [attr]) {
					var cca = me.getClassAndClassAttr (attr, query);
					var name = cca [1] ? cca [1].get ("name") : attr;
					if (attr == "a_id" || (attr [0] == "c" && attr.substr (attr.length - 3, 3) == "_id")) {
						name = "id";
					};
					var va = $o.createViewAttr ({
			    		name: name,
			    		code: attr,
			    		view: me.viewId,
			    		area: 1,
			    		width: 75,
			    		"class": cca [0].get ("id"),
			    		order: npp ++,
			    		classAttr: cca [1] ? cca [1].get ("id") : null
					});
					va.sync ();
				};
			};
			// remove view attrs
			for (var attr in me.$view.attrs) {
				if (attrs.indexOf (attr) == -1) {
					var va = me.$view.attrs [attr];
					va.remove ();
					va.sync ();
				};
			};
			return 1;
		} catch (e) {
			me.items = {
				layout: {
					type: "vbox",
					align: "center",
					pack: "center"
				}, 
				items: [{
					xtype: "label",
					text: $o.getString ("Sorry, we could not decode the source code query")
				}]
			};
		};
	},
	onColumnResize: function (ct, column, width) {
		if (!column.$field) {
			return;
		};
		var vaId = column.$field.id;
		var va = $o.getViewAttr (vaId);
		va.set ("width", width);
		va.sync ();
		if (this.olapAttrs) {
			this.olapAttrs.refresh ();
		};
	},
	onColumnMove: function (ct, column, fromIdx, toIdx) {
		var me = this;
		var cols = ct.getGridColumns ();
		for (var i = 0; i < cols.length; i ++) {
			if (!cols [i].$field) {
				continue;
			};
			var va = $o.getViewAttr (cols [i].$field.id);
			if (va.get ("order") != i + 1) {
				va.set ("order", i + 1);
				va.sync ();
			};
		};
		if (this.olapAttrs) {
			this.olapAttrs.refresh ();
		};
	},
	onColumnHide: function (ct, column) {
		if (!column.$field) {
			return;
		};
		var vaId = column.$field.id;
		var va = $o.getViewAttr (vaId);
		va.set ("area", 0);
		va.sync ();
		if (this.olapAttrs) {
			this.olapAttrs.refresh ();
		};
	},
	onColumnShow: function (ct, column) {
		if (!column.$field) {
			return;
		};
		var vaId = column.$field.id;
		var va = $o.getViewAttr (vaId);
		va.set ("area", 1);
		va.sync ();
		if (this.olapAttrs) {
			this.olapAttrs.refresh ();
		};
	}
});

Ext.define ("$o.ReportDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.reportdesigner", "widget.$reportdesigner"],
	layout: "vbox",
	border: 0,
	initComponent: function () {
		var me = this;
		me.startRowsNum = 10;
		me.startColsNum = 50;
		var rows = [];
		for (var i = 0; i < me.startRowsNum; i ++) {
			var cells = [];
			for (var j = 0; j < me.startColsNum; j ++) {
				cells.push ({text: "", style: "s1"});
			};
			rows.push ({
				height: 20, cells: cells
			});
		};
		var columns = [];
		for (var i = 0; i < me.startColsNum; i ++) {
			columns.push (50);
		};
		me.value = me.value || {
			name: undefined,
			code: undefined,
			query: [],
			styles: {
				s1: {
					hAlign: "Left",
					vAlign: "Top",
					wrap: true,
					fontSize: 10
				}
			},
			sheets: [{
				name: "Лист1",
				columns: columns,
				rows: rows
			}]
		};
		me.divId = "div-" + (++ Ext.Component.AUTO_ID);
		me.items = [{
			xtype: "tabpanel",
			width: "100%",
			deferredRender: false,
			flex: 1,
			items: [{
				title: "Шаблон",
				iconCls: "gi_edit",
				autoScroll: true,
				tbar: [{
					text: "Объединить",
					iconCls: "gi_resize_small",
					handler: function () {
						if (me.selectedRange) {
							me.ht.mergeCells.mergeOrUnmergeSelection (me.selectedRange);
							me.ht.render ();
						};
					}
				}, {
					iconCls: "gi_bold",
					tooltip: "Полужирный",
					handler: function () {
						me.updateProp ("bold", "bool");
					}
				}, {
					iconCls: "gi_italic",
					tooltip: "Курсив",
					handler: function () {
						me.updateProp ("italic", "bool");
					}
				}, {
					iconCls: "gi_unchecked",
					tooltip: "Рамка",
					handler: function () {
						me.updateProp ("borders", "bool");
					}
				}, "-", {
					iconCls: "gi_align_left",
					tooltip: "Горизонтально: Слева",
					handler: function () {
						me.updateProp ("hAlign", "Left");
					}
				}, {
					iconCls: "gi_align_center",
					tooltip: "Горизонтально: По центру",
					handler: function () {
						me.updateProp ("hAlign", "Center");
					}
				}, {
					iconCls: "gi_align_right",
					tooltip: "Горизонтально: Справа",
					handler: function () {
						me.updateProp ("hAlign", "Right");
					}
				}, "-", {
					iconCls: "gi_up_arrow",
					tooltip: "Вертикально: Сверху",
					handler: function () {
						me.updateProp ("vAlign", "Top");
					}
				}, {
					iconCls: "gi_minus",
					tooltip: "Вертикально: По центру",
					handler: function () {
						me.updateProp ("vAlign", "Middle");
					}
				}, {
					iconCls: "gi_down_arrow",
					tooltip: "Вертикально: Внизу",
					handler: function () {
						me.updateProp ("vAlign", "Bottom");
					}
				}/*, "-", {
					iconCls: "gi_circle_plus",
					tooltip: "Добавить строку",
					handler: function () {
						me.addRow ();
					}
				}, {
					iconCls: "gi_circle_minus",
					tooltip: "Удалить строку",
					handler: function () {
						me.removeRow ();
					}
				}*/],
				html: "<div id='" + me.divId + "' style='width: 100%; height: 100%;'></div>"
			}, {
				title: "Настройка",
				iconCls: "gi_settings",
				layout: "vbox",
				bodyPadding: 3,
				border: false,
				items: [{
					xtype: "textfield",
					name: "name",
					fieldLabel: "Наименование",
					width: "100%",
					value: me.value.name
				}, {
					xtype: "textfield",
					name: "code",
					fieldLabel: "Код",
					width: "100%",
					value: me.value.code
				}, {
					xtype: "combo",
					fieldLabel: "Ориентация",
					name: "orientation",
					width: 250,
					mode: "local",
					queryMode: "local",
					editable: false,
					store: new Ext.data.ArrayStore ({
						fields: ["id", "text"],
						data: [
							["portrait", "Книжная"],
							["landscape", "Альбомная"]
						]
					}),
					value: me.value.sheets [0].orientation ? me.value.sheets [0].orientation : "portrait",
					valueField: "id",
					displayField: "text"
				}, {
					xtype: "$o.reportquery",
					width: "100%",
					flex: 1,
					value: me.value.query,
					listeners: {
						change: function (value) {
							me.value.query = value;
						}
					}
				}]
			}]
		}];
		me.on ("afterrender", function () {
			if (window.Handsontable) {
				me.make ();
			} else {
				$o.util.loadJS ("/third-party/js/jquery-2.1.1.min.js", function () {
					$o.util.loadCSS ("/third-party/handsontable/jquery.handsontable.full.css", function () {
						$o.util.loadJS ("/third-party/handsontable/jquery.handsontable.full.min.js", function () {
							$(document).ready (function () {
								me.make ();
							});
						});
					});
				});
			};
		}, me);
		me.addEvents ("change");
		me.callParent (arguments);
	},
	updateProp: function (prop, value) {
		var me = this;
		var sa = me.selectedArea;
		if (!sa) {
			return;
		};
		for (var i = sa.row; i < (sa.row + sa.rowspan); i ++) {
			for (var j = sa.col; j < (sa.col + sa.colspan); j ++) {
				if (value == "bool") {
					var v = true;
					if (me.styleObjects [me.cellStyle [i + "_" + j]]) {
						v = me.styleObjects [me.cellStyle [i + "_" + j]][prop] ? false : true;
					};
					var style = me.createStyle (me.cellStyle [i + "_" + j], prop, v);
					me.cellStyle [i + "_" + j] = style;
				} else {
					var style = me.createStyle (me.cellStyle [i + "_" + j], prop, value);
					me.cellStyle [i + "_" + j] = style;
				};
			};
		};
		me.ht.selectCell (sa.row, sa.col, sa.row + sa.rowspan - 1, sa.col + sa.colspan - 1);
		me.ht.render ();
	},
	addCol: function () {
		var me = this;
		me.ht.alter ("insert_col", me.selectedArea.col, 1);
	},
	removeCol: function () {
		var me = this;
		me.ht.alter ("remove_col", me.selectedArea.col, 1);
	},
	addRow: function () {
		var me = this;
		me.ht.alter ("insert_row", me.selectedArea.row, 1);
	},
	removeRow: function () {
		var me = this;
		me.ht.alter ("remove_row", me.selectedArea.row, 1);
	},
	createStyle: function (style, prop, value) {
		var me = this;
		var o = style ? $o.util.clone (me.styleObjects [style]) : {};
		o [prop] = value;
		var has, maxN = 0;
		for (var style in me.styleObjects) {
			var so = me.styleObjects [style];
			if (JSON.stringify (so).length == JSON.stringify (o).length) {
				var equal = 1;
				for (var p in o) {
					if (o [p] != so [p]) {
						equal = 0;
						break;
					};
				};
				if (equal) {
					has = style;
					break;
				};
			};
			if (maxN < Number (style.substr (1))) {
				maxN = Number (style.substr (1));
			};
		};
		if (has) {
			return has;
		} else {
			me.styleObjects ["s" + (maxN + 1)] = o;
			return "s" + (maxN + 1);
		};
	},
	getData: function () {
		var me = this;
		var rows = me.value.sheets [0].rows;
		var data = [], i;
		me.cellStyle = {};
		for (i = 0; i < rows.length; i ++) {
			var row = {}, cells = rows [i].cells, j;
			for (j = 0; j < cells.length; j ++) {
				row ["c" + j] = cells [j].text;
				me.cellStyle [i + "_" + j] = cells [j].style;
			};
			for (; j < me.startColsNum; j ++) {
				row ["c" + j] = "";
			};
			data.push (row);
		};
		return data;
	},
	getColWidths: function () {
		var me = this;
		var colWidths = me.value.sheets [0].columns;
		for (var i = colWidths.length; i < me.startColsNum; i ++) {
			colWidths.push (50);
		};
		return colWidths;
	},
	getColumns: function () {
		var me = this;
		var rows = me.value.sheets [0].rows;
		var colNum = me.startColsNum;
		for (var i = 0; i < rows.length; i ++) {
			if (rows [i].cells.length > colNum) {
				colNum = rows [i].cells.length;
			};
		};
		var columns = [];
		for (var i = 0; i < colNum; i ++) {
			columns.push ({
				data: "c" + i,
				renderer: me.cellRenderer
			});
		};
		return columns;
	},
	setStyles: function () {
		var me = this;
		me.styleObjects = me.value.styles;
	},
	getRowHeights: function () {
		var me = this;
		var heights = [];
		var rows = me.value.sheets [0].rows;
		for (var i = 0; i < rows.length; i ++) {
			heights.push (rows [i].height);
		};
		return heights;
	},
	getMergeCells: function () {
		var me = this;
		var mergeCells = me.value.sheets [0].mergeCells;
		return mergeCells || true;
	},
	make: function () {
		var me = this;
		Handsontable.cmp = Handsontable.cmp || {};
		Handsontable.cmp [me.divId] = me;
		me.setStyles ();
		var options = {
			data: me.getData (),
			colWidths: me.getColWidths (),
			columns: me.getColumns (),
			rowHeights: me.getRowHeights (),
			mergeCells: me.getMergeCells (),
			manualColumnResize: true,
			manualRowResize: true,
			rowHeaders: true,
			colHeaders: true,
			minSpareRows: 1,
			minSpareCols: 1,
			contextMenu: true,
			beforeRender: function () {
				this.cmp = me;
				me.ht = this;
			},
			afterSelectionEnd: function (r, c, r2, c2) {
				me.selectedArea = {
					row: r,
					col: c,
					rowspan: r2 - r + 1,
					colspan: c2 - c + 1
				};
				me.selectedRange = this.getSelectedRange ();
			}
		};
		$("#" + me.divId).handsontable (options);
	},
	cellRenderer: function (instance, td, row, col) {
		var me = instance.cmp;
		Handsontable.renderers.TextRenderer.apply (this, arguments);
		td.style.fontFamily = "sans-serif";
		var styleObject = me.styleObjects [me.cellStyle [row + "_" + col]] || {};
		if (styleObject.fontSize) {
			td.style.fontSize = styleObject.fontSize + "pt";
		} else {
			td.style.fontSize = "10pt";
		};
		if (styleObject.hAlign) {
			td.style.textAlign = styleObject.hAlign.toLowerCase ();
		} else {
			td.style.textAlign = "left";
		};
		if (styleObject.vAlign) {
			td.style.verticalAlign = styleObject.vAlign.toLowerCase ();
		} else {
			td.style.verticalAlign = "top";
		};
		if (styleObject.bold) {
			td.style.fontWeight = "bold";
		};
		if (styleObject.italic) {
			td.style.fontStyle = "italic";
		};
		if (styleObject.borders) {
			td.style.border = "1px solid black";
		};
		return td;
	},
	getValue: function () {
		var me = this;
		var data = me.ht.getData ();
		var rows = [];
		for (var i = 0; i < data.length; i ++) {
			var cells = [];
			for (var j = 0; j < me.ht.countCols (); j ++) {
				cells.push ({
					text: data [i]["c" + j], style: me.cellStyle [i + "_" + j]
				});
			};
			rows.push ({
				height: me.ht.getRowHeight (i),
				cells: cells
			});
		};
		var columns = [];
		for (var i = 0; i < me.ht.countCols (); i ++) {
			columns.push (me.ht.getColWidth (i));
		};
		var value = {
			name: me.down ("textfield[name=name]").getValue (),
			code: me.down ("textfield[name=code]").getValue (),
			query: me.value.query,
			styles: me.styleObjects,
			sheets: [{
				name: "Sheet1",
				orientation: me.down ("*[name=orientation]").getValue (),
				columns: columns,
				rows: rows,
				mergeCells: me.ht.mergeCells.mergedCellInfoCollection,
				countEmptyRows: me.ht.countEmptyRows (true),
				countEmptyCols: me.ht.countEmptyCols (true)
			}]
		};
		return value;
	},
	build: function (options) {
		var me = this;
		me.processTags (options);
		if (options.preview) {
			me.generateXMLSS ().preview ();
		} else
		if (options.html) {
			var html = me.generateHTML ();
			me.previewHTML (html);
		} else {
			var report = me.generateXMLSS ();
			if (options.pdf) {
				report.createPDF ();
			} else {
				report.create ();
			};
		};
	},	
	generateXMLSS: function () {
		var me = this;
		var r = [], rows = me.value.sheets [0].rows;
		var mc = me.value.sheets [0].mergeCells;
		for (var i = 0; i < rows.length; i ++) {
			var c = [], cells = rows [i].cells;
			for (var j = 0; j < cells.length; j ++) {
				var colspan = 1, rowspan = 1;
				var skip = 0;
				for (var k = 0; k < mc.length; k ++) {
					if (mc [k].row == i && mc [k].col == j) {
						colspan = mc [k].colspan;
						rowspan = mc [k].rowspan;
						break;
					} else
					if (i >= mc [k].row && i < (mc [k].row + mc [k].rowspan) && j >= mc [k].col && j < (mc [k].col + mc [k].colspan)) {
						skip = 1;
						break;
					};
				};
				if (skip) {
					continue;
				};
				c.push ({
					text: cells [j].text,
					style: cells [j].style,
					colspan: colspan,
					rowspan: rowspan,
					startIndex: j + 1
				});
			};
			r.push ({
				height: rows [i].height * 0.75,
				cells: c
			});
		};
		var s = {
			'default': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:10'
		}, styles = me.value.styles;
		for (var key in styles) {
			var o = styles [key];
			var ss = ["wrap:true"];
			if (o.fontSize) {
				ss.push ("fontSize:" + o.fontSize);
			};
			if (o.hAlign) {
				ss.push ("hAlign:" + o.hAlign);
			};
			if (o.vAlign) {
				ss.push ("vAlign:" + (o.vAlign == "Middle" ? "Center" : o.vAlign));
			};
			if (o.bold) {
				ss.push ("bold:true");
			};
			if (o.italic) {
				ss.push ("italic:true");
			};
			if (o.borders) {
				ss.push ("borders:All");
			};
			s [key] = ss.join (",");
		};
		var c = [], columns = me.value.sheets [0].columns;
		for (var i = 0; i < columns.length; i ++) {
			c.push (columns [i] / 7);
		};
		var report = new $report.xmlss ();
		report.styles = s;
		report.sheets = [new $report.sheet ({
			name: 'Лист1', 
			orientation: me.value.sheets [0].orientation,
			margins: {
				left: 15,
				top: 15,
				right: 15,
				bottom: 15
			},
			columns: c,
			rows: r
		})];
		return report;
	},
	generateHTML: function (options) {
		var me = this;
		var html = "";
		var rows = me.value.sheets [0].rows;
		var columns = me.value.sheets [0].columns;
		var mc = me.value.sheets [0].mergeCells;
		var borderCells = {};
		for (var i = 0; i < rows.length; i ++) {
			var row = rows [i];
			var cells = row.cells;
			var r = "<tr style='height:" + row.height + "px'>";
			for (var j = 0; j < cells.length; j ++) {
				var colspan = 1, rowspan = 1;
				var skip = 0;
				for (var k = 0; k < mc.length; k ++) {
					if (mc [k].row == i && mc [k].col == j) {
						colspan = mc [k].colspan;
						rowspan = mc [k].rowspan;
						break;
					} else
					if (i >= mc [k].row && i < (mc [k].row + mc [k].rowspan) && j >= mc [k].col && j < (mc [k].col + mc [k].colspan)) {
						skip = 1;
						break;
					};
				};
				if (skip) {
					continue;
				};
				var style = "";
				var cell = cells [j];
				var v = cell.text;
				if (v === undefined || v === null || v === "") {
					v = "<img width=1 height=1>";
				};
				var cellStyle = me.value.styles [cell.style];
				cellStyle = cellStyle || {};
				if (cellStyle.bold > -1) {
					style = "font-weight:bold;";
				};
				if (cellStyle.italic > -1) {
					style = "font-style:italic;";
				};
				if (cellStyle.hAlign) {
					style += "text-align:" + cellStyle.hAlign.toLowerCase () + ";";
				};
				if (cellStyle.vAlign) {
					style += "vertical-align:" + cellStyle.vAlign.toLowerCase () + ";";
				};
				if (cellStyle.borders) {
					borderCells [i] = borderCells [i] || {};
					borderCells [i][j] = 1;
					if (!borderCells [i - 1] || !borderCells [i - 1][j]) {
						style += "border-top:1px solid black;";
					};
					if (!borderCells [i][j - 1]) {
						style += "border-left:1px solid black;";
					};
					style += "border-right:1px solid black;";
					style += "border-bottom:1px solid black;";
				};
				style += "width:" + columns [j] + "px;padding:2px;";
				r += "<td class='tb-text' colspan=" + colspan + " rowspan=" + rowspan + " style='" + style + "'>" + v + "</td>";
			};
			r += "</tr>\n";
			html += r;
		};
		return html;
	},
	previewHTML: function (html) {
		var me = this;
		r =
			"<style type='text/css'>\n" +
			"* {\n" +
			"   font-family: Tahoma;\n" +
			"   font-size: 8pt;\n" +
			"}\n" +
			"</style>\n"
		;
		if (me.value.sheets [0].orientation == "landscape") {
			r +=
				'<style type="text/css" media="print">\n' +
				'\t@page { size: landscape; }\n' +
				'</style>\n'
			;
		};
		r +=
			"<table cellpadding=0 cellspacing=0>" +
			html +
			"</table>"
		;
		w = window.open ("", "window1", "width=800, height=600, resizable=yes, scrollbars=yes, status=yes, top=10, left=10");
		w.document.open ();
		w.document.write (r);
		w.document.close ();
		w.print ();
	},
	processObject: function (t, row, args, tags, rowNum) {
		var me = this;
		var r = [], cells = row.cells;
		var a = args [t];
		var num = 0;
		for (var i in a) {
			var c = [];
			for (var j = 0; j < cells.length; j ++) {
				var text = cells [j].text;
				for (var k = 0; k < tags.length; k ++) {
					var tag = tags [k];
					var v = args [tag] == undefined ? "" : args [tag];
					var tokens = tag.split (".");
					if (tokens [0] == t && tokens.length > 1) {
						for (var l = 1, v = a [i]; l < tokens.length; l ++) {
							v = v ? v [tokens [l]] : undefined;
						};
					};
					if (v == undefined) {
						v = "";
					};
					text = text.split ("[#" + tags [k] + "]").join (v);
				};
				c.push ({
					text: text,
					style: cells [j].style
				});
			};
			r.push ({
				height: row.height,
				cells: c
			});
			num ++;
			if (num > 1) {
				me.moveMergeCells (rowNum);
			};
		};
		return r;
	},
	processQuery: function (t, query, row, args, tags, rowNum) {
		var me = this;
		var r = [], cells = row.cells;
		var v = $o.getView (query.view);
		var sql = JSON.parse (v.get ("query"));
		if (query.filter && query.filter.length) {
			var filter = query.filter;
			for (var i = 0; i < filter.length; i ++) {
				var f = filter [i];
				if (f [0] == "[" && f [1] == "#") {
					filter [i] = args [f.substr (2, f.length - 3)];
				};
				for (var j = 1; j < sql.select.length; j += 2) {
					if (sql.select [j] == f) {
						filter [i] = sql.select [j - 1];
					};
				};
			};
			sql.where = sql.where || [];
			if (sql.where.length) {
				sql.where = [sql.where, "and"];
			};
			sql.where.push (filter);
		};
		var q = $o.execute (sql);
		var num = 0;
		for (var i = 0; i < q.length; i ++) {
			var c = [];
			for (var j = 0; j < cells.length; j ++) {
				var text = cells [j].text;
				for (var k = 0; k < tags.length; k ++) {
					var tag = tags [k];
					var v = args [tag] == undefined ? "" : args [tag];
					var tokens = tag.split (".");
					if (tokens [0] == t && tokens.length > 1) {
						v = q.get (i, tokens [1]);
					};
					text = text.split ("[#" + tags [k] + "]").join (v);
				};
				c.push ({
					text: text,
					style: cells [j].style
				});
			};
			r.push ({
				height: row.height,
				cells: c
			});
			num ++;
			if (num > 1) {
				me.moveMergeCells (rowNum);
			};
		};
		return r;
	},
	moveMergeCells: function (row) {
		var me = this;
		var mc = me.value.sheets [0].mergeCells;
		for (var i = 0; i < mc.length; i ++) {
			if (mc [i].row >= row) {
				mc [i].row ++;
			};
		};
	},
	processTags: function (args) {
		var me = this;
		var r = [], rows = me.value.sheets [0].rows;
		var query = {};
		for (var i = 0; i < me.value.query.length; i ++) {
			query [me.value.query [i].alias] = me.value.query [i];
		};
		for (var i = 0; i < rows.length; i ++) {
			var cells = rows [i].cells;
			var tags = [], isArray = "", isQuery = "";
			for (var j = 0; j < cells.length; j ++) {
				var text = cells [j].text || "";
				for (var k = 1; k < text.length; k ++) {
					if (text [k] == "#" && text [k - 1] == "[") {
						var tag = "";
						for (k ++; k < text.length; k ++) {
							if (text [k] == "]") {
								break;
							} else {
								tag += text [k];
							};
						};
						if (tags.indexOf (tag) == -1) {
							tags.push (tag);
							if (Ext.isArray (args [tag.split (".")[0]])) {
//							if (typeof (args [tag.split (".")[0]]) == "object") {
								isArray = tag.split (".")[0];
							};
							if (query [tag.split (".")[0]]) {
								isQuery = tag.split (".")[0];
							};
						};
					};
				};
			};
			if (isQuery) {
				r = r.concat (me.processQuery (isQuery, query [isQuery], rows [i], args, tags, r.length));
			} else
			if (isArray) {
				r = r.concat (me.processObject (isArray, rows [i], args, tags, r.length));
			} else {
				var c = [];
				for (var j = 0; j < cells.length; j ++) {
					var text = cells [j].text || "";
					for (var k = 0; k < tags.length; k ++) {
						var tag = tags [k];
						var tokens = tag.split (".");
						for (var l = 0, v = args; l < tokens.length; l ++) {
							v = v ? (v [tokens [l]] || "") : "";
						};
						text = text.split ("[#" + tag + "]").join (v);
					};
					c.push ({
						text: text,
						style: cells [j].style
					});
				};
				r.push ({
					height: rows [i].height,
					cells: c
				});
			};
		};
		me.value.sheets [0].rows = r;		
	}
});

Ext.define ("$o.ReportQuery.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.reportquery", "widget.$reportquery"],
	layout: "fit",
	border: false,
	initComponent: function () {
		var me = this;
	    me.store = Ext.create ("Ext.data.Store", {
	        data: me.getData (),
	        fields: [{
	        	name: "alias", type: "string"
			}, {
	        	name: "view", type: "string"
	        }]
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: "Псевдоним", width: 100, dataIndex: "alias"
			}, {
				header: "Запрос", dataIndex: "view", flex: 1
			}],
    		forceFit: true,
			frame: false,
			deferRowRender: false,
			listeners: {
				afterrender: function () {
					var sm = this.getSelectionModel ();
					sm.on ("selectionchange", function () {
						if (sm.hasSelection ()) {
							var record = sm.getSelection ()[0];
							me.down ("*[name=filter]").enable ();
							me.down ("*[name=filter]").setViewId (me.data [record.get ("alias")].view);
							me.down ("*[name=filter]").setValue (me.data [record.get ("alias")].filter);
						}
					});
				}
			}
		});
		me.items = {
			layout: "border",
			border: false,
			items: [{
			    split: true,
			    region: "west",
				width: "50%",
				layout: "fit",
				tbar: [{
					text: "Добавить",
					name: "create",
					iconCls: "gi_circle_plus",
					handler: me.create,
					scope: me
				}, {
					text: "Удалить",
					name: "delete",
					iconCls: "gi_circle_minus",
					handler: me.remove,
					scope: me
				}],
				title: "Запросы",
				iconCls: "gi_cogwheel",
				border: false,
				items: me.grid
			},{
			    region: "center",
				layout: "fit",
				title: "Фильтр",
				iconCls: "gi_filter",
				border: false,
			    items: {
					xtype: "$layoutfilter",
					name: "filter",
					disabled: true,
					reportMode: 1,
					listeners: {
						change: me.updateFilter,
						scope: me
					}
			    }
			}]
		};
		me.addEvents ("change");
		me.callParent (arguments);
	},
	getData: function () {
		var me = this;
		var data = [];
		me.data = {};
		for (var i = 0; i < me.value.length; i ++) {
			data.push ({
				alias: me.value [i].alias,
				view: $o.getView (me.value [i].view).toString ()
			});
			me.data [me.value [i].alias] = {
				alias: me.value [i].alias,
				filter: me.value [i].filter,
				view: me.value [i].view
			};
		};
		return data;
	},
	create: function () {
		var me = this;
		dialog.getView ({hasQuery: 1, success: function (options) {
			var maxN = 0;
			for (var i = 0; i < me.store.getCount (); i ++) {
				var alias = me.store.getAt (i).get ("alias");
				if (Number (alias.substr (1)) > maxN) {
					maxN = Number (alias.substr (1));
				};
			};
			var alias = "q" + (maxN + 1);
			var rec = {
				alias: alias,
				view: $o.getView (options.id).toString ()
			};
			me.store.add (rec);
			me.data [alias] = {
				alias: alias,
				view: $o.getView (options.id).getFullCode ()
			};
			me.fireEvent ("change", me.getValue ());
		}});
	},
	remove: function () {
		var me = this;
		var sm = me.grid.getSelectionModel ();
		if (sm.hasSelection ()) {
			var record = sm.getSelection ()[0];
			me.store.remove (record);
			me.down ("*[name=filter]").disable ();
			me.fireEvent ("change", me.getValue ());
		};
	},
	getValue: function () {
		var me = this;
		var value = [];
		for (var i = 0; i < me.store.getCount (); i ++) {
			var alias = me.store.getAt (i).get ("alias");
			value.push (me.data [alias]);
		};
		return value;
	},
	updateFilter: function (value) {
		var me = this;
		var sm = me.grid.getSelectionModel ();
		var record = sm.getSelection ()[0];
		me.data [record.get ("alias")].filter = value;
		me.fireEvent ("change", me.getValue ());
	}
});

Ext.define ("$o.ReportCondition.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.reportcondition", "widget.$reportcondition"],
	layout: "vbox",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.filter = me.filter || [];
		me.value = {};
		me.tbar = [{
			text: "Ок",
			iconCls: "gi_ok",
			name: "save",
			disabled: 1,
			handler: me.save,
			scope: me
		}, {
			text: "Отмена",
			iconCls: "gi_remove",
			name: "cancel",
			handler: function () {
				me.up ("window").close ();
			}
		}];
		var dataAttrs = [];
		for (var attr in me.$view.attrs) {
			var a = me.$view.attrs [attr];
			dataAttrs.push ([attr, a.toString ()]);
		};
		me.items = [{
			xtype: "combo",
			fieldLabel: "И/ИЛИ",
			labelWidth: 200,
			name: "and_or",
			width: 350,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: [
					["and", "И"],
					["or", "ИЛИ"]
				]
			}),
			valueField: "id",
			displayField: "text"
			/*
		}, {
			xtype: "checkbox",
			name: "brackets",
			labelWidth: 200,
			fieldLabel: "Условие в скобках"
			*/
		}, {
			xtype: "combo",
			fieldLabel: "Атрибут",
			name: "attr",
			width: "100%",
			labelWidth: 200,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: dataAttrs
			}),
			valueField: "id",
			displayField: "text",
			validator: me.validator
		}, {
			xtype: "combo",
			fieldLabel: "Оператор",
			labelWidth: 200,
			name: "oper",
			width: 350,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: [
					["=", "равно (=)"],
					["<>", "не равно (<>)"],
					["<", "меньше (<)"],
					[">", "больше (>)"],
					["<=", "меньше или равно (<=)"],
					[">=", "больше или равно (>=)"],
					["is null", "пусто (is null)"],
					["is not null", "не пусто (is not null)"],
					["in", "одно из перечня (in)"]
				]
			}),
			valueField: "id",
			displayField: "text",
			listeners: {
				select: function () {
					var v = this.getValue ();
					if (v == "is null" || v == "is not null") {
						me.down ("*[name='value']").disable ();
					} else {
						me.down ("*[name='value']").enable ();
					};
				}
			},
			validator: me.validator
		}, {
			xtype: "textfield",
			fieldLabel: "Значение",
			labelWidth: 200,
			width: "100%",
			name: "value",
			validator: me.validator
		}];
		if (!me.filter.length) {
			me.items.splice (0, 1);
		};
		me.items [0].style = "margin-top: 5px;";
		me.addEvents ("aftersave");
		this.callParent (arguments);
	},
	validator: function (value) {
		var me = this.up ("panel");
		var andOrField = me.down ("*[name='and_or']");
		var attrField = me.down ("*[name='attr']");
		var operField = me.down ("*[name='oper']");
		var valueField = me.down ("*[name='value']");
		if (andOrField && !andOrField.getValue ()) {
			me.down ("button[name='save']").disable ();
			return true;
		};
		if (attrField.getValue () && operField.getValue () && (
			operField.getValue () == "is null" || operField.getValue () == "is not null" || valueField.getValue ()
		)) {
			me.down ("button[name='save']").enable ();
			if (operField.getValue () == "is null" || operField.getValue () == "is not null") {
				me.value = [attrField.getValue (), operField.getValue ()];
			} else {
				var val = valueField.getValue ();
				me.value = [attrField.getValue (), operField.getValue (), val];
			};
//			var bracketsField = me.down ("*[name='brackets']");
//			if (bracketsField && bracketsField.getValue ()) {
//				me.value = [andOrField.getValue (), [me.value]];
//			} else {
			if (andOrField) {
				me.value = [andOrField.getValue ()].concat (me.value);
			};
//			};
		} else {
			me.down ("button[name='save']").disable ();
			me.value = [];
		};
		return true;
	},
	save: function () {
		var me = this;
		me.fireEvent ("aftersave", me.value);
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});

Ext.define ("$o.ProjectDesigner.Widget", {
	extend: "Ext.tab.Panel",
	alias: ["widget.$o.projectdesigner", "widget.$projectdesigner"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	bodyPadding: 5,
	deferredRender: false,
	initComponent: function () {
		var me = this;
	    var store = Ext.create ('Ext.data.Store', {
	        fields: ["action", "line", "msg", "src"],
	        data: []
	    });
	    var grid = Ext.create('Ext.grid.Panel', {
	    	name: "errors",
	        store: store,
	        columns: [{
				text: $o.getString ("Message"), dataIndex: "msg", flex: 3, renderer: me.cellRenderer
			}, {
				text: $o.getString ("Action"), dataIndex: "action", width: 250, renderer: me.cellRenderer
			}, {
				text: $o.getString ("String"), dataIndex: "line", width: 80
			}, {
				text: $o.getString ("Source code"), dataIndex: "src", flex: 2, renderer: me.cellRenderer
	        }],
	        width: "100%",
			forceFit: true,
	        flex: 1,
			selModel: Ext.create ("Ext.selection.RowModel", {
				mode: "SINGLE",
				listeners: {
					selectionchange: function () {
						me.down ("*[name=showAction]").enable ();
					}
				}
			}),
	        tbar: [{
	        	text: $o.getString ("Action", ":", "Source code"),
	        	iconCls: "gi_notes",
	        	name: "showAction",
	        	disabled: 1,
	        	handler: function () {
	        		var grid = me.down ("*[name=errors]");
					if (grid.getSelectionModel ().hasSelection ()) {
						var record = grid.getSelectionModel ().getSelection ()[0];
						var actionCode = record.get ("action");
						var a = $o.getAction (actionCode);
						var body = a.get ("body");
						var win = Ext.create ("Ext.Window", {
							width: 800, height: 600, layout: "fit",
							frame: false, border: false, bodyPadding: 1,
							modal: false,
							maximizable: true,
							title: $o.getString ("Action", ":", "Source code") + ": " + a.toString (),
							iconCls: "gi_notes",
							items: {
								name: "body",
								xtype: "codemirrortextarea",
								listeners: {
									afterrender: function () {
										this.setValue (body);
									}
								}
							},
							tbar: [{
								text: $o.getString ("Save"),
								iconCls: "gi_floppy_save",
								handler: function () {
									a.set ("body", win.down ("*[name=body]").getValue ());
									a.sync ();
									a.initAction ();
									win.close ();
								}
							}, {
								text: $o.getString ("Cancel"),
								iconCls: "gi_remove",
								handler: function () {
									win.close ();
								}
							}]
						});
						win.show ();
					};
	        	}
	        }]
	    });
		me.listeners = {
			afterrender: function () {
				$o.execute ({fn: "vo.getProjectInfo", success: function (o) {
					me.down ("*[name=revision]").setValue (o.revision);
					me.down ("*[name=name]").setValue (o.name);
					o.smtp = o.smtp || {};
					me.down ("*[name=smtpHost]").setValue (o.smtp.host);
					me.down ("*[name=smtpUsername]").setValue (o.smtp.username);
					me.down ("*[name=smtpPassword]").setValue (o.smtp.password);
					me.down ("*[name=smtpSender]").setValue (o.smtp.sender);
					me.down ("*[name=timeMachineCardButton]").setValue ($o.visualObjectum.timeMachine.cardButton);
//					me.down ("*[name=timeMachineShowDates]").setValue ($o.visualObjectum.timeMachine.showDates);
//					me.down ("*[name=timeMachineBuildTime]").setValue ($o.visualObjectum.timeMachine.buildTime);
					me.down ("*[name=logoLeft]").setValue ($o.visualObjectum.logo.left);
					me.down ("*[name=logoRight]").setValue ($o.visualObjectum.logo.right);
					me.down ("*[name=logoHeight]").setValue ($o.visualObjectum.logo.height);
					if ($o.visualObjectum.initAction) {
						me.down ("*[name=initAction]").setValue ($o.getAction ($o.visualObjectum.initAction).get ("id"));
					};
					if (o.scripts && o.scripts.client) {
						var data = [];
						for (var i = 0; i < o.scripts.client.length; i ++) {
							data.push ({name: o.scripts.client [i]});
						};
						me.down ("*[name=clientScripts]").getStore ().loadData (data);
					};
					//me.down ("*[name=siteView]").setValue (o.siteView);
				}});
			}
		};
		me.items = [{
			title: $o.getString ("Commons"),
			iconCls: "gi_file",
			layout: "vbox",
			items: [{
				xtype: "textfield",
				fieldLabel: $o.getString ("Project revision"),
				name: "revision",
				labelWidth: 200,
				width: 355,
				style: "margin-top: 5px",
				disabled: true
			}, {
				xtype: "textfield",
				fieldLabel: $o.getString ("Project name"),
				labelWidth: 200,
				name: "name",
				width: "100%"
			}, {
				xtype: "compositefield",
				fieldLabel: $o.getString ("Admin password"),
				labelWidth: 200,
				items: [{
					xtype: "textfield",
					name: "password",
					inputType: "password",
					width: 150
				}, {
					xtype: "displayfield",
					value: $o.getString ("Enter password again") + ":",
					style: "margin-left: 5px; margin-right: 2px"
				}, {
					xtype: "textfield",
					name: "password2",
					inputType: "password",
					width: 150
				}]
			}, {
				xtype: "fieldset",
				title: "SMTP",
				width: "100%",
				items: {
					layout: "hbox",
					border: 0,
					bodyPadding: 5,
					items: [{
						xtype: "textfield",
						name: "smtpHost",
						fieldLabel: $o.getString ("Host")
					}, {
						xtype: "textfield",
						name: "smtpUsername",
						style: "margin-left: 10px",
						fieldLabel: $o.getString ("User")
					}, {
						xtype: "textfield",
						name: "smtpPassword",
						style: "margin-left: 10px",
						fieldLabel: $o.getString ("Password"),
						inputType: "password"
					}, {
						xtype: "textfield",
						name: "smtpSender",
						style: "margin-left: 10px",
						fieldLabel: $o.getString ("Sender")
					}]
				}
			}, {
				xtype: "fieldset",
				title: "Time machine",
				width: "100%",
				items: {
					layout: "hbox",
					border: 0,
					bodyPadding: 5,
					items: [{
						xtype: "checkbox",
						name: "timeMachineCardButton",
						fieldLabel: $o.getString ("Show button 'Changes' in card"),
						labelWidth: 250
						/*
					}, {
						xtype: "checkbox",
						name: "timeMachineShowDates",
						style: "margin-left: 50px",
						fieldLabel: "Включить выбор даты",
						labelWidth: 150
					}, {
						xtype: "timefield",
						name: "timeMachineBuildTime",
						style: "margin-left: 50px",
						fieldLabel: "Время создания даты (UTC)",
						labelWidth: 150,
						width: 230,
						editable: false
						*/
					}]
				}
			}, {
				layout: "hbox",
				border: 0,
				style: "padding-top: 5px; padding-bottom: 5px",
				width: "100%",
				items: [{
					xtype: "button",
					text: $o.getString ("Build project"),
					iconCls: "gi_settings",
					handler: function () {
						me.down ("*[name=time]").setValue ($o.getString ("building") + " ...");
						me.down ("*[name=errNum]").setValue ($o.getString ("building") + " ...");
						me.down ("*[name=showAction]").disable ();
						$o.app.name = $ptitle = me.down ("*[name=name]").getValue ();
						var args = {
							name: me.down ("*[name=name]").getValue (),
							build: me.down ("radiogroup").getValue ().rgBuild
	//						siteView: me.down ("*[name=siteView]").getValue ()
						};
						if (me.down ("*[name=password]").getValue ()) {
							if (me.down ("*[name=password]").getValue () != me.down ("*[name=password2]").getValue ()) {
								common.message ($o.getString ("Passwords not equal"));
								return;
							};
							args.password = $o.util.sha1 (me.down ("*[name=password]").getValue ());
						};
						args.smtp = {
							host: me.down ("*[name=smtpHost]").getValue (),
							username: me.down ("*[name=smtpUsername]").getValue (),
							password: me.down ("*[name=smtpPassword]").getValue (),
							sender: me.down ("*[name=smtpSender]").getValue ()
						};
						var buildTime = null;//me.down ("*[name=timeMachineBuildTime]").getValue ();
						args.timeMachine = {
							cardButton: me.down ("*[name=timeMachineCardButton]").getValue () ? 1 : 0,
							showDates: 0//me.down ("*[name=timeMachineShowDates]").getValue () ? 1 : 0
						};
						args.logo = {
							left: me.down ("*[name=logoLeft]").getValue (),
							right: me.down ("*[name=logoRight]").getValue (),
							height: me.down ("*[name=logoHeight]").getValue ()
						};
						if (me.down ("*[name=initAction]").getValue ()) {
							args.initAction = $o.getAction (me.down ("*[name=initAction]").getValue ()).getFullCode ();
						};
						if (buildTime) {
							args.timeMachine.buildTime = 
								(buildTime.getHours () < 10 ? ("0" + buildTime.getHours ()) : buildTime.getHours ()) + ":" + 
								(buildTime.getMinutes () < 10 ? ("0" + buildTime.getMinutes ()) : buildTime.getMinutes ())
							;
						};
						$o.visualObjectum.timeMachine.cardButton = args.timeMachine.cardButton;
						$o.visualObjectum.timeMachine.showDates = args.timeMachine.showDates;
						$o.visualObjectum.timeMachine.buildTime = args.timeMachine.buildTime;
						var clientScripts = [];
						var store = me.down ("*[name=clientScripts]").getStore ();
						for (var i = 0; i < store.getCount (); i ++ ) {
							clientScripts.push (store.getAt (i).get ("name"));
						};
						args.scripts = {client: clientScripts};
						$o.execute ({fn: "vo.build", args: args, success: function (o) {
							me.showBuildResults (o);
							if (o.err && o.err.length) {
								return;
							};
							common.setConf ("projectNeedBuild", {used: 0});
							if ($o.app.projectNeedBuildTooltip) {
								$o.app.projectNeedBuildTooltip.destroy ();
							};
							me.down ("*[name=revision]").setValue (o.revision);
							$o.execute ({fn: "vo.getActions", success: function (o) {
								me.down ("*[name=actions]").setValue (o.actions);
							}});
						}});
					}
				}, {
					xtype: "radiogroup",
			        columns: 2,
			        style: "margin-left: 25px",
			        items: [{
			        	boxLabel: $o.getString ("Test"), name: "rgBuild", inputValue: "test", width: 90, checked: true, hidden: true
			        }, {
			        	boxLabel: $o.getString ("Production"), name: "rgBuild", inputValue: "prod", hidden: true
			        }]
			    }]
			}, {
				layout: "hbox",
				border: 0,
				style: "padding-top: 5px; padding-bottom: 5px",
				width: "100%",
				items: [{
					xtype: "textfield",
					labelWidth: 200,
					disabled: 1,
					name: "errNum",
					width: 300,
					fieldLabel: $o.getString ("Errors num")
				}, {
					xtype: "textfield",
					disabled: 1,
					name: "time",
					style: "margin-left: 10px",
					width: 200,
					fieldLabel: $o.getString ("Building duration")
				}]
				/*
			}, {
				xtype: "$conffield", 
				fieldLabel: "Представление посетителям",
				name: "siteView", 
				confRef: "view",
				choose: {
					type: "view", id: "system.views", attr: "olap.id", width: 500, height: 400
				},
				listeners: {
					change: function () {
					}
				},
				labelWidth: 200,
				width: "100%"
				*/
			}, 
				grid
			]
		}, {
			title: $o.getString ("Additional"),
			iconCls: "gi_file",
			layout: "vbox",
			items: [{
				xtype: "grid",
				title: $o.getString ("Client scripts"),
		    	name: "clientScripts",
		        store: Ext.create ("Ext.data.Store", {
			        fields: ["name"],
			        data: []
			    }),
		        columns: [{
					text: $o.getString ("Script location on server"), dataIndex: "name"
		        }],
		        width: "100%",
				forceFit: true,
				height: 150,
		        tbar: [{
		        	text: $o.getString ("Add"),
		        	iconCls: "gi_circle_plus",
		        	handler: function () {
		        		var grid = this.up ("grid");
		        		dialog.getString ({fieldLabel: $o.getString ("Enter script location on server"), success: function (text) {
		        			grid.getStore ().add ({name: text});
		        		}});
		        	}
		        }, {
		        	text: $o.getString ("Remove"),
		        	iconCls: "gi_circle_minus",
		        	handler: function () {
		        		var grid = this.up ("grid");
		        		var sm = grid.getSelectionModel ();
		        		if (sm.hasSelection ()) {
		        			var rec = sm.getSelection ()[0];
		        			grid.getStore ().remove (rec);
		        		};
		        	}
		        }]
		    }, {
				fieldLabel: $o.getString ("Action of client initialization"),
				labelWidth: 200,
				width: 600,
				xtype: "$conffield", 
				name: "initAction", 
				anchor: "100%",
				confRef: "action",
				style: "margin-top: 5px",
				choose: {
					type: "custom", fn: function () {
						var f = this;
						dialog.getAction ({success: function (options) {
							f.setValue (options.id);
						}});
					}

				}
		    }, {
				xtype: "fieldset",
				title: $o.getString ("Logo"),
				width: "100%",
				items: {
					layout: "vbox",
					border: 0,
					bodyPadding: 5,
					items: [{
						xtype: "textfield",
						name: "logoLeft",
						fieldLabel: $o.getString ("Left image"),
						width: "100%"
				    }, {
						xtype: "textfield",
						name: "logoRight",
						fieldLabel: $o.getString ("Right image"),
						width: "100%"
				    }, {
						xtype: "numberfield",
						name: "logoHeight",
						fieldLabel: $o.getString ("Strip height")
					}]
				}
			}]
		}, {
			title: $o.getString ("Server actions"),
			iconCls: "gi_notes",
			layout: "fit",
			tbar: [{
				text: $o.getString ("Refresh"),
				iconCls: "gi_refresh",
				handler: function () {
					$o.execute ({fn: "vo.getActions", success: function (o) {
						me.down ("*[name=actions]").setValue (o.actions);
					}});
				}
			}],
			items: {
				xtype: "codemirrortextarea",
				name: "actions",
				listeners: {
					afterrender: function () {
						var ta = this;
						$o.execute ({fn: "vo.getActions", success: function (o) {
							ta.setValue (o.actions);
						}});
					}
				}
			}
		}];
		this.callParent (arguments);
	},
	showBuildResults: function (o) {
		var me = this;
		me.down ("*[name=time]").setValue ((o.time / 1000).toFixed (3) + " сек.");
		o.err = o.err || [];
		me.down ("*[name=errNum]").setValue (o.err.length);
		me.down ("*[name=errors]").getStore ().loadData (o.err);
	},
	cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
		metaData.style = "white-space: normal;";
		return value;
	}
});

Ext.define ("$o.CardDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.carddesigner", "widget.$carddesigner"],
	layout: "fit",
	border: 0,
	defaults: {
		border: 0
	},
	initComponent: function () {
		var me = this;
		me.counter = 1;
		me.data = {};
		me.treeStore = Ext.create ('Ext.data.TreeStore', {
	    	autoSync: true,
			root: {
				expanded: true,
				children: []
			}
		});
	    me.storeAttrs = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: []
		});
	    me.storeViewAttrs = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: []
		});
		me.items = {
			layout: "border",
			border: false,
			style: "margin: 2px",
			defaults: {
				border: false
			},
			items: [{
			    split: true,
			    region: "west",
				width: "50%",
				layout: "fit",
			    items: {
			    	title: $o.getString ("Navigator"),
			    	iconCls: "gi_search",
					xtype: "treepanel",
					name: "tree",
					store: me.treeStore,
					selModel: Ext.create ("Ext.selection.TreeModel", {
						mode: "SINGLE",
						listeners: {
							selectionchange: {
								fn: me.selectionChange,
								scope: me
							}
						}
					}),
					rootVisible: false,
					viewConfig: {
		                plugins: {
		                    ptype: "treeviewdragdrop",
		                    containerScroll: true
		                },
						listeners: {
							beforedrop: function (node, data, model, pos, dropHandlers) {
								if (data.records [0].get ("text").substr (0, 5) != "Поле:" && model.parentNode.get ("text").substr (0, 10) == "Составное:") {
									// В составное поле можно класть только "Поле:"
									return false;
								} else {
									return true;
								};
							}
						}		                
		            },					
					listeners: {
						cellcontextmenu: function (tree, td, cellIndex, record, tr, rowIndex, e, eOpts) {
							me.down ("treepanel").getSelectionModel ().deselectAll ();
						}
					}
			    }
			},{
			    region: "center",
				layout: "fit",
			    items: {
			    	title: $o.getString ("Options"),
			    	iconCls: "gi_file",
			    	layout: "vbox",
			    	name: "card",
					hidden: true,
			    	bodyPadding: 5,
			    	items: [{
						xtype: "combo",
						fieldLabel: $o.getString ("Attribute"),
						name: "attr",
						width: "100%",
						mode: "local",
						queryMode: "local",
						editable: false,
						store: me.storeAttrs,
						valueField: "id",
						displayField: "text",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "textfield",
						fieldLabel: $o.getString ("Name"),
						width: "100%",
						name: "name",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "numberfield",
						fieldLabel: $o.getString ("Name width"),
						width: 200,
						name: "labelWidth",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "fieldcontainer",
						layout: "hbox",
						width: "100%",
						items: [{
							xtype: "numberfield",
							fieldLabel: $o.getString ("Width"),
							width: 200,
							name: "width",
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}, {
							xtype: "numberfield",
							fieldLabel: $o.getString ("Height"),
							width: 150,
							labelWidth: 50,
							style: "margin-left: 5px",
							name: "height",
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}]
					}, {
						xtype: "numberfield",
						fieldLabel: $o.getString ("Min value"),
						width: 200,
						name: "minValue",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "numberfield",
						fieldLabel: $o.getString ("Max value"),
						width: 200,
						name: "maxValue",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "checkbox",
						fieldLabel: $o.getString ("Read only"),
						name: "readOnly",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "checkbox",
						fieldLabel: $o.getString ("Show time"),
						name: "showTime",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "checkbox",
						fieldLabel: $o.getString ("Editor") + " HTML",
						name: "htmlEditor",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "fieldset",
						title: $o.getString ("Object selection"),
						name: "choose",
						width: "100%",
						collapsible: 1,
						items: [{
							xtype: "$conffield", 
							fieldLabel: $o.getString ("View"),
							labelWidth: 135,
							name: "view", 
							anchor: "100%",
							confRef: "view",
							choose: {
								type: "custom", fn: function () {
									var me = this;
									dialog.getView ({success: function (options) {
										me.setValue (options.id);
									}});
								}
							},
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}, {
							xtype: "combo",
							fieldLabel: $o.getString ("View attribute"),
							labelWidth: 135,
							name: "viewAttr",
							anchor: "100%",
							mode: "local",
							queryMode: "local",
							editable: false,
							store: me.storeViewAttrs,
							valueField: "id",
							displayField: "text",
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}, {
							fieldLabel: $o.getString ("Action before selection"),
							labelWidth: 135,
							xtype: "$conffield", 
							name: "filterAction", 
							anchor: "100%",
							confRef: "action",
							choose: {
								type: "custom", fn: function () {
									var f = this;
									dialog.getAction ({success: function (options) {
										f.setValue (options.id);
									}});
								}

							},
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}, {
							xtype: "fieldcontainer",
							layout: "hbox",
							width: "100%",
							items: [{
								xtype: "numberfield",
								fieldLabel: $o.getString ("Width"),
								width: 190,
								labelWidth: 90,
								name: "viewWidth",
								cardDesigner: me,
								listeners: {
									change: me.onChange
								}
							}, {
								xtype: "numberfield",
								fieldLabel: $o.getString ("Height"),
								width: 150,
								labelWidth: 50,
								style: "margin-left: 5px",
								name: "viewHeight",
								cardDesigner: me,
								listeners: {
									change: me.onChange
								}
							}]
						}, {
							xtype: "checkbox",
							fieldLabel: $o.getString ("Hide actions"),
							name: "hideActions",
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}]
			    	}]
			    }
			}]
		};
		me.tbar = [{
			text: $o.getString ("Add field"),
			name: "addField",
			iconCls: "gi_circle_plus",
			handler: me.addField,
			scope: me
		}, {
			text: $o.getString ("Add composite field"),
			name: "addComposite",
			iconCls: "gi_circle_plus",
			handler: me.addComposite,
			scope: me
		}, {
			text: $o.getString ("Add group"),
			name: "addGroup",
			iconCls: "gi_circle_plus",
			handler: me.addGroup,
			scope: me
		}, {
			text: $o.getString ("Remove"),
			disabled: true,
			name: "remove",
			iconCls: "gi_circle_minus",
			handler: me.remove,
			scope: me
		}];
		me.bbar = [{
			text: $o.getString ("Preview"),
			iconCls: "gi_search",
			handler: me.preview,
			scope: me
		}];
		me.on ("afterrender", function () {
			me.setClassId (me.classId);
			me.setValue (me.value);
		});
		this.callParent (arguments);
	},
	addField: function () {
		var me = this;
		var tree = me.down ("treepanel");
		var sm = tree.getSelectionModel ();
		var node;
		if (sm.hasSelection ()) {
            node = sm.getSelection ()[0];
			if (node.get ("text").substr (0, 5) == ($o.getString ("Field") + ":")) {
				node = node.parentNode;
			};
            node.set ("leaf", false);
        } else {
            node = tree.getStore ().getRootNode ();
        };
        node.expand ();
        var rec = {
        	id: me.counter ++, text: $o.getString ("Field") + ":", leaf: true
        };
        node.appendChild (rec);
	},
	addComposite: function () {
		var me = this;
		var tree = me.down ("treepanel");
		var sm = tree.getSelectionModel ();
		var node;
		if (sm.hasSelection ()) {
            node = sm.getSelection ()[0];
            node.set ("leaf", false);
        } else {
            node = tree.getStore ().getRootNode ();
        };
        node.expand ();
        var rec = {
        	id: me.counter ++, text: $o.getString ("Composite") + ":", leaf: true
        };
        node.appendChild (rec);
	},
	addGroup: function () {
		var me = this;
		var tree = me.down ("treepanel");
		var sm = tree.getSelectionModel ();
		var node;
		if (sm.hasSelection ()) {
            node = sm.getSelection ()[0];
            node.set ("leaf", false);
        } else {
            node = tree.getStore ().getRootNode ();
        };
        node.expand ();
        var rec = {
        	id: me.counter ++, text: $o.getString ("Group") + ":", leaf: true
        };
        node.appendChild (rec);
	},
	selectionChange: function () {
		var me = this;
		var tree = me.down ("treepanel");
		var sm = tree.getSelectionModel ();
       	me.down ("*[name=addField]").enable ();
    	me.down ("*[name=addComposite]").enable ();
    	me.down ("*[name=addGroup]").enable ();
		if (sm.hasSelection ()) {
			me.down ("*[name=remove]").enable ();
			me.down ("*[name=card]").show ();
            var node = sm.getSelection ()[0];
            var kind = "field";
            if (node.get ("text").substr (0, 10) == ($o.getString ("Composite") + ":")) {
            	kind = "composite";
			};            
            if (node.get ("text").substr (0, 7) == ($o.getString ("Group") + ":")) {
            	kind = "group";
            };
            if (node.get ("text").substr (0, 6) == "xtype:") {
            	kind = "xtype";
            };
            if (kind == "field") {
            	me.down ("*[name=addComposite]").disable ();
            	me.down ("*[name=addGroup]").disable ();
            };
            if (kind == "composite") {
            	me.down ("*[name=addComposite]").disable ();
            	me.down ("*[name=addGroup]").disable ();
            };
            if (kind == "field") {
	            me.down ("*[name=attr]").show ();
            };
            if (kind == "composite") {
	            me.down ("*[name=attr]").hide ();
	            me.down ("*[name=name]").show ();
	            me.down ("*[name=labelWidth]").show ();
	            me.down ("*[name=width]").show ();
	            me.down ("*[name=height]").hide ();
	            me.down ("*[name=showTime]").hide ();
	            me.down ("*[name=minValue]").hide ();
	            me.down ("*[name=maxValue]").hide ();
	            me.down ("*[name=htmlEditor]").hide ();
	            me.down ("*[name=readOnly]").hide ();
	            me.down ("*[name=choose]").hide ();
            };
            if (kind == "group") {
	            me.down ("*[name=attr]").hide ();
	            me.down ("*[name=name]").show ();
	            me.down ("*[name=labelWidth]").hide ();
	            me.down ("*[name=width]").show ();
	            me.down ("*[name=height]").show ();
	            me.down ("*[name=showTime]").hide ();
	            me.down ("*[name=minValue]").hide ();
	            me.down ("*[name=maxValue]").hide ();
	            me.down ("*[name=htmlEditor]").hide ();
	            me.down ("*[name=readOnly]").hide ();
	            me.down ("*[name=choose]").hide ();
            };
            me.updateCard (node.get ("id"), kind);
		} else {
			me.down ("*[name=remove]").disable ();
			me.down ("*[name=card]").hide ();
		};
	},
	updateCard: function (id, kind) {
		var me = this;
		me.selectedId = id;
		me.data [id] = me.data [id] || {};
		var o = me.data [id];
		if (o.attr && (!me.tag || o.tag != me.tag)) {
	        me.down ("*[name=card]").disable ();
			return;
		} else {
	        me.down ("*[name=card]").enable ();
		};
		if (kind == "xtype") {
	        me.down ("*[name=card]").disable ();
			return;
		};
        me.down ("*[name=name]").setValue (o.name);
        me.down ("*[name=width]").setValue (o.width);
        me.down ("*[name=labelWidth]").setValue (o.labelWidth);
        me.down ("*[name=height]").setValue (o.height);
		if (kind == "field") {
	        me.down ("*[name=attr]").setValue (o.attr);
	        me.down ("*[name=showTime]").setValue (o.showTime);
	        me.down ("*[name=minValue]").setValue (o.minValue);
	        me.down ("*[name=maxValue]").setValue (o.maxValue);
	        me.down ("*[name=htmlEditor]").setValue (o.htmlEditor);
	        me.down ("*[name=readOnly]").setValue (o.readOnly);
	        if (o.attr) {
	            me.down ("*[name=name]").show ();
	            me.down ("*[name=labelWidth]").show ();
	            me.down ("*[name=width]").show ();
	            me.down ("*[name=readOnly]").show ();
	        	if (me.attrs [o.attr].get ("type") >= 1000) {
		            me.down ("*[name=choose]").show ();
			        me.down ("*[name=view]").setValue (o.view ? $o.getView (o.view).get ("id") : null);
			        me.down ("*[name=viewAttr]").setValue (o.viewAttr);
			        me.down ("*[name=filterAction]").setValue (o.filterAction ? $o.getAction (o.filterAction).get ("id") : null);
			        me.down ("*[name=viewWidth]").setValue (o.viewWidth);
			        me.down ("*[name=viewHeight]").setValue (o.viewHeight);
			        me.down ("*[name=hideActions]").setValue (o.hideActions);
		       	} else {
		            me.down ("*[name=choose]").hide ();
		       	};
	            if (me.attrs [o.attr].get ("type") == 3) {
	            	me.down ("*[name=showTime]").show ();
	            	me.down ("*[name=width]").hide ();
	            } else {
	            	me.down ("*[name=showTime]").hide ();
	            	me.down ("*[name=width]").show ();
	            };
	            if (me.attrs [o.attr].get ("type") == 2) {
	            	me.down ("*[name=minValue]").show ();
	            	me.down ("*[name=maxValue]").show ();
	            } else {
	            	me.down ("*[name=minValue]").hide ();
	            	me.down ("*[name=maxValue]").hide ();
	            };
	            if (me.attrs [o.attr].get ("type") == 1) {
	            	me.down ("*[name=height]").show ();
	            	me.down ("*[name=htmlEditor]").show ();
	            } else {
	            	me.down ("*[name=height]").hide ();
	            	me.down ("*[name=htmlEditor]").hide ();
	            };
		    } else {
	            me.down ("*[name=name]").hide ();
	            me.down ("*[name=labelWidth]").hide ();
	            me.down ("*[name=width]").hide ();
	            me.down ("*[name=height]").hide ();
	            me.down ("*[name=showTime]").hide ();
            	me.down ("*[name=minValue]").hide ();
            	me.down ("*[name=maxValue]").hide ();
	            me.down ("*[name=htmlEditor]").hide ();
	            me.down ("*[name=readOnly]").hide ();
	            me.down ("*[name=choose]").hide ();
		    };
	    };
	},
	onChange: function () {
		var me = this.cardDesigner;
		var field = this;
		me.data [me.selectedId] = me.data [me.selectedId] || {};
		var o = me.data [me.selectedId];
		o.tag = me.tag;
		o.classId = me.classId;
		if (field.name == "name") {
			o.name = field.getValue ();
			var node = me.down ("treepanel").getSelectionModel ().getSelection ()[0];
			var tokens = node.get ("text").split (":");
			node.set ("text", tokens [0] + ": " + o.name);
		};
		if (field.name == "labelWidth") {
			o.labelWidth = field.getValue ();
		};
		if (field.name == "width") {
			o.width = field.getValue ();
		};
		if (field.name == "height") {
			o.height = field.getValue ();
		};
		if (field.name == "showTime") {
			o.showTime = field.getValue ();
		};
		if (field.name == "minValue") {
			o.minValue = field.getValue ();
		};
		if (field.name == "maxValue") {
			o.maxValue = field.getValue ();
		};
		if (field.name == "htmlEditor") {
			o.htmlEditor = field.getValue ();
		};
		if (field.name == "readOnly") {
			o.readOnly = field.getValue ();
		};
		if (field.name == "viewWidth") {
			o.viewWidth = field.getValue ();
		};
		if (field.name == "viewHeight") {
			o.viewHeight = field.getValue ();
		};
		if (field.name == "hideActions") {
			o.hideActions = field.getValue ();
		};
		if (field.name == "attr") {
			o.attr = field.getValue ();
			me.updateCard (me.selectedId, "field");
			var cls = $o.getClass (me.classId);
			var data = [];
			for (var i = 0; i < cls.attrsArray.length; i ++) {
				var ca = cls.attrsArray [i];
				var has = 0;
				for (var id in me.data) {
					if (me.data [id].attr == ca.get ("code") && me.data [id].tag == me.tag) {
						has = 1;
					};
				};
				if (!has) {
					data.push ([ca.get ("code"), ca.toString ()]);
				};
			};
			me.storeAttrs.loadData (data);
			if (!me.down ("*[name=name]").getValue ()) {
				me.down ("*[name=name]").setValue (o.attr ? me.attrs [o.attr].get ("name") : null);
			};
		};
		if (field.name == "view") {
			var prevView = o.view;
			o.view = field.getValue () ? $o.getView (field.getValue ()).getFullCode () : null;
			if (prevView != o.view) {
				me.down ("*[name=viewAttr]").setValue (null);
			};
			var data = [];
			if (field.getValue ()) {
				var v = $o.getView (field.getValue ());
				if (v.get ("layout")) {
					data = me.layoutCard.getViewCmpAttrs (v.get ("layout"));
				} else {
    				for (var attr in v.attrs) {
    					data.push ([attr, v.attrs [attr].toString ()]);
    				};
    			};
			};
			me.storeViewAttrs.loadData (data);
		};
		if (field.name == "viewAttr") {
			o.viewAttr = field.getValue ();
		};
		if (field.name == "filterAction") {
			o.filterAction = field.getValue () ? $o.getAction (field.getValue ()).getFullCode () : null;
		};
	},
	setClassId: function (classId, tag) {
		var me = this;
		me.classId = classId;
		me.tag = tag;
		var data = [];
		if (classId) {
			var cls = $o.getClass (classId);
			me.attrs = cls.attrs;
			for (var i = 0; i < cls.attrsArray.length; i ++) {
				var ca = cls.attrsArray [i];
				data.push ([ca.get ("code"), ca.toString ()]);
			};
		};
		me.storeAttrs.loadData (data);
		/*
		me.data = {};
		var root = me.down ("treepanel").getRootNode ();
		for (var i = root.childNodes.length - 1; i >= 0; i --) {
			root.childNodes [i].remove ();
		};
		*/
	},
	getValue: function (options) {
		options = options || {};
		var me = this;
		var items = [];
		var getNodes = function (parent, items) {
			for (var i = 0; i < parent.childNodes.length; i ++) {
				var node = parent.childNodes [i];
				var o = me.data [node.get ("id")] || {};
				var oo = {};
				if (o.width) {
					oo.width = o.width;
				} else {
					oo.anchor = "100%";
				};
				switch (node.get ("text").split (":")[0]) {
				case $o.getString ("Field"):
					if (o.attr) {
						var cls = me.getClsByTag (o.tag);
						var attrs = cls.attrs;
						var typeId = attrs [o.attr].get ("type");
						oo.fieldLabel = o.name;
						oo.attr = o.attr;
						if (options.preview) {
							oo.objectId = $o.createObject (o.classId, "local").get ("id");
						} else {
							if (me.layoutCard.value.card.object.cmpAttr) {
								var tokens = o.tag.split (".");
								oo.id = tokens [0];
								oo.attr = tokens [1] + "." + o.attr;
							} else {
								oo.objectId = o.tag;
							};
						};
						if (typeId == 1) {
							if (o.height) {
								oo.xtype = "textarea";
								oo.height = o.height;
							};
							if (o.htmlEditor) {
								oo.xtype = "htmleditor";
								oo.height = oo.height || 100;
							};
						};
						if (o.labelWidth) {
							oo.labelWidth = o.labelWidth;
						};
						oo.readOnly = o.readOnly || undefined;
						if (typeId == 3) {
							oo.timefield = o.showTime ? true : false;
							oo.width = oo.labelWidth ? (oo.labelWidth + 100) : 200;
							if (o.showTime) {
								oo.width += 100;
							};
							delete oo.anchor;
						};
						if (typeId == 2) {
							oo.minValue = o.minValue;
							oo.maxValue = o.maxValue;
							if (o.width) {
								oo.width = o.width;
							} else {
								oo.width = oo.labelWidth ? (oo.labelWidth + 100) : 200;
							};
							delete oo.anchor;
						};
						if (typeId >= 1000) {
							oo.choose = {
								type: "view", id: o.view, attr: o.viewAttr,
								width: o.viewWidth || undefined,
								height: o.viewHeight || undefined,
								hideActions: o.hideActions ? true : false
							};
							if (o.filterAction) {
								oo.listeners = oo.listeners || {};
								oo.listeners.beforechoose = o.filterAction;
							};
						};
					} else {
						oo.empty = 1;
					};
					break;
				case $o.getString ("Composite"):
					oo.fieldLabel = o.name;
					oo.xtype = "fieldcontainer";
					oo.layout = "hbox";
					if (o.labelWidth) {
						oo.labelWidth = o.labelWidth;
					};
					break;
				case $o.getString ("Group"):
					oo.title = o.name;
					oo.height = o.height ? o.height : undefined;
					oo.xtype = "fieldset";
					oo.collapsible = 1;
					break;
				case "xtype":
					oo = o.item;
					break;
				};
				if (node.childNodes.length) {
					oo.items = [];
					getNodes (node, oo.items);
					if (node.get ("text").split (":")[0] == $o.getString ("Composite")) {
						for (var j = 0; j < oo.items.length; j ++) {
							var b = oo.items [j];
							//b.hideLabel = true;
							b.style = "margin-right: 10px";
							if (b.attr && !b.fieldLabel) {
								var typeId = me.attrs [b.attr].get ("type");
								if (typeId == 2 || typeId == 3) {
									b.width = 100;
								};
								if (typeId == 3 && b.timefield) {
									b.width = 200;
								};
							};
						};
					};
				};
				if (!oo.empty) {
					items.push (oo);
				};
			};
		};
		getNodes (me.treeStore.getRootNode (), items);
		return items;
	},
	getClsByTag: function (tag) {
		var me = this;
		var oo = me.layoutCard.value.card.object;
		for (var i = 0; i < oo.length; i ++) {
			if (oo [i].tag == tag) {
				var cls = $o.getClass (oo [i].cls);
				return cls;
			};
		};
	},
	setValue: function (items) {
		var me = this;
		items = items || [];
		var root = me.down ("treepanel").getRootNode ();
		for (var i = root.childNodes.length - 1; i >= 0; i --) {
			root.childNodes [i].remove ();
		};
		function getChildren (items, node) {
			for (var i = 0; i < items.length; i ++) {
				var item = items [i];
				var id = me.counter ++;
				var o;
				if (item.xtype == "fieldcontainer") {
					o = {
				        id: id, text: $o.getString ("Composite") + ": " + (item.fieldLabel || ""), leaf: !(item.items && item.items.length)
					};
					me.data [id] = {
						name: item.fieldLabel, width: item.width, labelWidth: item.labelWidth
					};
				} else
				if (item.xtype == "fieldset") {
					o = {
				        id: id, text: $o.getString ("Group") + ": " + (item.title || ""), leaf: !(item.items && item.items.length)
					};
					me.data [id] = {
						name: item.title, width: item.width, height: item.height
					};
				} else 
				if (!item.objectId) {
					o = {
				        id: id, text: "xtype: " + (item.xtype || ""), leaf: !(item.items && item.items.length)
					};
					me.data [id] = {
						name: "xtype: " + (item.xtype || ""), item: item
					};
				} else {
					var cls = me.getClsByTag (item.objectId);
					var attrs = cls.attrs;
					var attr = attrs [item.attr] || attrs [item.attr.split (".")[1]];
			        o = {
			        	id: id, text: $o.getString ("Field") + ": " + (item.fieldLabel || attr.get ("name")), leaf: true
			        };
					me.data [id] = {
						name: item.fieldLabel, width: item.width, height: item.height, 
						showTime: item.timefield ? true : false,
						minValue: item.minValue,
						maxValue: item.maxValue,
						htmlEditor: item.xtype == "htmleditor" ? true : false,
						labelWidth: item.labelWidth,
						readOnly: item.readOnly,
						attr: attr.get ("code"),
						tag: item.objectId,
						classId: cls.get ("id")
					};
					if (item.choose) {
						me.data [id].viewWidth = item.choose.width;
						me.data [id].viewHeight = item.choose.height;
						me.data [id].view = item.choose.id;
						me.data [id].viewAttr = item.choose.attr;
						me.data [id].filterAction = item.listeners ? item.listeners.beforechoose : undefined;
						me.data [id].hideActions = item.choose.hideActions;
					};
					for (var j = 0; j < me.storeAttrs.getCount (); j ++) {
						if (me.storeAttrs.getAt (j).get ("id") == attr.get ("code")) {
							me.storeAttrs.removeAt (j);
							break;
						};
					};
				};
				if (item.items && item.items.length) {
					o.children = [];
					getChildren (item.items, o.children);
				};
				if (node == root) {
					node.appendChild (o);
				} else {
					node.push (o);
				};
			};
		};
		getChildren (items, root);
	},
	remove: function () {
		var me = this;
		var tree = me.down ("treepanel");
		var sm = tree.getSelectionModel ();
        var node = sm.getSelection ()[0];
        var parentNode = node.parentNode;
        delete me.data [node.get ("id")];
        me.down ("*[name=attr]").setValue (null);
		node.remove ();
		if (parentNode != tree.getStore ().getRootNode () && !parentNode.childNodes.length) {
			parentNode.set ("leaf", true);
		};
	},
	preview: function (classId) {
		var me = this;
		var win = Ext.create ("Ext.Window", {
			width: 800,
			height: 600,
			layout: "fit",
		    bodyPadding: 5,
			border: false,
			resizable: true,
			closable: true,
			modal: true,
			items: {
				xtype: "$layout",
				$layout: {
					card: {
						hideToolbar: 1,
						items: me.getValue ({preview: 1})
					}
				}
			}
		});
		win.show ();
	}
});

/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
*/
Ext.define ("$o.app", {
	singleton: true,
	mixins: {
		observable: "Ext.util.Observable"
	},
	// ExtJS готов к использованию
	extReady: false,
	// Конструктор
	constructor: function (config) {
		this.mixins.observable.constructor.call (this, config);
		this.addEvents (
			"extReady",
			"ready",
			"viewLayout"
		);
	},
	message: function (s, fn) {
		Ext.Msg.alert ($o.app.name || $o.app.code, s, fn);
	},
	// Логин
	login: function (options) {
		var me = this;
		var meOptions = options;
		var success = options.success;
		if ($o.authorized) {
			success.call (meOptions.scope || this, meOptions);
			return;
		};
		// esia
		if ($o.util.getCookie ("esiaUser")) {
			options.login = $o.util.getCookie ("esiaUser");
			$o.util.setCookie ("esiaUser", "", "/");
			options.hash = $o.util.getCookie ("esiaHash");
			$o.util.setCookie ("esiaHash", "", "/");
			$o.util.setCookie ("esiaAuth", "1", "/");
		}
		if (options.login && options.hash) {

			Ext.getBody ().mask ($o.getString ("Loading") + " ...");
			$o.authorize ({login: options.login, password: options.hash, success: function (options) {
				$o.init (Ext.apply (meOptions, {success: function () {
					Ext.getBody ().unmask (true);
					success.call (meOptions.scope || this, meOptions);
				}}));
			}});
			return;
		};
		var tryLogin = function () {
			var login = Ext.getCmp ("$o.app.login.field").getValue ();
			var password = Ext.getCmp ("$o.app.password.field").getValue ();
			if (!login || !password) {
				return;
			};
			loginDialog.getEl ().mask ($o.getString ("Loading"));
			var passwordHash = $o.util.sha1 (password);
			if (password == "password in cookie") {
				passwordHash = $o.util.getCookie ('password');
				password = $o.util.getCookie ('passwordPlain');
			};
			$o.authorize ({login: login, password: passwordHash, passwordPlain: password, success: function (options) {
				if (Ext.getCmp ("$o.app.remember").getValue ()) {
					$zu.setCookie ('login', login);
					$zu.setCookie ('password', passwordHash);
					$zu.setCookie ('passwordPlain', password);
				} else {
					$zu.removeCookie ('login');
					$zu.removeCookie ('password');
					$zu.removeCookie ('passwordPlain');
				};
				var success = meOptions.success;
				$o.init (Ext.apply (meOptions, {success: function () {
					loginDialog.getEl ().unmask (true);
					loginDialog.close ();
					success.call (meOptions.scope || this, meOptions);
				}}));
			}, failure: function (msg) {
				loginDialog.getEl ().unmask (true);
				$o.app.message ($o.locale.getString (msg) || $o.getString ("Authentication error"), function () {
					Ext.getCmp ("$o.app.password.field").setValue ("");
					Ext.getCmp ("$o.app.login.field").focus ();
				});
			}});
		};
		var buttons = {
			xtype: "button",
			text: $o.getString ("Enter"),
			iconCls: "gi_ok",
			width: 100,
			style: {
				marginTop: 10
			},
			handler: tryLogin
		};
		if (options.esia) {
			buttons = {
				border: false,
				layout: "hbox",
				items: [{
					xtype: "button",
					text: "Войти через ЕСИА",
					iconCls: "gi_keys",
					width: 150,
					style: {
						marginTop: 10,
						marginRight: 5
					},
					handler: function () {
						var url = window.location.protocol + "//" + window.location.hostname;
						if (window.location.port) {
							url += ":" + window.location.port;
						}
						url += "/projects/" + options.code + "/plugins/?fn=service.esia";
						var form = Ext.create ("Ext.form.Panel", {
							standardSubmit: true,
							url: options.esia
						});
						form.submit ({
							params: {
								ReturnUrl: url
							}
						});
					}
				},
					buttons
				]
			}
		}
		var loginDialog = Ext.create ("Ext.Window", {
			title: me.name || $o.getString ("Authorization"),
			iconCls: "gi_keys",
			width: 300,
			height: 200,
			layout: "vbox",
		    bodyPadding: 5,
		    closable: false,
			monitorValid: true,
//			tbar: [{
//				xtype: "tbtext",
//				text: "<b>" + ($o.app.name || $o.app.code) + " " + ($o.app.version || "")
//			}],
			defaults: {
				listeners: {
					specialkey: function (object, event) {
						if (event.getKey () == event.ENTER) {
							tryLogin ();
						};
					}
				}
			},
			items: [{
				xtype: "textfield",
//				fieldLabel: "Логин",
				emptyText: $o.getString ("Login"),
				id: "$o.app.login.field",
				allowBlank: false,
				msgTarget: "side",
				width: 270,
				style: {
					marginTop: 10
				}
			}, {
				xtype: "textfield",
//				fieldLabel: "Пароль",
				emptyText: $o.getString ("Password"),
				id: "$o.app.password.field",
				inputType: "password",
				allowBlank: false,
				msgTarget: "side",
				width: 270,
				style: {
					marginTop: 10
				}
			}, {
				xtype: "checkbox",
				boxLabel: $o.getString ("Remember"),
				id: "$o.app.remember",
				width: 270,
				style: {
					marginTop: 10
				}
			},
				buttons
			]
			/*,
			buttons: [{
				text: "Вход",
				iconCls: "gi_ok",
				formBind: true,
				handler: tryLogin
			}]*/
		});
		loginDialog.show (null, function () {
			Ext.getCmp ("$o.app.login.field").focus ();
			if ($o.util.getCookie ("login")) {
				Ext.getCmp ("$o.app.remember").setValue (1);
				Ext.getCmp ("$o.app.login.field").setValue ($o.util.getCookie ('login'));
				Ext.getCmp ("$o.app.password.field").setValue ("password in cookie");
			}
		});
	},
	/*
		TreeStore
	*/
	initTreeStore: function (options) {
		var model = Ext.ModelManager.getModel (options.model);
		var fields = model.getFields ();
		var map = options.map;
		var getNode = function (options) {
			for (var i = 0; i < fields.length; i ++) {
				var f = fields [i];
				options.r [f.name] = options.c.get (f.name);
			};
			if (options.c.childs.length) {
				options.r.children = [];
				for (var i = 0; i < options.c.childs.length; i ++) {
					var r = {};
					getNode ({c: map [options.c.childs [i]], r: r});
					options.r.children.push (r);
				};
			} else {
				options.r.leaf = true;
			};
		};
		var data = [];
		for (var i = 0; i < $o.store [options.data].getCount (); i ++) {
			var c = $o.store [options.data].getAt (i);
			if (c.get ("parent")) {
				continue;
			};
			var r = {};
			getNode ({c: c, r: r});
			data.push (r);
		};
		this.treeStore [options.data] = Ext.create ("Ext.data.TreeStore", {
			model: options.model,
			autoLoad: true,
			root: {
				text: ".",
				children: data
			},
			proxy: {
				type: "memory",
				reader: {
					type: "json"
				}
			}			
		});
	},
	tabChangeListener: function (tp) {
		var tab = tp.getActiveTab ();
		if (!tab) {
			return;
		};
		// hash
		if (tab.id) {
			document.location.href = '#' + tab.id;
		};
		// title
		var n = tab.title;
		if (tab.id) {
			if (tab.id [0] == 'o') {
				var o = $zs.getObject (tab.id.substr (1));
				n = o.get ('name');
			} else
			if (tab.id [0] == 'v') {
				var v = $zs.viewsMap [tab.id.substr (1)];
				try {
					n = v.stub.get ('name');
				} catch (e) {
					n = v.get ('name');
				};
			};
		};
		document.title = n + ' - ' + $ptitle;
	},
	/*
		Создает рабочий стол
	*/
	createDesktop: function (options) {
		var me = this;
		var cleanViewport = options.cleanViewport;
		$o.app.tp = Ext.create ("Ext.tab.Panel", {
		    region: "center",
		    layout: "fit",
			listeners: {
				tabchange: {
					fn: me.tabChangeListener,
					scope: me
				}
			}
		});
		$o.app.lb = Ext.create ("Ext.Toolbar", {
			region: "west",
			dock: "left",
			autoScroll: true,
			items: []
		});
		$o.app.rb = Ext.create ("Ext.Toolbar", {
			region: "east",
			dock: "right",
			items: []
		});
		$o.app.tb = Ext.create ("Ext.Toolbar", {
			region: "north",
			items: []
		});
		$o.app.bb = Ext.create ("Ext.Toolbar", {
			region: "south",
			items: []
		});
		var items = [];
		if ($o.currentUser == "admin") {
			var itemsVisual = [{
				xtype: "label",
				text: "Visual Objectum",
				style: "font-weight: bold; color: #073255; margin-left: 5px; margin-right: 15px; text-shadow: -1px -1px 1px white, 1px -1px 1px white, -1px 1px 1px white, 1px 1px 1px white;"
				/*
			}, {
				xtype: "label",
				text: "beta",
				style: "color: #CC0000; font-weight: bold; margin-left: 2px; margin-right: 10px;"
				*/
			}, {
				text: $o.getString ("Classes"),
				iconCls: "gi_cogwheels",
				handler: function () {
					$o.app.show ({items: {
						id: "conf_classes",
						xtype: "$o.classes",
						title: $o.getString ("Classes"),
					   	iconCls: "gi_cogwheels",
						name: "classes"
					}});
				}
			}, {
		    	text: $o.getString ("Views"),
		    	iconCls: "gi_eye_open",
				handler: function () {
					$o.app.show ({items: {
						id: "conf_views",
						xtype: "$o.views",
						title: $o.getString ("Views"),
						iconCls: "gi_eye_open",
				    	name: "views"
					}});
				}
			}];
			if ($o.visualObjectum && $o.visualObjectum.menuConstructor) {
				itemsVisual.push ({
			    	text: $o.getString ("Menu"),
			    	iconCls: "gi_list",
					handler: function () {
						$o.app.show.call ($o.app, {
							record: $o.getView ("system.vo.menu")
						});
					}
				});
			};
			if ($o.visualObjectum && $o.visualObjectum.accessConstructor) {
				itemsVisual.push ({
			    	text: $o.getString ("Access"),
			    	iconCls: "gi_keys",
					handler: function () {
						$o.app.show.call ($o.app, {
							record: $o.getView ("system.vo.access")
						});
					}
				});
			};
			/*
			if ($o.visualObjectum && $o.visualObjectum.reportConstructor) {
				itemsVisual.push ({
			    	text: "Отчеты",
			    	iconCls: "gi_print",
					handler: function () {
						$o.app.show.call ($o.app, {
							record: $o.getView ("system.vo.reports")
						});
					}
				});
			};
			*/
			if ($o.visualObjectum && $o.visualObjectum.projectConstructor) {
				itemsVisual.push ({
			    	text: $o.getString ("Project"),
			    	iconCls: "gi_briefcase",
			    	name: "project",
					handler: function () {
						$o.app.show ({items: {
							id: "conf_project",
							xtype: "$projectdesigner",
					    	title: $o.getString ("Project"),
					    	name: "project",
					    	iconCls: "gi_briefcase"
						}});
					}
				});
			};
			itemsVisual.push ("->");
			itemsVisual.push ({
		    	text: $o.getString ("Exit"),
		    	iconCls: "gi_exit",
				handler: function () {
					$o.logout ({success: function () {
						location.reload ();
					}});
				}
			});
			$o.app.cb = Ext.create ("Ext.Toolbar", {
				region: "north",
				border: false,
				style: "background-color: #b8d7f1; padding: 5px; margin-bottom: 3px;",
				items: itemsVisual
			});
			items.push ($o.app.cb);
		};
		// title or logo
		if ($o.visualObjectum && $o.visualObjectum.menuConstructor) {
			if ($o.visualObjectum.logo.left && $o.visualObjectum.logo.height) {
				var w = window,
				    d = document,
				    e = d.documentElement,
				    g = d.getElementsByTagName('body')[0],
				    x = w.innerWidth || e.clientWidth || g.clientWidth,
				    y = w.innerHeight|| e.clientHeight|| g.clientHeight
				;
				items = [new Ext.Panel ({
					region: "north",
					border: false,
					width: x,
					height: $o.visualObjectum.logo.height,
					xtype: "panel",
					bodyStyle: "background-color: #ffffff; padding: 0px !important; border-bottom: 1px solid #428bca !important;",
					html: 
						"<div style='width: 100%; height: " + $o.visualObjectum.logo.height + ";'>" +
						"<img src='" + $o.visualObjectum.logo.left + "'>" +
						($o.visualObjectum.logo.right ? ("<img src='" + $o.visualObjectum.logo.right + "' align=right>") : "") +
						"</div>"
				})].concat (items);
			} else {
				items.push (Ext.create ("Ext.Toolbar", {
					region: "north",
					border: false,
					style: "background-color: #fff; padding: 5px; margin-bottom: 3px;",
					items: [{
						xtype: "label",
						text: $ptitle,
						style: "font-weight: bold; font-size: 15pt; font-style: italic; color: #b8d7f1; margin-left: 5px; margin-right: 15px; text-shadow: -1px -1px 1px #073255, 1px -1px 1px #073255, -1px 1px 1px #073255, 1px 1px 1px #073255;"
					}]
				}));
			};
		};
		items = items.concat (
			$o.app.lb, $o.app.rb, $o.app.tb, $o.app.bb
		);
		if (!cleanViewport) {
			items.push ($o.app.tp);
		} else {
			$o.app.tb.hide ();
			$o.app.lb.hide ();
			$o.app.rb.hide ();
		};
		if ($o.app.vp) {
			$o.app.vp.destroy ();
		};
		$o.app.vp = Ext.create ("Ext.container.Viewport", {
			layout: "border",
			border: false,
			defaults: {
				border: false
			},
			items: items
		});
	},
	/*
		Показывает представление (view, editView, class, items)
	*/
	show: function (options) {
		var me = this;
		var items = options.items;
		var record = options.record;
		var readOnly = options.readOnly;
		var tabId;
		if (record) {
			var className = Ext.getClassName (record);
			if (className == "$o.View.Model") {
				if (!record.get ("query") && !record.get ("layout")) {
					return;
				};
				tabId = "v" + record.get ("id");
				if (record.get ("layout")) {
					items = {
						xtype: "$o.layout",
						record: record,
						$layout: readOnly ? common.makeReadOnlyLayout (record.get ("layout")) : record.get ("layout")
					};
				};
				if (!record.get ("layout") && record.get ("query")) {
					items = {
						xtype: "$o.layout",
						$layout: {
							olap: {
								id: "olap",
								view: record.getFullCode ()
							}
						}
					};
				};
			};
		} else {
			items.closable = true;
			tabId = items.id;
		};
		if (!items) {
			return;
		};
		var center = $o.app.vp.down ("*[region='center']");
		if (Ext.getClassName (center) == "Ext.tab.Panel") {
			var tab = me.tp.down ("#" + tabId);
			if (!tab) {
				if (record) {
					tab = me.tp.add ({
						id: tabId,
						title: record.get ("name"),
						iconCls: record.get ("iconCls"),
						closable: true,
						layout: "fit",
						border: false,
						isTab: 1,
						items: items
					});
				} else {
					items.isTab = 1;
					tab = me.tp.add (items);
				};
			};
			me.tp.doLayout ();
			me.tp.setActiveTab (tabId);
		} else {
			$o.app.vp.remove (center);
			items.region = "center";
			$o.app.vp.add (items);
		};
	},
	/*
		Перехватчик Ajax запросов
	*/
	beforerequest: function (conn, options, eOpts) {
		var me = this;
		var url = options.url;
		var olapRequest = function () {
			var start = options.params.page > 1 ? (options.params.page - 1) * options.params.limit : 0;
			var limit = options.params.limit;
			var tokens = url.substr (12, url.length - 12).split ("&");
			var id = tokens [0].split ("=")[1];
			var cmpId = tokens [1].split ("=")[1];
			options.url = "?sessionId=" + $sessionId;
			options.method = "POST";
			var order = null;
			if (options.params.sort) {
				var sort = eval ("(" + options.params.sort + ")");
				order = [sort [0].property, sort [0].direction];
			};
			var filter = [];
			var grid = Ext.getCmp (cmpId);
			if (grid) {
				var gridFilter = grid.getFilter ();
				if (gridFilter && gridFilter.length) {
					filter = [gridFilter];
				};
			} else {
				grid = {};
			};
			if (options.params.filter) {
				var fs = eval ("(" + options.params.filter + ")");
				var va = $o.viewsMap [id].attrs;
				for (var i = 0; i < fs.length; i ++) {
					var f = fs [i];
					if (typeof (f.value) == "object" && f.value.isNotNull) {
						if (filter.length) {
							filter.push ("and");
						};
						filter.push (f.field);
						filter.push ("is not null");
						continue;
					} else
					if (typeof (f.value) == "object" && f.value.isNull) {
						if (filter.length) {
							filter.push ("and");
						};
						filter.push (f.field);
						filter.push ("is null");
						continue;
					};
					var dataType;
					if (!va [f.field].get ("classAttr")) {
						dataType = "number";
					} else {
						dataType = $o.classAttrsMap [va [f.field].get ("classAttr")].getDataType ();
					}
					if (dataType == "string") {
						var has = 0;
						for (var j = 1; j < filter.length; j ++) {
							if (filter [j] == "like" && filter [j - 1] == f.field && filter [j + 1] == (f.value + "%")) {
								has = 1;
								break;
							};
						};
						if (has) {
							continue;
						};
					};
					if (dataType == "bool") {
						f.value = f.value ? 1 : 0;
						var has = 0;
						for (var j = 1; j < filter.length; j ++) {
							if (filter [j] == "=" && filter [j - 1] == f.field && filter [j + 1] == f.value) {
								has = 1;
								break;
							};
						};
						if (has) {
							continue;
						};
					};
					if (filter.length) {
						filter.push ("and");
					};
					if (dataType == "bool") {
						if (f.value) {
							filter.push ([f.field, "=", 1]);
						} else {
							filter.push ([f.field, "=", 0, "or", f.field, "is null"]);
						}
					} else
					if (dataType == "date" && f.comparison == "eq") {
						if (_.isArray (filter [0])) {
							var n = filter [0].indexOf (f.field);
							if (n > -1) {
								if (filter [0].length == 4) {
									filter.splice (0, 2);
								} else 
								if (n == 0) {
									filter [0].splice (0, 4);
								} else {
									filter [0].splice (n - 1, 4);
								}
							}
						}
						filter = filter.concat (f.field, ">=", f.value + " 00:00:00", "and", f.field, "<=", f.value + " 23:59:59");
					} else {
						filter.push (f.field);
						if (f.comparison) {
							if (f.comparison == "lt") {
								filter.push ("<");
							};
							if (f.comparison == "gt") {
								filter.push (">");
							};
							if (f.comparison == "eq") {
								filter.push ("=");
							};
							if (f.comparison == "lte") {
								filter.push ("<=");
							};
							if (f.comparison == "gte") {
								filter.push (">=");
							};
							if (f.comparison == "neq") {
								filter.push ("<>");
							};
						} else {
							if (dataType == "string") {
								var v = f.value;
								if (typeof (v) == "object") {
									if (v.value.indexOf (",") > -1) {
										if (v.notLike) {
											filter.push ("not in");
										} else {
											filter.push ("in");
										}
										f.value = v.value.split (",").join (".,.").split (".");
									} else {
										if (v.notLike) {
											filter.push ("not like");
										} else {
											filter.push ("like");
										}
										f.value = v.value + "%";
									}
								} else {
									filter.push ("like");
									f.value = f.value + "%";
								}
							} else {
								filter.push ("=");
							};
						};
						//if (dataType == "date") {
							//f.value = f.value.substr (3, 2) + "." + f.value.substr (0, 2) + "." + f.value.substr (6, 4);
							// гдето прописано: Ext.ux.grid.filter.DateFilter.prototype.dateFormat = "d.m.Y";
						//};
						filter.push (f.value);
					};
				};
			};
			if (filter && filter.length == 1) {
				filter = filter [0];
			};
			options.params = $o.code + ".View.getContent(" + id + ", 0," + start + ", 50, " + limit + ", null, [!{" +
				"\"filter\":" + JSON.stringify (filter) + "," +
				"\"order\":" + JSON.stringify (order) + "," +
				"\"total\":" + JSON.stringify (grid.total || null) + "," +
				"\"dateAttrs\":" + JSON.stringify (grid.dateAttrs || null) + "," +
				"\"timeOffsetMin\":" + (new Date ()).getTimezoneOffset () +
			"}!])";
			options.intercepted = "getContent";
			options.viewId = id;
			options.cmpId = cmpId;
			options.start = start;
		};
		var treegridRequest = function () {
			var node = options.params.node == "root" ? null : options.params.node;
			var tokens = url.substr (16, url.length - 16).split ("&");
			var id = tokens [0].split ("=")[1];
			var view = $o.viewsMap [id];
			var cmpId = tokens [1].split ("=")[1];
			var treegrid = Ext.getCmp (cmpId);
			var fieldParent = tokens [2].split ("=")[1];
			var fieldId = tokens [3].split ("=")[1];
			options.url = "?sessionId=" + $sessionId;
			options.method = "POST";
			var query = eval ("(" + view.get ("query") + ")");
			var alias, table; for (alias in query.from [0]) {table = query.from [0][alias]; break;};
			var fieldParentPair = {}, attrParent;
			for (var i = 1; i < query.select.length; i += 2) {
				if (query.select [i] == fieldParent) {
					fieldParentPair = $o.util.clone (query.select [i - 1]);
					for (var key in fieldParentPair) {attrParent = fieldParentPair [key];}
				};
			};
			var fieldIdPair = {}, attrId;
			for (var i = 1; i < query.select.length; i += 2) {
				if (query.select [i] == fieldId) {
					fieldIdPair = $o.util.clone (query.select [i - 1]);
					for (var key in fieldIdPair) {attrId = fieldIdPair [key];}
				};
			};
			var filter = [fieldParentPair, "is null"];
			if (node) {
				filter = [fieldParentPair, "=", node];
			};
			var where = query.where || [];
			if (where.length) {
				where.push ("and");
			};
			where = where.concat (filter);
			query.select = query.select.concat ([
				{"___childs": attrId}, "___childId",
				fieldParentPair, "___parentId"
			]);
			var field2 = {}; field2 [alias] = attrId;
			query.from = query.from.concat (["left-join", {"___childs": table}, "on", [{"___childs": attrParent}, "=", field2]]);
			if (treegrid.filter && treegrid.filter.childsFn) {
				var cf = treegrid.filter.childsFn ();
				if (cf && cf.length) {
					query.from [query.from.length - 1] = query.from [query.from.length - 1].concat ("and", cf);
				};
			};
			var convertFilter = function (query, filter) {
				var fields = {};
				for (var i = 0; i < query.select.length; i += 2) {
					fields [query.select [i + 1]] = query.select [i];
				};
				var r = [];
				for (var i = 0; i < filter.length; i ++) {
					if (Ext.isArray (filter [i])) {
						r.push (convertFilter (query, filter [i]));
					} else {
						if (fields [filter [i]]) {
							r.push ($o.util.clone (fields [filter [i]]));
						} else {
							r.push (filter [i]);
						};
					};
				};
				return r;
			};
			if (treegrid.filter) {
				if (!node || (node && treegrid.filter.all)) {
					var treeFilter = treegrid.getFilter ();
					var filter = convertFilter (query, treeFilter);
					if (filter && filter.length) {
						where = where.concat ("and", filter);
					};
				};
			};
			if (!node && treegrid.$opened.length) {
				var openedFilter = [fieldParentPair, "in", treegrid.$opened.join (".,.").split (".")];
				if (treegrid.filter && treegrid.filter.all) {
					var treeFilter = treegrid.getFilter ();
					var filter = convertFilter (query, treeFilter);
					if (filter && filter.length) {
						openedFilter = openedFilter.concat ("and", filter);
					};
				};
				where.push ("or");
				where.push (openedFilter);
			};
			query.where = where;
			options.params = $o.code + ".Storage.execute([!" + JSON.stringify (query) + "!])",
			options.intercepted = "treegrid";
			options.viewId = id;
			options.query = query;
			options.fieldId = fieldId;
			options.node = node;
			options.cmpId = cmpId;
		};
		if (url.substr (0, 11) == "view?read=1") {
			olapRequest ();
		};
		if (url.substr (0, 15) == "treegrid?read=1") {
			treegridRequest ();
		};
	},
	/*
		Перехватчик Ajax запросов (ответ)
	*/
	requestcomplete: function (conn, response, options, eOpts) {
		var r;
		try {
			r = eval ("(" + response.responseText + ")");
		} catch (e) {
		};
		if (r && r.header && r.header.error) {
			var msg = r.header.error;
			//common.message ("<font color=red>" + $o.locale.translate (msg) + "</font><br>" + JSON.stringify (options));
			var win = Ext.create ("Ext.window.Window", {
				title: $ptitle,
				resizable: false,
				closable: true,
				width: 600,
				height: 400,
				layout: "fit",
				modal: true,
				items: [{
					xtype: "panel",
					border: false,
					style: "padding: 5",
					html: "<font color=red>" + $o.locale.translate (msg) + "</font>"
				}],
				buttons: [{
					text: $o.getString ("More"),
					iconCls: "gi_circle_question_mark",
					handler: function () {
						win.removeAll ();
						win.add ({
							xtype: "panel",
							border: false,
							style: "padding: 5",
							html: "<font color=red>" + $o.locale.translate (msg) + "</font><br>" + JSON.stringify (options)
						});
					}
				}, {
					text: "Ok",
					name: "ok",
					iconCls: "gi_ok",
					handler: function () {
						win.close ();
					}
				}]
			});
			win.show (null, function () {
				win.down ("*[name='ok']").focus ();
			});
			throw r.header.error + " options: " + JSON.stringify (options);
		};
		var olapResponse = function () {
			var model = Ext.ModelManager.getModel ("$o.View." + options.viewId + ".Model");
			// fields
			var mFields = model.getFields ();
			var rt = eval ("(" + response.responseText + ")");
			var vFields = [];
			var fieldsMap = {};
			var grid = Ext.getCmp (options.cmpId);
			for (var i in rt.data.column) {
				var attr = rt.data.column [i][0].attr;
				vFields.push (attr);
				for (var j = 0; j < mFields.length; j ++) {
					if (mFields [j].name == attr) {
						fieldsMap [i] = mFields [j].name;
						break;
					};
				};
				delete grid.totalValues [attr];
				if (rt.data.column [i][0].total) {
					grid.totalValues [attr] = rt.data.column [i][0].total;
				};
			};
			// data
			var data = [];
			for (var i = 0; i < rt.data.tree.currentLength; i ++) {
				var row = rt.data.tree [options.start + i].data;
				var rec = {};
				for (var j = 0; j < vFields.length; j ++) {
					rec [fieldsMap [j]] = row [j].text;
				};
				data.push (rec);
			};
			grid.countOverflow = rt.data.tree.overflow;
			var r = {
				success: true,
				total: rt.data.tree.length,
				data: data
			};
			response.responseText = JSON.stringify (r);
		};
		var treegridResponse = function () {
			var node = options.node || null;
			var model = Ext.ModelManager.getModel ("$o.View." + options.viewId + ".Model");
			var view = $o.viewsMap [options.viewId];
			var treegrid = Ext.getCmp (options.cmpId);
			var mFields = view.orderedFields;
			var rt = eval ("(" + response.responseText + ")");
			var fieldsMap = {};
			var query = options.query;
			for (var i = 0; i < query.select.length; i += 2) {
				var attr; for (var alias in query.select [i]) {attr = query.select [i + 1]; break;};
				for (var j = 0; j < mFields.length; j ++) {
					if (mFields [j].name == attr) {
						fieldsMap [i / 2] = mFields [j].name;
						break;
					};
				};
			};
			var /*prevId, */levels = {}, hasId = [];
			for (var i = 0; i < rt.data.length; i ++) {
				var row = rt.data [i];
				var rec = {};
				var j;
				for (j = 0; j < mFields.length; j ++) {
					rec [fieldsMap [j]] = row [j];
				};
				var childId = row [j];
				var parentId = row [j + 1];
//				if (prevId != rec [options.fieldId]) {
				if (hasId.indexOf (rec [options.fieldId]) == -1) {
					if (!childId) {
						rec.leaf = true;
					};
					if (treegrid && treegrid.showChecks) {
						rec.checked = false;
					};
					levels [parentId] = levels [parentId] || [];
					levels [parentId].push (rec);
					//prevId = rec [options.fieldId];
					hasId.push (rec [options.fieldId]);
				};
			};
			if (!node && levels [null] && levels [null].length) {
				var addChildren = function (rec) {
					var nodes = levels [rec [options.fieldId]];
					if (nodes) {
						var childs = [];
						for (var i = 0; i < nodes.length; i ++) {
							childs.push (nodes [i]);
							addChildren (nodes [i]);
						};
						rec.children = childs;
						rec.expanded = true;
					};
				};
				for (var i = 0; i < levels [null].length; i ++) {
					addChildren (levels [null][i]);
				};
			};
			var data = levels [node];
			var r = {
			    text: ".",
			    children: data
			};
			response.responseText = JSON.stringify (r);
		};
		if (options.intercepted == "getContent") {
			olapResponse ();
		};
		if (options.intercepted == "treegrid") {
			treegridResponse ();
		};
	},
	/*
		Перехватчик Ajax запросов (exception)
	*/
	requestexception: function (conn, response, options, eOpts) {
		if ($o.idleTimer > $o.maxIdleSec) {
			return;
		};
		var err = response.responseText == "<html><head><title>Unauthenticated</title></head><body><h1>401 Unauthenticated</h1></body></html>" ? $o.getString ("Session not authorized. Please, reload browser page") : response.responseText;
		if (!err) {
			err = $o.getString ("Could not connect to server") + "<br>status: " + response.status + " " + response.statusText;
		};
		common.message ("<font color=red>" + err + "</font><br>url: " + options.url + "<br>params: " + options.params);
	},
	/*
		Старт приложения
	*/
	start: function (options) {
		var me = this;
		var meOptions = options;
		me.code = options.code;
		me.name = options.name;
		me.version = options.version;
		me.locale = options.locale;
		var success = options.success;
		var scope = options.scope;
		$ptitle = options.name;
		$pversion = options.version;
		var useHash = options.useHash;
		var go = function () {
			if (meOptions.locale != "en") {
	    		$o.locale.load ("/client/extjs4/locale/" + meOptions.locale + ".json");
	    	};
	    	$o.executeQueueFunctions ();
			Ext.Ajax.on ("beforerequest", $o.app.beforerequest, $o.app);
			Ext.Ajax.on ("requestcomplete", $o.app.requestcomplete, $o.app);
			Ext.Ajax.on ("requestexception", $o.app.requestexception, $o.app);
	    	me.login (Ext.apply (meOptions, {scope: me, success: function (options) {
				me.treeStore = {};
		    	me.initTreeStore ({
		    		model: "$o.Class.Model",
		    		data: "classes",
		    		map: $o.classesMap
		    	});
		    	me.initTreeStore ({
		    		model: "$o.View.Model",
		    		data: "views",
		    		map: $o.viewsMap
		    	});
	    		me.createDesktop (options);
	    		$o.initAdapter ();
	    		if ($o.visualObjectum) {
		    		if ($o.currentUser == "admin") {
						var projectNeedBuild = common.getConf ("projectNeedBuild");
						if (projectNeedBuild.used && $o.app.vp.down ("*[name=project]")) {
							me.projectNeedBuildTooltip = Ext.create ("Ext.tip.ToolTip", {
							    title: $o.getString ("Need assembly"),
							    target: $o.app.vp.down ("*[name=project]").id,
							    anchor: 'top',
							    html: $o.getString ("To update actions"),
							    width: 200,
							    autoHide: true,
							    autoShow: true,
							    closable: true
							});
						};
					};
					var href = document.location.href;
					if (href.indexOf ("#") > -1 && !useHash) {
						var tokens = href.split ("#");
						document.location.href = tokens [0] + "#";
					};
		    		if ($o.visualObjectum.menuConstructor) {
						system.init ();
						system.vo.buildMenu ();
			    		if ($o.visualObjectum.initAction) {
			    			var fn_ = eval ("(" + $o.visualObjectum.initAction + ")");
			    			fn_ ();
			    		};
					};
				};
				$o.app.fireEvent ("ready");
				if (success) {
	    			success.call (scope || me, options);
	    		};
	    	}}));
		};
		if ($o.app.extReady) {
			go.call (me);
		} else {
			$o.app.on ("extReady", go, me);
		};
	},
	loginDialog: function (options) {
		$o.app.vp.destroy ();
		for (var id in $o.viewsMap) {
			var c = Ext.getCmp ("v" + id);
			if (c) {
				c.destroy ();
			};
		};
		var me = this;
		options = options || {};
		$o.app.start ({
			code: me.code || options.code, 
			name: me.name || options.name, 
			version: me.version || options.version, 
			locale: me.locale || options.locale,
			success: options.success
		});
	},
	sendMail: function (options) {
		options = options || {};
		if (!options.to || !options.subject || !options.message) {
			return;
		};
		Ext.Ajax.request ({
			url: "sendmail?sessionId=" + $sessionId,
			method: "post",
			params: {
				to: options.to,
				from: options.from,
				subject: options.subject,
				message: options.message,
				attachments: JSON.stringify (options.attachments)
			}
		});
	},
	loadScript: function (src, cb) {
	    var script = document.createElement ("script");
		var appendTo = document.getElementsByTagName ("head")[0];
	    if (script.readyState && !script.onload) {
	        // IE, Opera
	        script.onreadystatechange = function () {
	            if (script.readyState == "loaded" || script.readyState == "complete") {
	                script.onreadystatechange = null;
	                cb ();
	            }
	        }
	    } else {
	        // Rest
	        script.onload = cb;
	    };
	    script.src = src;
	    appendTo.appendChild (script);
	}
});
/*
	launch
*/
Ext.onReady (function () {
//	if (document.location.href [document.location.href.length - 1] != "/" && document.location.href.indexOf ("#") == -1) {
//		document.location.href = document.location.href + "/";
//	};
	Ext.QuickTips.init ();
	$o.app.extReady = true;
	Ext.Ajax.disableCaching = false;
	Ext.Ajax.timeout = 120000;
	$o.app.fireEvent ("extReady");
});

/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/
Ext.define ("$o.app.view", {
	singleton: true,
	getItems: function (record) {
		var me = this;
		var items = {
			id: "e" + record.get ("id"),
			xtype: "tabpanel",
			title: record.get ("name") || record.get ("code"),
			iconCls: "gi_eye_open",
			layout: "fit",
			defaults: {
				bodyPadding: 5
			},
			items: [{
				title: $o.getString ("Commons"),
				layout: "form",
				tbar: [{
					text: $o.getString ("Save"),
					iconCls: "gi_floppy_save",
					handler: me.saveCommon
				}],
				items: [{
					xtype: "textfield",
					fieldLabel: "ID",
					value: record.get ("id"),
					readOnly: true
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Name"),
					value: record.get ("name")
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Code"),
					value: record.get ("code")
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Parent"),
					value: record.get ("parent") ? $o.getView (record.get ("parent")).toString () : ""
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Icon"),
					value: record.get ("iconCls")
				}, {
					xtype: "textarea",
					fieldLabel: $o.getString ("Description"),
					value: record.get ("description")
				}]
			}]
		};
		return items;
	},
	saveCommon: function () {
		var me = this;
		console.log (me);
	}
});

/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

$zs = $o;
$s = $o;
$zp = {
	application: $o.app
};
Ext.Component.AUTO_ID = 1000000;
objectum = {
	ui: {}
};
$o.initAdapter = function () {
	$zp.application.toolbar = $o.app.tb;
	$zp.application.mainPanel = $o.app.tp;
	$zs.views = $o.viewsTree;
	$zs.views.get = function (code) {
		var r = $o.getView ({code: code});
		return r;
	};
	objectum.ui.layout = {};
	objectum.ui.layout.ViewLayout = $o.Layout.Widget;
	$zs.classes = $o.classesTree;
	$zs.viewAttrs = $o.viewAttrsMap;
	$zp.currentUser = $o.currentUser;
	$zp.application.onClickMenuItem = function (item) {
		var record = $o.viewsMap [item.record.stub.get ("id")];
		$o.app.show ({record: record});
	};
	$VERSION_MAJOR = $o.serverVersion;
	$o.app.on ("ready", function () {
		if ($zp.onLogin) {
			$zp.onLogin ();
		};
	});
	$zs.id = $o.code;
	objectum.ui.ObjectField = $o.ObjectField.Widget;
	$zr = $o.locale;
};
Ext.override (Ext.Component, {
	initComponent: function () {
		var me = this;
		if (me.code) {
			me.iconCls = me.iconCls ? me.iconCls : me.code;
			me.text = me.text ? $o.locale.getString (me.text) : $o.locale.getString (me.code);
		};
		if (typeof (me.handler) == "string") {
			me.handler = eval (me.handler);
		};
		if (me.listeners) {
			for (var event in me.listeners) {
				var ef = me.listeners [event];
				if (typeof (ef) == "string") {
					try {
						me.listeners [event] = eval (ef);
					} catch (e) {
						me.listeners [event] = function () {
							console.log ("unknown function: " + ef);
						};
					};
				} else
				if (ef && ef.fn && typeof (ef.fn) == "string") {
					try {
						me.listeners [event].fn = eval (ef.fn);
					} catch (e) {
						me.listeners [event].fn = function () {
							console.log ("unknown function: " + ef.fn);
						};
					};
				};
			};
		};
		me.callOverridden ();
	}
});
Ext.override (Ext.Panel, {
	initComponent: function () {
		if (this.code) {
			this.iconCls = this.iconCls ? this.iconCls : this.code;
			this.title = this.title ? $o.locale.getString (this.title) : $o.locale.getString (this.code);
		};
		this.callOverridden ();
	}
});
Ext.override (Ext.form.field.Date, {
	initComponent: function () {
		this.format = "d.m.Y";
		this.callOverridden ();
	}
});
Ext.override (Ext.form.field.Time, {
	initComponent: function () {
		this.format = "H:i:s";
		this.callOverridden ();
	}
});
Ext.override (Ext.form.field.Checkbox, {
	initComponent: function () {
		this.addEvents ("check");
		this.on ("change", function (cb, nv, ov) {
			this.fireEvent ("check", cb, nv, ov);
		}, this);
		this.callOverridden ();
	}
});
Ext.override (Ext.toolbar.Toolbar, {
	initComponent: function () {
		if (!this.hasOwnProperty ("border")) {
			this.border = false;
		};
		this.callOverridden ();
	}
});
Ext.override (Ext.form.field.Base, {
	initComponent: function () {
		if (this.readOnly && !this.objectField && Ext.getClassName (this) != "Ext.form.field.File" && this.xtype != "displayfield") {
			this.addCls ("readonly-field");
		};
		if (this.hasOwnProperty ("allowBlank") && !this.allowBlank && this.fieldLabel) {
			this.fieldLabel = this.fieldLabel + "<span style='color: red !important'>*</span>";
		};
		this.callOverridden ();
	},
	setReadOnly: function (ro) {
		if (!this.objectField && Ext.getClassName (this) != "Ext.form.field.File" && this.xtype != "displayfield") {
			if (this.readOnly) {
				this.addCls ("readonly-field");
			} else {
				this.removeCls ("readonly-field");
			};
		};
		this.callOverridden ();
	}
});
Ext.define ("Ext.fix.util.AbstractMixedCollection", {
    override: "Ext.util.AbstractMixedCollection",
    itemAt: function (n) {
    	return this.getAt (n);
    }
});
Date.prototype.toStringOriginal = Date.prototype.toString;
Date.prototype.toString = function (format) {
	var dd = this.getDate ();
	var mm = this.getMonth () + 1;
	var yyyy = this.getFullYear ();
	var h = this.getHours ();
	var m = this.getMinutes ();
	var s = this.getSeconds ();
	if (dd < 10) {
		dd = "0" + dd;
	};
	if (mm < 10) {
		mm = "0" + mm;
	};
	var v = dd + "." + mm + "." + yyyy;
	if (h || m || s) {
		if (h < 10) {
			h = "0" + h;
		};
		if (m < 10) {
			m = "0" + m;
		};
		if (s < 10) {
			s = "0" + s;
		};
		v += " " + h + ":" + m + ":" + s;
	};
	return v;
};
Date.prototype.toUTCString = function () {
	var o = this;
    var pad = function (n) {
        return n < 10 ? "0" + n : n;
    };
    if (o.getHours () == 0 && o.getMinutes () == 0 && o.getSeconds () == 0) {
		return '"' + pad (o.getDate ()) + "." +
			pad (o.getMonth () + 1) + "." +
			pad (o.getFullYear ()) + '"';
    }
    return '"' + pad (o.getUTCDate ()) + "." +
        pad (o.getUTCMonth () + 1) + "." +
        pad (o.getUTCFullYear ()) + " " +
        pad (o.getUTCHours ()) + ":" +
        pad (o.getUTCMinutes ()) + ":" +
        pad (o.getUTCSeconds ()) + '"';
};
$zu.getThemeBGColor = function () {
	return window.$themeBGColor || "#ffffff";
};
/*
	Локализация
*/
Ext.define ("$o.locale", {
	singleton: true,
	strings: {},
	load: function (url) {
		var r = Ext.Ajax.request ({
			url: url,
			async: false
		});
		try {
			_.each (JSON.parse (r.responseText), function (v, id) {
				$o.locale.strings [id.toLowerCase ()] = v;
			});
		} catch (e) {
			var r = Ext.Ajax.request ({
				url: url,
				async: false
			}).responseXML;
			var nodes = Ext.DomQuery.select ("string", r.documentElement);
			for (var i = 0; i < nodes.length; i ++) {
				var id = nodes [i].attributes [0].value;
				var text = nodes [i].textContent || nodes [i].text;
				$o.locale.strings [id] = text;
			};
		};
	},
	getString: function () {
		var r = _.map (_.toArray (arguments), function (s) {
			if (!s) {
				return s;
			};
			var n = _.has ($o.locale.strings, s.toLowerCase ()) ? $o.locale.strings [s.toLowerCase ()] : s;
			if (s && n) {
				if (s [0].toUpperCase () == s [0] || ["create", "remove", "delete", "open", "choose", "cancel"].indexOf (s) > -1) {
					n = n [0].toUpperCase () + n.substr (1);
				} else {
					n = n [0].toLowerCase () + n.substr (1);
				};
			};
			return n;
		});
		return r.join (" ");
	},
	// deprecated
	translate: function (s) {
		if (s.indexOf ("connection limit exceeded") > -1) {
			s = "Извините. Сервер в данный момент перегружен. Пожалуйста, повторите запрос позднее.";
		};
		if (s.indexOf ("value exists") > -1) {
			var tokens = s.split (":");
			s = "Значение '" + tokens [1].trim () + "' используется. Пожалуйста введите другое.";
		};
		return s;
	}
});
//
//  Диалог получения мнемокода
//
$zu.dialog = {};
$zu.dialog.getNameAndCode = function (options) {
	var title = options.title;
	var success = options.success;
	var scope = options.scope || this;
	var okBtn = new Ext.Button ({
		code: 'Ok',
		formBind: true,
		scope: this,
		handler: function () {
			success.call (scope, fieldName.getValue (), fieldCode.getValue ());
			win.close ();
		}
	});
	var cancelBtn = new Ext.Button ({
		code: 'Cancel',
		scope: this,
		handler: function () {
			win.close ();
		}
	});
	var fieldName = new Ext.form.TextField ({
		selectOnFocus: true,
		fieldLabel: $zr.getString ("Name"),
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		listeners: {
			render: function () {
				fieldName.focus (false, 200);
			},
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue (), fieldCode.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	var fieldCode = new Ext.form.TextField ({
		selectOnFocus: true,
		fieldLabel: $zr.getString ("Code"),
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		maskRe: /[A-Za-z0-9\_]/,
		listeners: {
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue (), fieldCode.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	var form = new Ext.FormPanel({
		frame: false,
		border: false,
		defaultType: 'textfield',
		monitorValid: true,
		buttonAlign: 'right',
		autoScroll: true,
		bodyPadding: 5,
		layout: 'form',
		items: [
			fieldName,
			fieldCode
		],
		buttons: [
			okBtn,
			cancelBtn
		]
	});
    var win = new Ext.Window ({
		width: 400,
		height: 150,
        layout: 'fit',
        modal: true,
        title: title,
		items: [
			form
		]
	});
	win.show (null, function () {
		fieldName.focus (false, 200);		
	});
}
//
//  Диалог получения мнемокода и типа
//
$zu.dialog.getNameAndCodeAndType = function (options) {
	var title = options.title;
	var success = options.success;
	var scope = options.scope || this;
	var okBtn = new Ext.Button ({
		code: 'Ok',
		formBind: true,
		scope: this,
		handler: function () {
			success.call (scope, fieldName.getValue (), fieldCode.getValue (), fieldType.getValue ());
			win.close ();
		}
	});
	var cancelBtn = new Ext.Button ({
		code: 'Cancel',
		scope: this,
		handler: function () {
			win.close ();
		}
	});
	var fieldName = new Ext.form.TextField ({
		selectOnFocus: true,
		fieldLabel: $zr.getString ("Name"),
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		listeners: {
			render: function () {
				fieldName.focus (false, 200);
			},
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue (), fieldCode.getValue (), fieldType.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	var fieldCode = new Ext.form.TextField ({
		selectOnFocus: true,
		fieldLabel: $zr.getString ("Code"),
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		maskRe: /[A-Za-z0-9\_]/,
		listeners: {
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue (), fieldCode.getValue (), fieldType.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	var fieldType = new Ext.create ("$o.ConfField.Widget", {
		conf: "classAttr", 
		confRef: "class", 
		choose: {
			type: "view", id: "system.classes", attr: "olap.id", width: 500, height: 400
		},
		fieldLabel: $o.getString ("Type"),
		value: 1,
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		listeners: {
			change: function (value) {
				if (value >= 1000) {
					var cls = $o.getClass (value);
					fieldName.setValue (cls.get ("name"));
					fieldCode.setValue (cls.get ("code"));
				};
			}
		}
	});
	var form = new Ext.FormPanel({
		frame: false,
		border: false,
		defaultType: 'textfield',
		monitorValid: true,
		buttonAlign: 'right',
		autoScroll: true,
		bodyPadding: 5,
		layout: 'form',
		items: [
			fieldType,
			fieldName,
			fieldCode
		],
		buttons: [
			okBtn,
			cancelBtn
		]
	});
    var win = new Ext.Window ({
		width: 400,
		height: 200,
        layout: 'fit',
        modal: true,
        title: title,
		items: [
			form
		]
	});
	win.show (null, function () {
		fieldName.focus (false, 200);		
	});
}

// Common util for all projects
Ext.namespace (
	'common',
	'common.chart',
	'common.window',
	'common.card',
	'common.tpl',
	'common.report',
	'obj',
	'dialog',
	'$report',
	'$dbf',
	'$csv'
);
// Message
common.message = function (s, fn) {
	Ext.Msg.alert ($ptitle, s, fn);
};
// Confirm
common.confirm = function (options) {
	var scope = options.scope ? options.scope : this;
	Ext.Msg.show ({
		title: $ptitle,
		msg: options.message,
		buttons: Ext.Msg.YESNO,
		fn: options.fn,
		animEl: 'elId',
		icon: Ext.MessageBox.QUESTION,
		scope: scope
	});
};
// Признак выбранной записи
common.recordSelected = function (options) {
	options = options || {};
	var olap, attr = options.attr || "id";
	if (!options.olap) {
		olap = this;
	} else {
		olap = this.relatives [options.olap];
	};
	var result = false;
	var v;
	if (olap.getSelectionModel) {
		v = olap.getSelectionModel ().hasSelection ();
	} else {
		v = olap.getCurrentValue (attr);
	};
	if (v) {
		result = true;
	};
	/*
	var result = false;
	if (options.olap && options.attr) {
		var id = this.zview.getCurrentValue (options.olap, options.attr);
		if (id) {
			result = true;
		};
	};
	*/
	return result;
};
// options {classCode, attrs, refresh}
obj.create = function (options) {
    var object = $zs.createObject (options.classCode);
    object.commit ();
    var id = object.getId ();
    if (options.attrs) {
    	for (var key in options.attrs) {
    		if (options.attrs.hasOwnProperty (key)) {
	    		object.set (key, options.attrs [key]);
	    	};
    	};
    	object.commit ();
    };
    if (options.refresh) {
	    this.refresh ({
			callback: function (record, store, success) {
				if (success) {
					this.selectRow ({filter: ["&id", "=", id]});
				};
			},
			scope: this
    	});
    };
    return id;
};
// options {id, objects, refresh}
// deprecated
obj.remove = function (options) {
    if (options.id == null ) {
    	common.message ($zr.getString ("object must be selected"));
    	return false;
    };
    var result = false;
    var o = $zs.getObject (options.id);
    if (o) {
    	if (options.objects) {
    		var oo = options.objects;
    		for (var i = 0; i < oo.length; i ++) {
    			if (oo [i].classCode) {
					var r = common.execSQL ({
						select: [
							{"a":"id"}, "id"
						],
						from: [
							{"a":oo [i].classCode}
						],
						where: [
							{"a":oo [i].attr}, "=", options.id
						]
					});
					for (var j = 0; j < r.length; j ++) {
					    var o2 = $zs.getObject (r.get (j, "id"));
				    	if (o2) {
							o2.remove ();
							o2.commit ();
						};
					};
    			} else {
	    			if (o.get (oo [i])) {
					    var o2 = $zs.getObject (o.get (oo [i]));
				    	if (o2) {
						    o2.remove ();
						    o2.commit ();
						};
			    	};
			    };
    		};
    	} else {
			if (!options.force) {
				options.object = o;
				var dependentObjects = obj.getDependentObjects (options);
				if (dependentObjects.length) {
					var r = '<table id="objDetails" style="font-family:Tahoma !important; font-size:8pt !important;"><tr><td><b>Тип</b></td><td style="padding-left: 5px;"><b>Наименование</b></td></tr>';
					var numAliveObjects = 0;
					for (var i = 0; i < dependentObjects.length; i ++) {
						var o = $zs.getObject (dependentObjects [i]);
						if (!o) {
							continue;
						};
						numAliveObjects ++;
						var name;
						try {
							name = o.get ('name') || ('id: ' + o.get ('id'));
						} catch (e) {
							name = 'id: ' + o.get ('id');
						};
						var clsName = $zs.classesMap [o.get ('classId')].stub.get ('name');
						if (clsName.substr (0, 8) == 'section_') {
							clsName = 'Данные';
							name = '';
							if (o.get ('subject')) {
								var oo = $zs.getObject (o.get ('subject'));
								name += oo.get ('name');
							};
							if (o.get ('repDate')) {
								if (name) {
									name += ', ';
								};
								var oo = $zs.getObject (o.get ('repDate'));
								name += oo.get ('name');
							};
						};
						r += '<tr><td>' + clsName  + '</td>';
						r += '<td style="padding-left: 5px;">' + name + '</td></tr>';
					};
					r += '</table>';
					if (numAliveObjects) {
						common.message ("Количество зависимых объектов: " + dependentObjects.length + ' (id: ' + JSON.stringify (dependentObjects) + ')<br><a href="#" id="detailsLink">Подробности</a>');
						Ext.get ("detailsLink").on ("click", function () {
							var w = window.open ("", "window1", "width=600, height=400, resizable=yes, scrollbars=yes, status=yes, top=10, left=10");
							w.document.open ();
							w.document.write (r);
						}, this);
						return false;
					};
				}
			}
    	}
    	o = $zs.getObject (options.id);
		o.remove ();
		o.commit ();
		result = true;
		if (options.refresh) {
			this.getSelectionModel ().deselectAll ();
			this.refresh ();
		};
	};
	return result;
};
// obj.getValue (o, "attr1.attr2.name");
// obj.getValue (args, "$attr1.attr2.name");
obj.getValue = function (o, path) {
	var r = null;
	if (path && path [0] == "$") {
		var tokens = path.split (".");
		var arg = tokens [0].substr (1, tokens [0].length - 1);
		if (o [arg]) {
			o = $o.getObject (o [arg]);
			tokens.splice (0, 1);
			path = tokens.join (".");
		};
	};
	if (o) {
		var tokens = path.split (".");
		for (var i = 0; i < tokens.length; i ++) {
			if (tokens [i] == "$date") {
				return r ? r.toString ("d.m.Y") : r;
			};
			if (i) {
				if (!r) {
					break;
				};
				o = $o.getObject (r);
			};
			if (!o) {
				break;
			};
			r = o.get ? o.get (tokens [i]) : o [tokens [i]];
		};
	};
	return r;
};
common.getValue = obj.getValue;
// DD.MM.YYYY
common.currentDate = function () {
	var d = new Date ();
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = "";

	if (dd < 10)
		s += "0";

	s += String (dd) + ".";

	if (mm < 10)
		s += "0";

	s += String (mm) + ".";
	s += String (yyyy);

	return s;
};
// DD.MM.YYYY
common.getDate = function (d) {
	if (!d) {
		return "";
	};
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = "";

	if (dd < 10)
		s += "0";

	s += String (dd) + ".";

	if (mm < 10)
		s += "0";

	s += String (mm) + ".";
	s += String (yyyy);

	return s;
};
common.getDateFromDDMMYYYY = function (d) {
	var r = null;
	if (d && d.length == 10 && d [2] == "." && d [5] == ".") {
		r = new Date (d.substr (6, 4), d.substr (3, 2) - 1, d.substr (0, 2));
	}
	return r;
}
// HH:MM:SS
common.currentTime = function () {
	var d = new Date ();
	var hh = d.getHours ();
	var mm = d.getMinutes ();
	var ss = d.getSeconds ();
	var s = "";

	if (hh < 10)
		s += "0";

	s += String (hh) + ":";

	if (mm < 10)
		s += "0";

	s += String (mm) + ":";

	if (ss < 10)
		s += "0";

	s += String (ss);

	return s;
};
// DD.MM.YYYY HH:MM:SS
common.currentTimestamp = function () {
	return common.currentDate () + " " + common.currentTime ();
};
// DD.MM.YYYY
common.getDate = function (d) {
	if (!d) {
		return "";
	};
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = "";

	if (dd < 10)
		s += "0";

	s += String (dd) + ".";

	if (mm < 10)
		s += "0";

	s += String (mm) + ".";
	s += String (yyyy);

	return s;
};
// YYYY-MM-DD
common.getDateISO = function (d) {
	if (!d) {
		return d;
	};
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = String (yyyy) + "-";
	if (mm < 10) {
		s += "0";
	}
	s += String (mm) + "-";
	if (dd < 10) {
		s += "0";
	}
	s += String (dd);
	return s;
};
// HH:MM:SS
common.getTime = function (d) {
	var hh = d.getHours ();
	var mm = d.getMinutes ();
	var ss = d.getSeconds ();
	var s = "";

	if (hh < 10)
		s += "0";

	s += String (hh) + ":";

	if (mm < 10)
		s += "0";

	s += String (mm) + ":";

	if (ss < 10)
		s += "0";

	s += String (ss);

	return s;
};
// DD.MM.YYYY HH:MM:SS
common.getTimestamp = function (d) {
	return common.getDate (d) + " " + common.getTime (d);
};
// DD.MM.YYYY
common.getUTCDate = function (d) {
	var dd = d.getUTCDate ();
	var mm = d.getUTCMonth () + 1;
	var yyyy = d.getUTCFullYear ();
	var s = "";

	if (dd < 10)
		s += "0";

	s += String (dd) + ".";

	if (mm < 10)
		s += "0";

	s += String (mm) + ".";
	s += String (yyyy);

	return s;
};
// HH:MM:SS
common.getUTCTime = function (d) {
	var hh = d.getUTCHours ();
	var mm = d.getUTCMinutes ();
	var ss = d.getUTCSeconds ();
	var s = "";

	if (hh < 10)
		s += "0";

	s += String (hh) + ":";

	if (mm < 10)
		s += "0";

	s += String (mm) + ":";

	if (ss < 10)
		s += "0";

	s += String (ss);

	return s;
};
// DD.MM.YYYY HH:MM:SS
common.getUTCTimestamp = function (d) {
	return common.getUTCDate (d) + " " + common.getUTCTime (d);
};
// Date -> Юлианский день
common.getJulianDay = function (d) {
    if (d == '') {
        return 0;
    };
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yy = d.getFullYear ();
/*    if (mm < 3) {
        mm += 12;
        yy --;
    };
    var jd = parseInt (yy * 365.25) + parseInt (mm * 30.6 + 0.7) + dd;
    return jd;*/
    jd = Math.floor ( 1461 * ( yy + 4800 + ( mm - 14 ) / 12)) / 4 + Math.floor (Math.floor ( 367 * ( mm - 2 - 12 * (( mm - 14 ) / 12))) / 12) - 3 * Math.floor (Math.floor ( yy + 4900 + ( mm - 14 ) / 12) / 100) / 4 + dd - 32075;
    return Math.floor (jd);
};
// Юлианский день -> Date
common.getDateByJulianDay = function (jd) {
	var l, n, i, j, d, m, y;
	l = jd + 68569;
	n = Math.floor (( 4 * l ) / 146097);
	l = Math.floor (l - ( 146097 * n + 3 ) / 4);
	i = Math.floor (( 4000 * ( l + 1 ) ) / 1461001);
	l = l - Math.floor (( 1461 * i ) / 4) + 31;
	j = Math.floor (( 80 * l ) / 2447);
	d = l - Math.floor (( 2447 * j ) / 80);
	l = Math.floor (j / 11);
	m = j + 2 - ( 12 * l );
	y = 100 * ( n - 49 ) + i + l;
	return new Date (y, m - 1, d);
}
common.execSQL = function (sql) {
	var j, result;

	if ($zs) {
		result = $zs.execute ({
			query: sql,
			async: false
		});
	} else {
		result = zerp.Storage.STORAGES [0].execute ("Storage.execute([!" + BiJson.serialize (sql) + "!])");
	};

	try {
		var temp = result.length;
	}
	catch (err) {
		result = {};
		result.length = 0;
	}
	// Поля в результате запроса по номерам
	result.fields = {};

	for (j = 0; j < sql.select.length / 2; j ++) {
		result.fields [sql.select [j * 2 + 1] ] = j;
		result.fields [j] = j;
	}
	// Функция доступа к результатам запроса
	// row, col - result [row] [col]
	// col - может быть числом или названием атрибута
	result.get = function (row, col) {
		var colN = this.fields [col];

		if (colN == null)
			throw "result.get: col unknown (row:" + row + ",col:" + col + ")";

		var val = this [row] [colN];

		if (val == undefined)
			val = null;

		return val;
	}
    return result;
};
// Объекты имеющие ссылки на объект options.id
obj.getDependentObjects = function (options) {
	var r = common.execSQL ({
		select: [
			{"a":"___fid"}, "id"
		],
		from: [
			{"a":"system.object"},
			"left-join", {"b":"system.object_attr"}, "on", [{"a":"___fid"}, "=", {"b":"___fobject_id"}],
			"left-join", {"c":"system.class_attr"}, "on", [{"b":"___fclass_attr_id"}, "=", {"c":"___fid"}]
		],
		where: [
			{"a":"___fend_id"}, "=", system.revision.maxRevision, "and",
			{"b":"___fend_id"}, "=", system.revision.maxRevision, "and",
			{"c":"___fend_id"}, "=", system.revision.maxRevision, "and",
			{"c":"___ftype_id"}, ">=", 1000, "and",
			{"b":"___fnumber"}, "=", options.id
		]
	});
	var result = [];
	for (var i = 0; i < r.length; i ++) {
		if (result.indexOf (r.get (i, "id")) == -1) {
			result.push (r.get (i, "id"));
		}
	}
	return result;
};
// Открытые окна карточек (uses in common.window.closeAll)
common.window.list = [];
// Показывает карточку
// options {
//	id или olap, attr - ID объекта для карточки
//	title, - заголовок
//	cardFn, - функция генератор макета карточки cardFn ({id: id})
//	iconCls, - иконка
//	width, - ширина
//	height, - высота
//	refresh, - рефреш зависимого олапа после закрытия окна (options.olap)
//	maximizable, - возможносьт развернуть на весь экран
//	maximized, - показать в развернутом виде
//	modal, - модальное окно
//	listeners - обработчики
//}
common.window.titleMaxLength = 12;
common.window.cardFn = null;
common.window.callCardFn = function (options) {
	return common.window.cardFn (options);
};
// common.window.show (options)
common.window.options = null;
// Заглушка
common.card = function () {return {};};
common.window.onViewLayout = function (options) {
	var record = options.record;
	var layout = options.layout;
	if ($zs.views.ser.card.stub.get ('id') == record.stub.get ('id') && common.window.options) {
		var cardFn = common.window.options.cardFn;
		var r = cardFn (common.window.options);
		Ext.apply (layout, r);
		common.window.options = null; // objectfield.choose.layout тут мешается
	};
};
common.window.show = function (options) {
	options = options || {};
	var id = options.id;
	if (options.olap && options.attr) {
		id = this.relatives [options.olap].getCurrentValue (options.attr);
	};
	options.id = id;
	var windowId = "Window-" + (++ Ext.Component.AUTO_ID);
	var view;
	var record = $zs.views.ser.card;
	if (common.extMajorVersion () == 4) {
		view = Ext.create ("$o.Layout.Widget", {
			record: record,
			$layout: options.cardFn (options)
		});
	} else {
		record.stub.set ("layout", "common.card ()");
		common.window.options = options;
		view = new objectum.ui.layout.ViewLayout (Ext.apply ({
			border: false,
			record: record,
			bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';'
		}, options.viewOptions));
	};
	view.on ('destroy', function () {
		var i = common.window.list.indexOf (this);
		if (i > -1) {
			common.window.list.splice (i, 1);
		}
		if (options.refreshOlap) {
			try {
			    options.refreshOlap.refresh ({
					callback: function (record, store, success) {
						if (success) {
							options.refreshOlap.selectRow ({filter: ["&id", "=", id]});
						};
					}
		    	});
			} catch (e) {
			}
		}
	}, this);
	if (options.refresh) {
		options.refreshOlap	= this.relatives [options.olap];
	}
	if (options.asWindow) {
		options.width = options.width || 800;
		options.height = options.height || 600;
		if (options.listeners && !options.listeners.scope) {
			options.listeners.scope = this;
		}
		var win = new Ext.Window ({
			id: windowId,
			title: options.title,
			resizable: true,
			closable: true,
			maximizable: options.maximizable,
			maximized: options.maximized,
			modal: options.modal,
			width: options.width,
			height: options.height,
			iconCls: options.iconCls,
		    bodyPadding: 2,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			layout: 'fit',
			stateful: false,
			items: [
				view
			],
			listeners: options.listeners
		});
		view.win = win;
/*		win.on ("close", function () {
			var i = common.window.list.indexOf (this);
			if (i > -1) {
				common.window.list.splice (i, 1);
			}
			if (options.refreshOlap) {
				try {
					options.refreshOlap.refresh ();
				} catch (e) {
				}
			}
		}, this);*/
		win.on ('show', function () {
			var pos = win.getPosition ();
			if (pos [1] < 0) {
				win.setPosition (pos [0], 0);
			}
		}, this);
		win.show ();
		common.window.list.push (win);
	} else {                                   
		var pageId = "o" + id;
		var app = $zp.application;
		var closeTask = function () {
			if (options.listeners && options.listeners.close) {
				var scope = options.listeners.close.scope || options.listeners.scope || this;
				var fn = options.listeners.close.fn || options.listeners.close;
				fn.call (scope);
			}
		};
//		app.openPages = app.openPages || {};
//		if (!(pageId in app.openPages)) {
		if (!$o.app.tp.down ("#" + pageId)) {
//			app.openPages [pageId] = app.mainPanel.add ({
			$o.app.tp.add ({
				id: pageId,
				xtype: "panel",
				layout: 'fit',
				node: 1,
				iconCls: options.iconCls,
				tooltip: options.title,
				title: options.title.length > common.window.titleMaxLength ? options.title.substr (0, common.window.titleMaxLength) + "..." : options.title,
				closable: true,
				bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';',
				items: [
					view
				],
				close: function () {
					app.mainPanel.remove (app.openPages [pageId]);
					closeTask ();
				},
				listeners: {
					destroy: function () {
						/*
						if (options.refreshOlap) {
							try {
								options.refreshOlap.refresh ();
							} catch (e) {
							}
						}*/
						closeTask ();
					},
					scope: this
				}
			});
//			view.win = app.openPages [pageId];
//			app.mainPanel.doLayout ();
			$o.app.tp.doLayout ();
		};
		$o.app.tp.setActiveTab (pageId);
//		app.mainPanel.activate (app.openPages [pageId]);
		document.location.href = '#' + pageId;
	}
	$zp.application.fireEvent ('showPage', {record: record, showOptions: options});
};
// Закрывает открытые окна карточек
common.window.closeAll = function () {
	for (var i = 0; i < common.window.list.length; i ++) {
		common.window.list [i].close ();
	}
}
common.data = {};
// Получить ид через код
// options: {classCode, code}
common.getId = function (options) {
	if (common.data [options.classCode] == null) {
		common.data [options.classCode] = {};
		var r = common.execSQL ({
			select: [
				{"a":"id"}, "id",
				{"a":"code"}, "code"
			],
			from: [
				{"a":options.classCode}
			]
		});
		for (var i = 0; i < r.length; i ++) {
			common.data [options.classCode][r.get (i, "code")] = r.get (i, "id");
		}
	};
	var result = common.data [options.classCode][options.code];
	if (result == null) {
		throw {
			name: "common.getId exception",
			message: "classCode:" + options.classCode + ", code:" + options.code + " not exist"
		}
	}
	return result;
};
// Типовой макет для редактирования справочника
// options: {viewCode, classCode, olapId, cardId}
common.sprLayout = function (options) {
	var l = { 
		split:  {
			orientation: "vertical",
			width: 250,
			pages: [
				{olap: {
					id: options.olapId,
					view: options.viewCode,
					actions: [
						{
							id: options.classCode + ".create",  
							caption: "create",
							icon: "new",
							group: true
						}, {
							id: options.classCode + ".remove",
							active: {
								fn: common.recordSelected,
								arguments: {
									olap: "olap",
									attr: "id"
								}
							},
							caption: "delete",
							icon: "delete"
						}
					]
				}},
				{card: {
					id: options.cardId,
					fields: [
						{id: "olap", attr: "id.npp"},
						{id: "olap", attr: "id.name"},
						{id: "olap", attr: "id.code"},
						{id: "olap", attr: "id.used"},
						{id: "olap", attr: "id.description"}
					]
				}}
			]
		}
	}
	return l;
}
/*
	Показывает окно с диаграммой
	
	options: {
		title: "title", 
		width: 800, 
		height: 600, 
		xtype: "linechart", 
		fields: fields, 
		data: data,
		xAxisTitle: "Month",
		yAxisTitle: "USD",
		xField: "month", 
		yFields: [
			{yField: "sales", displayName: "Sales"},
			{yField: "rev", displayName: "Revenue"}
		],
		majorUnit: 500
	}

	storeExample = new Ext.data.JsonStore ({
		fields: ['month', 'sales', 'rev'],
		data: [
			{month:'Jan', sales: 2000, rev: 2000},{month:'Feb', sales: 1800, rev: 2000},
			{month:'Mar', sales: 1500, rev: 2000},{month:'Apr', sales: 2150, rev: 2000},
			{month:'May', sales: 2210, rev: 2000},{month:'Jun', sales: 2250, rev: 2000},
			{month:'Jul', sales: 2370, rev: 2000},{month:'Aug', sales: 2500, rev: 2000},
			{month:'Sep', sales: 3000, rev: 2000},{month:'Oct', sales: 2580, rev: 2000},
			{month:'Nov', sales: 2100, rev: 2000},{month:'Dec', sales: 2650, rev: 2000}
		]
	});
*/
common.chart.show = function (options) {
	var store = new Ext.data.JsonStore ({
		fields: options.fields,
		data: options.data
	});
	var width = options.width || 800;
	var height = options.height || 600;
	var win = new Ext.Window ({
		title: options.title,
		resizable: true,
		closable: true,
		maximizable: true,
		width: width,
		height: height,
		layout: 'fit',
		items: [{
			xtype: options.xtype,
			store: store,
			xField: options.xField,
			xAxis: new Ext.chart.CategoryAxis({
				title: options.xAxisTitle
			}),
			yAxis: new Ext.chart.NumericAxis({
				title: options.yAxisTitle,
				majorUnit: options.majorUnit
			}),
			series: options.yFields,
			extraStyle: {
				legend: {
					display: 'right'
				}
			}
		}]
	});	
	win.show ();
}
Ext.apply(Ext.form.VTypes, {
    daterange : function(val, field) {
        var date = field.parseDate(val);
        if(!date){
            return false;
        }
        if (field.startDateField) {
            var start = Ext.getCmp(field.startDateField);
            if (!start.maxValue || (date.getTime() != start.maxValue.getTime())) {
                start.setMaxValue(date);
                start.validate();
            }
        }
        else if (field.endDateField) {
            var end = Ext.getCmp(field.endDateField);
            if (!end.minValue || (date.getTime() != end.minValue.getTime())) {
                end.setMinValue(date);
                end.validate();
            }
        }
        /*
         * Always return true since we're only using this vtype to set the
         * min/max allowed values (these are tested for after the vtype test)
         */
        return true;
    }
});
// options: {title, success}
dialog.getPeriod = function (options) {
	var dr = new Ext.FormPanel({
		labelWidth: 75,
		frame: true,
		style: "background-color: #fff",
		bodyStyle: "background-color: #fff",
		bodyPadding: 5,
		width: 300,
		defaults: {width: 225},
		defaultType: 'datefield',
		items: [{
			fieldLabel: $zr.getString ("From"),
			allowBlank: false,
			msgTarget: 'side',
			value: common.currentDate (),
			format: "d.m.Y",
			name: 'startdt',
			id: 'startdt',
			vtype: 'daterange',
			endDateField: 'enddt' // id of the end date field
		},{
			fieldLabel: $zr.getString ("To"),
			allowBlank: false,
			msgTarget: 'side',
			value: common.currentDate (),
			format: "d.m.Y",
			name: 'enddt',
			id: 'enddt',
			vtype: 'daterange',
			startDateField: 'startdt' // id of the start date field
		}]
	});
	var scope = options.scope || this;
	var win = new Ext.Window ({
		title: options.title,
		resizable: true,
		closable: true,
		maximizable: false,
		modal: true,
		width: 300,
		height: 150,
		layout: 'fit',
		items: [
			dr
		],
		buttons: [
			{
				code: 'ok',
				formBind: true,
				handler: function () {
					var d1 = dr.items.items [0].getValue ();
					var d2 = dr.items.items [1].getValue ();
					win.close ();
					options.success.call (scope, {startDate: d1, dateStart: d1, endDate: d2, dateEnd: d2});
				}
			}, {
				code: 'cancel',
				formBind: false,
				handler: function () {
					win.close ();
				}
			}
		]
	});	
	win.show ();    
}
// Выбор объекта в любом представлении
// options: {width, height, title, view || layout, attr, success, scope}
dialog.getObject = function (options) {
	var panel;
	var winWidth = options.width || 600;
	var winHeight = options.height || 400;		
	if (!options.title) {
		options.title = $zr.getString ("object.choosing");
	}
	var scope = options.scope || this;
	var view;
	if (options.view) {
		view = new objectum.ui.layout.ViewLayout ({
			xtype: 'zviewlayout',
			border: false,
			record: $zs.views.get (options.view, {async: false}),
			bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';'
		});
	} else {
		var record = $zs.views.get ("ser.card", {async: false});
		record.stub.set ("layout", typeof (options.layout) == "string" ? options.layout : JSON.stringify (options.layout));
		view = new objectum.ui.layout.ViewLayout ({
			xtype: 'zviewlayout',
			border: false,
			record: record,
			bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';'
		});
	};
	var choose = function () {
		var values, t = options.attr || "id";
		t = t.split (".");
		if (t.length == 1) {
			values = view.relatives ["olap"].getCurrentValues (t [0]);
		} else {
			values = view.relatives [t [0]].getCurrentValues (t [1]);
		};
		var value = values [0];
		win.close ();
		options.success.call (scope, {value: value, values: values});
	};
	var win = new Ext.Window ({
		title: options.title,
		resizable: true,
		closable: true,
		height: winHeight,
		width: winWidth,
		layout: 'fit',
		modal: true,
		tbar: [{
			code: 'choose',
			handler: choose,
			scope: scope
		}, {
			code: 'cancel',
			handler: function () {
				win.close ();
			}
		}],
		items: [view]
	});	
	win.show ();
}
/*
	Диалог выбора объекта
	options: {
		view (query)
		success ({value}) - callback
		scope
	}
*/
dialog.selectObject = function (options) {
	var success = options.success;
	var scope = options.scope;
	var layout = {
		olap: {
			id: "olap",
			view: options.view,
			listeners: {
				dblclick: function () {
					choose ();
				}
			}
		}
	};
	var record = $zs.views.get ("ser.card", {async: false});
	record.stub.set ("layout", JSON.stringify (layout));
	var view = new objectum.ui.layout.ViewLayout ({
		xtype: 'zviewlayout',
		border: false,
		record: record,
		bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';'
	});
	var choose = function () {
		var id = view.relatives ["olap"].getCurrentValue ("id");
		win.close ();
		success.call (scope || this, {value: id});
	};
	var btnChoose = new Ext.Button ({
		code: 'choose',
		disabled: true,
		handler: choose,
		scope: this
	});
	var btnCancel = new Ext.Button ({
		code: 'cancel',
		handler: function () {
			win.close ();
		}
	});
	view.on ('load', function () {
		var olap = view.relatives ['olap'];
		if (!olap) {
			return;
		};
		var onSelectionChange = function () {
			if (olap.getCurrentValue ('id')) {
				btnChoose.setDisabled (false);
			} else {
				btnChoose.setDisabled (true);
			}
		};		
		olap.selModel.on ('selectionchange', onSelectionChange, this);
	}, this);
	var win = new Ext.Window ({
		code: $o.getString ("Choose object"),
		resizable: true,
		closable: true,
		width: options.width || 600,
		height: options.height || 400,
		layout: 'fit',
		modal: true,
		tbar: new Ext.Toolbar ({
			items: [btnChoose, btnCancel]
		}),
		items: [view]
	});
	win.show ();
};
// options: {title, success}
dialog.getDate = function (options) {
	var dp = new Ext.FormPanel({
		labelWidth: 75,
		//frame: true,
		bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + '; padding: 5px 5px 0;',
		width: 300,
		border: false,
		defaults: {width: 225},
		defaultType: 'datefield',
		items: [{
			fieldLabel: $zr.getString ("Date"),
			allowBlank: false,
			msgTarget: 'side',
			value: options.value || common.currentDate (),
			minValue: options.minValue,
			maxValue: options.maxValue,
			format: "d.m.Y",
			name: 'dt',
			id: 'dt'
		}]
	});
	var scope = options.scope || this;
	var win = new Ext.Window ({
		title: options.title,
		closable: true,
		modal: true,
		width: 300,
		height: 120,
		layout: 'fit',
		items: [
			dp
		],
		buttons: [
			{
				text: 'Ok',
				iconCls: "ok",
				formBind: true,
				handler: function () {
					var d = dp.items.items [0].getValue ();
					win.close ();
					options.success.call (scope, {date: d});
				}
			}, {
				code: 'cancel',
				formBind: false,
				handler: function () {
					win.close ();
				}
			}
		]
	});	
	win.show ();    
}
//
//  Диалог получения строки
//
// options: {title, success, scope, fieldLabel, value}
dialog.getString = function (options) {
	var title = options.title || $ptitle;
	var success = options.success;
	var failure = options.failure;
	var scope = options.scope || this;
	var value = options.value;
	var okBtn = new Ext.Button ({
		code: 'Ok',
		formBind: true,
		scope: this,
		handler: function () {
			success.call (scope, fieldName.getValue ());
			win.close ();
		}
	});
	var cancelBtn = new Ext.Button ({
		code: 'Cancel',
		scope: this,
		handler: function () {
			if (failure) {
				failure.call (scope);
			}
			win.close ();
		}
	});
	var fieldName = new Ext.form.TextField ({
		selectOnFocus: true,
		fieldLabel: options.fieldLabel || $o.getString ("Enter string"),
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		value: value,
		listeners: {
			render: function () {
				fieldName.focus (false, 200);
			},
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	var form = new Ext.FormPanel({
		frame: false,
		border: false,
		defaultType: 'textfield',
		monitorValid: true,
		buttonAlign: 'right',
		autoScroll: true,
		bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + '; padding: 5px;',
		layout: 'form',
		items: [
			fieldName
		],
		buttons: [
			okBtn,
			cancelBtn
		]
	});
    var win = new Ext.Window ({
		width: 450,
		height: 150,
        layout: 'fit',
        modal: true,
        title: title,
		items: [
			form
		]
	});
	win.show (null, function () {
		fieldName.focus ();
	});
};
//
//  Диалог получения числа
//
// options: {title, success, scope, fieldLabel}
dialog.getNumber = function (options) {
	var title = options.title || $ptitle;
	var success = options.success;
	var failure = options.failure;
	var scope = options.scope || this;
	var okBtn = new Ext.Button ({
		code: 'Ok',
		formBind: true,
		scope: this,
		handler: function () {
			success.call (scope, fieldName.getValue ());
			win.close ();
		}
	});
	var cancelBtn = new Ext.Button ({
		code: 'Cancel',
		scope: this,
		handler: function () {
			if (failure) {
				failure.call (scope);
			}
			win.close ();
		}
	});
	var fieldName = new Ext.form.NumberField ({
		selectOnFocus: true,
		fieldLabel: options.fieldLabel || $o.getString ("Enter number"),
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		listeners: {
			render: function () {
				fieldName.focus (false, 200);
			},
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	var form = new Ext.FormPanel({
		frame: false,
		border: false,
		defaultType: 'textfield',
		monitorValid: true,
		buttonAlign: 'right',
		autoScroll: true,
		bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + '; padding: 5px;',
		layout: 'form',
		items: [
			fieldName
		],
		buttons: [
			okBtn,
			cancelBtn
		]
	});
    var win = new Ext.Window ({
		width: 450,
		height: 150,
        layout: 'fit',
        modal: true,
        title: title,
		items: [
			form
		]
	});
	win.show (null, function () {
		fieldName.focus ();
	});
};
// Лист
$report.sheet = function (options) {
	options = options || {};
	this.name = options.name || 'Sheet';
	this.orientation = options.orientation || 'portrait';
	this.scale = options.scale || '100';
	this.margins = options.margins || {left: 15, top: 15, right: 15, bottom: 15};
	this.rows = options.rows || [];
	this.validation = options.validation || [];
	this.namedRange = options.namedRange || [];
	this.columns = options.columns || {};
	this.ell = options.ell || {};
	this.autoFitHeight = options.autoFitHeight;
};
// Строка
$report.row = function (options) {
	options = options || {};
	this.height = options.height || 12.75;
	this.cells = options.cells || [];
	this.startIndex = options.startIndex || 0;
};
// Отчет в формате XMLSS
$report.xmlss = function (options) {
	// Параметры
	/*  
	{
		autoFitHeight: true,
		orientation: "landscape",
		margins: {
			left: 31,
			top: 32,
			right: 33,
			bottom: 34
		}
	}
	*/
	this.params = {};
	// Стили
	/*
	{
		"sMy": "hAlign:Center,vAlign:Center,borders:All,bgColor:LightCoral"
	}
	hAlign, vAlign: Left Right Top Bottom Center
	rotate: 90
	wrap: true
	bold: true
	numberFormat: #,##0.000
	borders: All,Left,Top,Right,Bottom,AllDash
	*/
	this.styles = {
		'default': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9',
		'center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9',
		'center_bold': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,bold:true',
		'bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,bold:true',
		'border': 'hAlign:Left,vAlign:Top,wrap:true,fontSize:9,borders:All',
		'border_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All',
		'border_bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
		'border_bold_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true,underline:true',
		'border_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,underline:true',
		'border_bold_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
		'border_bottom': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:Bottom',
		'right': 'hAlign:Right,vAlign:Center,wrap:true,fontSize:9'
	};
	// Колонки
	/*
	{
		"0": {width: 20},
		"2": {width: 20}		
	}
	*/
	this.columns = {};
	// Строки
	/*
	report.rows.push (new $report.row ({height: 30, cells: [{
		text: "cell1_1", style: "sBold", colspan: 1, rowspan: 1, index: 10
	}, {
		text: "cell1_2", style: "sBorder"
	}]}));	
	*/
	this.rows = [];
	/*
		Многостраничный отчет
		В этом режиме rows находится в sheet
	*/
	this.sheets = [];
	// Нормализация объектов
	this.normalize = function (options) {
		if (Ext.isArray (this.columns)) {
			var o = {};
			for (var i = 0; i < this.columns.length; i ++) {
				o [i + 1] = {width: this.columns [i]};
			};
			this.columns = o;
		};
		if (!this.rows || !this.rows.length) {
			this.rows = [{cells: [{text: ""}]}];
		};
		for (var i = 0; i < this.rows.length; i ++) {
			var row = this.rows [i];
			row.height = row.height || 12.75;
			row.cells = row.cells || [];
			for (var j = 0; j < row.cells.length; j ++) {
				if (typeof (row.cells [j].text) == "number") {
					row.cells [j].text = String (row.cells [j].text);
				};
			};
			row.startIndex = row.startIndex || 0;
		};
		for (var k = 0; k < this.sheets.length; k ++) {
			var sheet = this.sheets [k];
			if (Ext.isArray (sheet.columns)) {
				var o = {};
				for (var i = 0; i < sheet.columns.length; i ++) {
					o [i + 1] = {width: sheet.columns [i]};
				};
				sheet.columns = o;
			};
			sheet.rows = sheet.rows || [];
			for (var i = 0; i < sheet.rows.length; i ++) {
				var row = sheet.rows [i];
				row.height = row.height || 12.75;
				row.cells = row.cells || [];
				for (var j = 0; j < row.cells.length; j ++) {
					var t = row.cells [j].text;
					if (typeof (t) == "number") {
						row.cells [j].text = String (row.cells [j].text);
					};
					if (typeof (t) == "string") {
						if (t == "null") {
							row.cells [j].text = "";
						} else {
							row.cells [j].text = t.split ("<").join ("&lt;").split (">").join ("&gt;");
						};
					};
					if (options && options.showNull && (t == null || t == "" || t == "null")) {
						row.cells [j].text = "null";
					};
					row.cells [j].style = row.cells [j].style || "default";
				};
				row.startIndex = row.startIndex || 0;
			};
			if (!sheet.rows.length) {
				sheet.rows = [{startIndex: 0, height: 12.75, cells: [{text: "", style: "default"}]}];
			};
		};
	};
	this.preview = function (options) {
		var me = this;
		options = options || {};
		me.title = options.title;
		var win = new Ext.Window ({
			title: $o.getString ("Preview"),
			resizable: true,
			closable: true,
			maximizable: true,
			modal: true,
			width: 1000,
			height: 600,
			border: false,
			iconCls: "gi_print",
			layout: "fit",
			items: {
				html: me.createHTML ({generate: 1}),
				autoScroll: true
			},
			buttons: [{
				text: options.xlsx ? "Таблица XML - MS Excel" : "Печать",
				iconCls: "gi_print",
				handler: function () {
					me.create ();
				}
			}, {
				text: "XLSX - MS Excel",
				iconCls: "gi_print",
				hidden: options.xlsx ? false : true,
				handler: function () {
					me.createXLSX ();
				}
			}]
		});
		win.show ();
	};
	// Создание отчета
	this.create = function (options) {
		this.normalize (options);
		var uri = 'report?sessionId=' + $sessionId + "&username=" + $zp.currentUser + "&format=xmlss&custom=1";
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' target='_blank' action='" + uri + "'>" +
			"<textarea style='display: none' name='params'>" + JSON.stringify (this.params) + "</textarea>" +
			"<textarea style='display: none' name='styles'>" + JSON.stringify (this.styles) + "</textarea>" +
			"<textarea style='display: none' name='columns'>" + JSON.stringify (this.columns) + "</textarea>" +
			"<textarea style='display: none' name='rows'>" + JSON.stringify (this.rows) + "</textarea>" +
			"<textarea style='display: none' name='sheets'>" + JSON.stringify (this.sheets) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};
	this.createXLSX = function (options) {
		this.normalize (options);
		var uri = 'report?sessionId=' + $sessionId + "&username=" + $zp.currentUser + "&format=xlsx";
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' target='_blank' action='" + uri + "'>" +
			"<textarea style='display: none' name='params'>" + JSON.stringify (this.params) + "</textarea>" +
			"<textarea style='display: none' name='styles'>" + JSON.stringify (this.styles) + "</textarea>" +
			"<textarea style='display: none' name='columns'>" + JSON.stringify (this.columns) + "</textarea>" +
			"<textarea style='display: none' name='rows'>" + JSON.stringify (this.rows) + "</textarea>" +
			"<textarea style='display: none' name='sheets'>" + JSON.stringify (this.sheets) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};
	this.createCSV = function (options) {
		this.normalize (options);
		var uri = 'report?sessionId=' + $sessionId + "&username=" + $zp.currentUser + "&format=xlsx&convert_csv=1&win1251=1";
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' target='_blank' action='" + uri + "'>" +
			"<textarea style='display: none' name='params'>" + JSON.stringify (this.params) + "</textarea>" +
			"<textarea style='display: none' name='styles'>" + JSON.stringify (this.styles) + "</textarea>" +
			"<textarea style='display: none' name='columns'>" + JSON.stringify (this.columns) + "</textarea>" +
			"<textarea style='display: none' name='rows'>" + JSON.stringify (this.rows) + "</textarea>" +
			"<textarea style='display: none' name='sheets'>" + JSON.stringify (this.sheets) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};
	// Создание PDF отчета
	this.createPDF = function (options) {
		this.normalize ();
		var uri = 'pdf?sessionId=' + $sessionId;
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' target='_blank' action='" + uri + "'>" +
			"<textarea style='display: none' name='params'>" + JSON.stringify (this.params) + "</textarea>" +
			"<textarea style='display: none' name='styles'>" + JSON.stringify (this.styles) + "</textarea>" +
			"<textarea style='display: none' name='columns'>" + JSON.stringify (this.columns) + "</textarea>" +
			"<textarea style='display: none' name='rows'>" + JSON.stringify (this.rows) + "</textarea>" +
			"<textarea style='display: none' name='sheets'>" + JSON.stringify (this.sheets) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};
	// Создание HTML отчета в новом окне
	this.createHTML = function (options) {
		this.normalize ();
		options = options || {};
		var rows = options.rows || this.rows;
		if (this.sheets.length) {
			rows = this.sheets [0].rows;
		};
		var w;
		if (options.generate) {
			w = {
				document: {
					open: function () {
					},
					close: function () {
					},
					html: "",
					write: function (s) {
						this.html += s;
					}
				}
			};
		} else {
			w = window.open ("", "window1", "width=800, height=600, resizable=yes, scrollbars=yes, status=yes, top=10, left=10");
		};
		w.document.open ();
		if (options.title) {
			w.document.write ("<p><b>" + options.title + "</b></p>");
		};
		w.document.write (
			"<style type='text/css'>\n" +
			"* {\n" +
			"   font-family: Tahoma;\n" +
			"   font-size: 8pt;\n" +
			"}\n" +
			"table {\n" +
			"	border-left: 0px;\n" +
			"	border-top: 0px;\n" +
			"	border-right: 1px solid #BBBBBB;\n" +
			"	border-bottom: 1px solid #BBBBBB;\n" +
			"}\n" +
			"tr {\n" +
			"	border: 0px;\n" +
			"}\n" +
			"td {\n" +
			"	border-left: 1px solid #BBBBBB;\n" +
			"	border-top: 1px solid #BBBBBB;\n" +
			"	border-right: 0px;\n" +
			"	border-bottom: 0px;\n" +
			"}\n" +
			".tb-text {\n" +
			"	text-align: left;\n" +
			"	padding: 5px;\n" +
			"}\n" +
			".tb-header {\n" +
			"	padding: 5px;\n" +
			"	font-weight: bold;\n" +
			"	background: #DDDDDD;\n" +
			"}\n" +
			".tb-title {\n" +
			"	padding: 5px;\n" +
			"	padding-left: 20px !important;\n" +
			"	background: #DDEEFF;\n" +
			"}\n" +
			"</style>\n"
		);
		w.document.write ('<table cellpadding=0 cellspacing=0>');
		for (var i = 0; i < rows.length; i ++) {
			var row = rows [i];
			var cells = row.cells;
			var r = "<tr>";
			for (var j = 0; j < cells.length; j ++) {
				var cell = cells [j];
				var v = cell.text;
				if (v === undefined || v === null || v === "") {
					v = "<img width=1 height=1>";
				};
				cell.style = cell.style || "";
				if (cell.style.indexOf ("bold") > -1) {
					v = "<b>" + v + "</b>";
				};
				if (cell.style == "border_gray") {
					v = "<font color='gray'>" + v + "</font>";
				};
				var bgcolor = "";
				if (cell.style == "border_bg_gray") {
					bgcolor = "bgcolor='#DDDDDD'";
				};
				if (cell.style == "border_bg_red") {
					bgcolor = "bgcolor='#ff9999'";
				};
				if (cell.style == "border_bg_green") {
					bgcolor = "bgcolor='#99ff99'";
				};
				if (cell.style == "border_bg_blue") {
					bgcolor = "bgcolor='#9999ff'";
				};
				r += "<td class='tb-text' colspan=" + cell.colspan + " rowspan=" + cell.rowspan + " " + bgcolor + ">" + v + "</td>";
			};
			r += "</tr>";
			w.document.write (r);
		};
		w.document.write ('</table>');
		w.document.close ();    
		if (options.generate) {
			return w.document.html;
		};
	};
};
/*
	DBF.field
	{
		name // <= 11
		type // 'C','N','L','D','M'
		size; // длина строки или числа в строковом виде
		dec; // число знаков после запятой
	}
*/
$dbf.field = function (options) {
	this.name = options.name;
	this.type = options.type;
    if (options.type == 'D') {
        this.size = 8;
    } else {
		this.size = options.size || 0;
	};
	this.dec = options.dec || 0;
};
/*
	DBF
*/
$dbf.file = function (options) {
	options = options || {};
	this.options = {
		filename: "data.dbf",
		coding: options.coding || "WIN" // ["WIN", "DOS"]
	};
	/*
		Поля
	*/
	this.fields = options.fields || [];
	/*
		Данные
		[{
			name: value, ...
		}]
	*/
	this.rows = options.rows || [];
	// Создание отчета
	this.create = function (options) {
		var uri = 'report?sessionId=' + $sessionId + "&username=" + $zp.currentUser + "&format=dbf&custom=1&filename=" + this.options.filename;
		for (var i = 0; i < this.rows.length; i ++) {
			var row = this.rows [i];
			for (var field in row) {
				row [field] = String (row [field]);
			};
		};
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' action='" + uri + "'>" +
			"<textarea style='display: none' name='options'>" + JSON.stringify (this.options) + "</textarea>" +
			"<textarea style='display: none' name='fields'>" + JSON.stringify (this.fields) + "</textarea>" +
			"<textarea style='display: none' name='rows'>" + JSON.stringify (this.rows) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};	
};
/*
	CSV
*/
$csv.file = function (options) {
	options = options || {};
	this.body = options.body || "";
	// Создание отчета
	this.create = function (options) {
		var uri = 'report?sessionId=' + $sessionId + "&username=" + $o.currentUser + "&format=xmlss&custom=1&csv=1";
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' action='" + uri + "'>" +
			"<textarea style='display: none' name='body'>" + this.body + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};	
};
String.prototype.fulltrim = function () {
	return this.replace (/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace (/\s+/g,' ');
};
common.isEmail = function (email) {
	var emailReg = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
	return emailReg.test (email);
};
Ext.example = function () {
    function createBox (t, s) {
        return [
			'<div class="msg">',
			'<div class="x-box-tl"><div class="x-box-tr"><div class="x-box-tc"></div></div></div>',
			'<div class="x-box-ml"><div class="x-box-mr"><div class="x-box-mc"><h3>', t, '</h3>', s, '</div></div></div>',
			'<div class="x-box-bl"><div class="x-box-br"><div class="x-box-bc"></div></div></div>',
			'</div>'
		].join ("");
    };
    return {
        msg: function (title, msg, el) {
			var msgCt = Ext.DomHelper.insertFirst (el || document.body, {id:'msg-div'}, true);
            //msgCt.alignTo (el || document, 't');
            var m = Ext.DomHelper.append (msgCt, {html: createBox (title, msg)}, true);
            m.slideIn ('t').pause (500).ghost ("t", {remove: true});
        },
        init: function () {
            var lb = Ext.get ('lib-bar');
            if (lb) {
                lb.show();
            };
        }
    };
}();
common.balloon = function (t, m) {
	Ext.example.msg (t, m);
};
common.rowLinks = function (value, metaData, record, rowIndex, colIndex, store, args) {
	if (metaData.id == (args.fieldName || "name") || (metaData.column && metaData.column.dataIndex == (args.fieldName || "name"))) {
		value = value || args.nullText || $o.getString ("Untitled");
		args.id = record.data [args.fieldId || "id"];
		value = "<a href='#' onclick='" + args.fn + '.call (Ext.getCmp ("' + this.id + '"), ' + JSON.stringify (args) + ")'>" + value + "</a>";
	};
	return value;
};
/*
	Округляет до n знаков после запятой
*/
common.round = function (d, n) {
	if (!d) {
		return d;
	};
	var nn;
	switch (n) {
	case null:
	case undefined:
	case 0:
		nn = 1;
		break;
	case 1:
		nn = 10;
		break;
	case 2:
		nn = 100;
		break;
	case 3:
		nn = 1000;
		break;
	case 4:
		nn = 10000;
		break;
	default:
		throw "common.round - invalid n: " + n;
	};
	var r = Math.round (d * nn) / nn;
	return r;
};
common.isNumber = function (n) {
  return !isNaN (parseFloat (n)) && isFinite (n);
};
common.sqlArray = function (a) {
	var r = [];
	for (var i = 0; i < a.length; i ++) {
		if (i) {
			r.push (",");
		};
		r.push (a [i]);
	};
	return r;
};
common.extMajorVersion = function () {
	var v = Ext.version || Ext.getVersion ().version;
	return v.split (".")[0];
};
common.isEmail = function (email) {
	var emailReg = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
	return emailReg.test (email);
};
common.unicode = {
	escape: function (s) {
		if (!s) {
			return s;
		};
		return s.replace (/^[-~]|\\/g, function (m) {
			var code = m.charCodeAt (0);
			return '\\u' + ((code < 0x10) ? '000' : ((code < 0x100) ? '00' : ((code < 0x1000) ? '0' : ''))) + code.toString (16);
		});
	},
	unescape: function (s) {
		if (!s) {
			return s;
		};
		return s.replace (/\\u([a-fA-F0-9]{4})/g, function (matched, g1) {
			return String.fromCharCode (parseInt (g1, 16))
		})
	}
};
common.addRecord = function (options) {
	var store = options.store;
	var data = options.data;
	var map = options.map;
	if (!store || !data || !map) {
		return data;
	};
	function getValue (data, path) {
		var tokens = path.split (".");
		var val = data [tokens [0]];
		for (var i = 1; i < tokens.length; i ++) {
			var o = $o.getObject (val);
			if (!o) {
				val = null;
				break;
			};
			val = o.get (tokens [i]);
		};
		return val;
	};
	for (var attr in map) {
		data [attr] = getValue (data, map [attr]);
	};
	var cmp = options.cmp;
	if (cmp.getXType ().indexOf ("tree") > -1) {
		var sm = cmp.getSelectionModel ();
		var node;
		if (sm.hasSelection ()) {
            node = sm.getSelection ()[0];
            node.set ("leaf", false);
        } else {
            node = cmp.getStore ().getRootNode ();
        };
        //node.expand ();
        data.leaf = true;
        node.appendChild (data);
	} else {
		store.add (data);
	};
	return data;
};
common.updateRecord = function (options) {
	var record = options.record;
	var map = options.map;
	if (!record || !map) {
		return record;
	};
	function getValue (record, path) {
		var tokens = path.split (".");
		var val = record.get (tokens [0]);
		for (var i = 1; i < tokens.length; i ++) {
			var o = $o.getObject (val);
			if (!o) {
				val = undefined;
				break;
			};
			val = o.get (tokens [i]);
		};
		return val;
	};
	for (var attr in map) {
		var v = getValue (record, map [attr]);
		if (v !== undefined) {
			record.set (attr, v);
		}
	};
	record.commit ();
	return record;
};
common.tpl.remove = function (options) {
	options = options || {};
	var me = this;
	common.confirm ({message: $o.getString ("Are you sure?"), fn: function (btn) {
		if (btn == "yes") {
			var id = options.id || me.getValue ("a_id") || me.getValue ("id");
			if (id) {
				$o.startTransaction ({description: "Remove " + id});
				var o = $o.getObject (id);
				o.remove ();
				o.commit ();
				$o.commitTransaction ();
				if (me.getSelectionModel) {
					var record = me.getSelectionModel ().getSelection ()[0];
					if (me.getXType ().indexOf ("tree") > -1) {
	                    var parentNode = record.parentNode;
						record.remove ();
						if (parentNode != me.getStore ().getRootNode () && !parentNode.childNodes.length) {
							parentNode.set ("leaf", true);
						};
					} else {
						me.getStore ().remove (record);
					};
				};
			};
		};
	}});
};
common.tpl.show = function (options) {
	var me = this;
	options = options || {};
	options.id = options.id || this.getValue ("a_id") || this.getValue ("id");
	var refresh = options.refresh;
	var fn = options.card;
	if (fn) {
		fn = typeof (fn) == "string" ? eval (fn) : fn;
	};
	var layout = options.layout;
	options.title = options.title || "";
	if (options.id) {
		var o = $s.getObject (options.id);
		options.title = o.get ("name") || "ID: " + (options.id < 0 ? $o.getString ("Adding") : options.id);
	};
	var map = options.map || me.map || {};
	var sql = eval ("(" + me.$view.get ("query") + ")");
	// tree: {a: "id", b: "id.type", c: "id.type.vid"} <- select a.name, b.name from subject.org a left join spr.org.type b on (b.id = a.type) left join spr.org.vid c on (c.id = b.vid)
	var getTree = function (from) {
		var tree = {};
		var a; for (a in from [0]) {break;};
		tree [a] = me.$view.attrs ["a_id"] ? "a_id" : "id";
		function process (b) {
			for (var i = 2; i < from.length; i += 4) {
				var e; for (e in from [i]) {break;};
				if (tree [e]) {
					continue;
				};
				var c = from [i + 2];
				for (var j = 0; j < c.length; j ++) {
					if (typeof (c [j]) == "object") {
						var d; for (d in c [j]) {break;};
						if (d == b && 
							c [j][d] != "id" // обратные ссылки не получится
						) {
							tree [e] = tree [b] + "." + c [j][d];
							process (e);
						};
					};
				};
			};
		};
		process (a);
		return tree;
	};
	var tree = getTree (sql.from);
	for (var i = 1; i < sql.select.length; i ++) {
		if (typeof (sql.select [i]) == "string") {
			for (var j = 0; j < me.columns.length; j ++) {
				if (me.columns [j].dataIndex == sql.select [i]) {
					var a; for (a in sql.select [i - 1]) {break;};
					map [sql.select [i]] = map [sql.select [i]] || (tree [a] + "." + sql.select [i - 1][a]);
				};
			};
		};
	};
	layout = layout || fn.call (this, options);
	if (options.readOnly) {
		common.makeReadOnlyLayout (layout);
	};
	var items = {
		id: "o" + options.id,
		objectId: options.id,
		name: "viewContainer",
		xtype: "$o.layout",
		opener: me,
		title: options.title,
		$layout: layout,
		listeners: {
			destroy: function () {
				var o = $s.getObject (options.id);
				if (o.get ("id") != options.id) {
					var record = common.addRecord ({
						cmp: me,
						store: me.getStore (), 
						data: me.$view.attrs ["a_id"] ? {
							"a_id": o.get ("id")
						} : {
							"id": o.get ("id")
						},
						map: map
					});
					if (me.getXType ().indexOf ("tree") == -1) {
						me.getSelectionModel ().deselectAll ();
						me.getSelectionModel ().select (me.getStore ().getCount () - 1);
					};
				} else {
					var record = me.getSelectionModel ().getSelection ()[0];
					if (!record) {
	                    var store = me.getStore ();
	                    var sm = me.getSelectionModel ();
	                    record = store.getById (options.id);
	                    if (record) {
	                    	sm.select (record);
	                    }
					}
					common.updateRecord ({
						cmp: me,
						record: record,
						map: map
					});
				};
				if (refresh && typeof (me.refresh) == "function") {
					me.refresh ();
				};
			}
		}
	};
	if (options.asWindow) {
		items.title = undefined;
		var win = Ext.create ("Ext.window.Window", {
			title: options.title,
			resizable: true,
			closable: true,
			width: options.width || 800,
			height: options.height || 600,
			layout: "fit",
			modal: true,
			items: items
		});
		win.show ();
	} else {
		$o.app.show ({items: items});
	};
};
common.tpl.getViewObjectId = function () {
	var id = 0;
	var vc = this.up ("*[name=viewContainer]");
	if (vc) {
	    id = vc.objectId;
	};
	return id;
};
common.tpl.getOpener = function () {
	var vc = this.up ("*[name=viewContainer]");
	if (vc) {
	    return vc.opener;
	};
};
common.tpl.create = function (options) {
	var me = this;
	var o = $s.createObject (options.classCode, "local");
	if (options.attrs) {
		for (var attr in options.attrs) {
			var v = options.attrs [attr];
            if (Object.prototype.toString.apply (v) === "[object Array]") {
            	v = me.relatives [v [0]].getValue (v [1]);
            };
            o.set (attr, v);
		};
	};
	if (me.getXType ().indexOf ("tree") > -1) {
		o.set (me.fields.parent, me.getValue (me.fields.id));
	};
	options.id = o.get ("id");
	if (options.fn) {
		var fn = typeof (options.fn) == "string" ? eval (options.fn) : options.fn;
		fn.call (me, o, options);
	};
	if (!options.layout) {
		options.card = options.card || (options.classCode + ".card");
	};
    common.tpl.show.call (this, options);
};
// Заполняет шаблон аргументами или значениями объектов
common.tpl.updateTags = function (r, args) {
	if (!r) {
		return r;
	};
	var tags = [];
	var isObject = 0;
	if (typeof (r) == "object") {
		r = JSON.stringify (r);
		isObject = 1;
	};
	for (var i = 1; i < r.length; i ++) {
		if ((r [i] == "$" || r [i] == "#") && r [i - 1] == "[") {
			var tag = "";
			for (; i < r.length; i ++) {
				if (r [i] == "]") {
					break;
				} else {
					tag += r [i];
				};
			};
			if (tags.indexOf (tag) == -1) {
				tags.push (tag);
			};
		};
	};
	for (var i = 0; i < tags.length; i ++) {
		var result;
		if (tags [i][0] == "$") {
			result = common.getValue (args, tags [i]);
		} else {
			result = args [tags [i].substr (1)];
		};
		r = r.split ("[" + tags [i] + "]").join (result);
	};
	if (isObject) {
		r = JSON.parse (r);
	};
	return r;
};
dialog.getClass = function (options) {
	var success = options.success;
	var win = Ext.create ("Ext.Window", {
		title: $o.getString ("Choose", "class"),
		width: 900,
		height: 700,
		layout: "fit",
		frame: false,
		border: false,
		bodyPadding: 1,
		items: {
			xtype: "$o.classes",
			name: "classes"
		},
		listeners: {
			afterrender: function () {
				var olap = win.down ("*[zid=olap]");
				var id;
				var btnChoose = Ext.create ("Ext.Button", {
					text: $o.getString ("Choose"),
					iconCls: "ok",
					disabled: true,
					handler: function () {
						success ({id: id});
						win.close ();
					}
				});
				olap.selModel.on ('selectionchange', function () {
					id = olap.getCurrentValue ("id");
					if (id) {
						btnChoose.setDisabled (false);
					} else {
						btnChoose.setDisabled (true);
					};
				}, this);
				if (olap.lconfig && olap.lconfig.listeners && olap.lconfig.listeners.dblclick) {
					delete olap.lconfig.listeners.dblclick;
				};
				olap.on ("itemdblclick", function () {
					btnChoose.handler ();
				});
				var tbar = olap.down ("toolbar[dock=top]");
				tbar.insert (0, [btnChoose]);
				tbar.doLayout ();
			}
		}
	});
	win.show ();
};
// {hasQuery, success}
dialog.getView = function (options) {
	var success = options.success;
	var win = Ext.create ("Ext.Window", {
		title: $o.getString ("Select") + " " + (options.hasQuery ? $o.getString ("query") : $o.getString ("view")),
		width: 900,
		height: 700,
		layout: "fit",
		frame: false,
		border: false,
		bodyPadding: 1,
		items: {
			xtype: "$o.views",
			name: "views"
		},
		listeners: {
			afterrender: function () {
				var olap = win.down ("*[zid=olap]");
				var id;
				var btnChoose = Ext.create ("Ext.Button", {
					text: $o.getString ("Choose"),
					iconCls: "ok",
					disabled: true,
					handler: function () {
						success ({id: id});
						win.close ();
					}
				});
				olap.selModel.on ('selectionchange', function () {
					id = olap.getCurrentValue ("id");
					if (id && (!options.hasQuery || (options.hasQuery && $o.getView (id).get ("query")))) {
						btnChoose.setDisabled (false);
					} else {
						btnChoose.setDisabled (true);
					};
				}, this);
				if (olap.lconfig && olap.lconfig.listeners && olap.lconfig.listeners.dblclick) {
					delete olap.lconfig.listeners.dblclick;
				};
				olap.on ("itemdblclick", function () {
					btnChoose.handler ();
				});
				var tbar = olap.down ("toolbar[dock=top]");
				tbar.insert (0, [btnChoose]);
				tbar.doLayout ();
			}
		}
	});
	win.show ();
};
dialog.getAction = function (options) {
	var success = options.success;
	var win = Ext.create ("Ext.Window", {
		title: $o.getString ("Select", "action"),
		width: 900,
		height: 700,
		layout: "fit",
		frame: false,
		border: false,
		bodyPadding: 1,
		items: {
			xtype: "$o.classes",
			name: "classes"
		},
		listeners: {
			afterrender: function () {
				var olap = win.down ("*[zid=olapActions]");
				olap.up ("tabpanel").setActiveTab (2);
				var id;
				var btnChoose = Ext.create ("Ext.Button", {
					text: $o.getString ("Choose"),
					iconCls: "ok",
					disabled: true,
					handler: function () {
						success ({id: id});
						win.close ();
					}
				});
				olap.selModel.on ('selectionchange', function () {
					id = olap.getCurrentValue ("id");
					if (id) {
						btnChoose.setDisabled (false);
					} else {
						btnChoose.setDisabled (true);
					};
				}, this);
				if (olap.lconfig && olap.lconfig.listeners && olap.lconfig.listeners.dblclick) {
					delete olap.lconfig.listeners.dblclick;
				};
				olap.on ("itemdblclick", function () {
					btnChoose.handler ();
				});
				var tbar = olap.down ("toolbar[dock=top]");
				tbar.insert (0, [btnChoose]);
				tbar.doLayout ();
			}
		}
	});
	win.show ();
};
common.report.show = function (options) {
	var o = $o.getObject (options.id);
	var success = options.success;
	var value = o.get ("options") ? JSON.parse (o.get ("options")) : null;
	var win = Ext.create ("Ext.Window", {
		title: $o.getString ("Report"),
		iconCls: "gi_print",
		width: 800,
		height: 600,
		layout: "fit",
		frame: false,
		border: false,
		bodyPadding: 1,
		modal: true,
		maximizable: true,
		tbar: [{
			text: $o.getString ("Save"),
			iconCls: "save",
			handler: function () {
				var rd = win.down ("*[name=reportdesigner]");
				var v = rd.getValue ();
				if (!v.code) {
					common.message ($o.getString ("Enter report code"));
					return;
				};
				$o.startTransaction ();
				o.set ("name", v.name);
				o.set ("code", v.code);
				o.set ("options", JSON.stringify (v));
				o.sync ("local");
				$o.commitTransaction ();
				if (success) {
					success ({id: o.get ("id")});
				};
			}
		}, {
			text: $o.getString ("Preview"),
			iconCls: "gi_search",
			handler: function () {
				var value = JSON.parse (o.get ("options"));
				var rd = Ext.create ("$o.ReportDesigner.Widget", {
					value: value
				});
				rd.build ({html: 1});
			}
		}],
		items: {
			xtype: "$o.reportdesigner",
			name: "reportdesigner",
			value: value
		}
	});
	win.show ();
};
common.report.build = function (options) {
	var code = options.code;
	var r = $o.execute ({
		select: [
			{"a": "id"}, "id"
		],
		from: [
			{"a": "system.vo.report"}
		],
		where: [
			{"a": "code"}, "=", code
		]
	});
	if (!r.length) {
		common.message ($o.getString ("Report") + " '" + code + "' " + $o.getString ("not exists"));
		return;
	};
	var o = $o.getObject (r.get (0, "id"));
	var value = JSON.parse (o.get ("options"));
	var rd = Ext.create ("$o.ReportDesigner.Widget", {
		value: value
	});
	rd.build (options);
};
common.merge = function (json1, json2) {
    var out = {};
    for (var k1 in json1) {
        if (json1.hasOwnProperty (k1)) out[k1] = json1 [k1];
    };
    for (var k2 in json2) {
        if (json2.hasOwnProperty (k2)) {
            if (!out.hasOwnProperty (k2)) out [k2] = json2 [k2];
            else if (
                (typeof out [k2] === 'object') && (out [k2].constructor === Object) && 
                (typeof json2 [k2] === 'object') && (json2 [k2].constructor === Object)
            ) out [k2] = common.merge (out [k2], json2 [k2]);
        }
    }
    return out;
};
common.makeReadOnlyLayout = function (layout) {
	try {
		// circular?
		JSON.stringify (layout);
	} catch (e) {
		return;
	};
	//var cache = {};
	function go (l) {
		/*
		if (cache [l]) {
			return;
		};
		cache [l] = true;
		*/
	    for (var key in l) {
	        if (typeof (l [key]) == "object") {
		        if (key == "actions" && Ext.isArray (l [key])) {
		            for (var i = l [key].length - 1; i >= 0; i --) {
		                if ([$o.getString ("Open")].indexOf (l [key][i].text) > -1 || ["open"].indexOf (l [key][i].caption) > -1) {
		                    l [key][i].arguments = l [key][i].arguments || {};
		                    l [key][i].arguments.readOnly = true;
		                } else
		                if ([$o.getString ("Add"), $o.getString ("Remove")].indexOf (l [key][i].text) > -1 || ["create", "delete"].indexOf (l [key][i].caption) > -1) {
		                    l [key][i].active = function () {return false;};
		                } else {
		                    l [key][i].arguments = l [key][i].arguments || {};
		                    l [key][i].arguments.readOnly = true;
		                }
		            };
		        } else
		        if (key == "listeners" && l.listeners.dblclick) {
		        	delete l.listeners.dblclick;
		        } else
	        	if (key == "card") {
	        		l [key].readOnly = true;
	        	} else {
	            	go (l [key]);
	            };
	        };
	    };
	};
	if (typeof (layout) == "string") {
		layout = eval ("(" + layout + ")");
	};
	go (layout);
	return layout;
};
/*
	1000000 -> 1 000 000
*/
common.setThousandSeparator = function (v) {
	var me = this;
	var s = String (v), r = [];
	for (var i = 0; i < s.length % 3; i ++) {
		s = " " + s;
	}
	for (var i = 0; i < s.length; i += 3) {
		r.push (s.substr (i, 3));
	}
	return r.join (" ");
}
common.findObject = function (obj, keyObj) {
    var p, key, val, tRet;
    for (p in keyObj) {
        if (keyObj.hasOwnProperty (p)) {
            key = p;
            val = keyObj [p];
        }
    }
    for (p in obj) {
        if (p == key) {
            if (obj [p] == val) {
                return obj;
            }
        } else if (obj[p] instanceof Object) {
            if (obj.hasOwnProperty (p)) {
                tRet = common.findObject (obj [p], keyObj);
                if (tRet) {
                	return tRet;
                }
            }
        }
    }
    return false;
}
common.findMenuItem = function (m, opts) {
	var items = m.items;
	for (var i = 0; i < items.getCount (); i ++) {
		var item = items.getAt (i);
		var equal = true;
		_.each (opts, function (v, a) {
			if (v != item [a]) {
				equal = false;
			}
		});
		if (equal) {
			return item;
		}
		if (item.menu) {
			item = common.findMenuItem (item.menu, opts);
			if (item) {
				return item;
			}
		}
	}
}
common.updateMenuItemText = function (m, opts, text) {
	var item = common.findMenuItem (m, opts);
	if (item && item.setText) {
		item.setText (text);
	}
}
/*
	Строит отчет по шаблону
		format: "xmlss",
		template: "school-enter.xml"
			или
		template: fileField.objectId + "-" + fileField.ca.get ("id") + "-" + fileField.getValue ()
		files: true;
*/
common.reportTpl = function (opts) {
	if (opts.method == "post") {
		var reportUri =
			"report?storage=" + $o.code + "&" +
			"sessionId=" + $sessionId + "&" +
			"username=" + $o.currentUser + "&" +
			"time_offset_min=" + (new Date ()).getTimezoneOffset () + "&" +
			"format=" + opts.format + "&" +
			"template=" + opts.template
		;
		if (opts.files) {
			reportUri += "&files=" + opts.files;
		}
		var mapForm = document.createElement ("form");
	    mapForm.target = "Map";
	    mapForm.method = "POST";
	    mapForm.action = reportUri;

	    var mapInput = document.createElement ("input");
	    mapInput.type = "text";
	    mapInput.name = "opts";
	    mapInput.value = JSON.stringify (opts);
	    mapForm.appendChild (mapInput);

	    document.body.appendChild (mapForm);

	    map = window.open ("", "Map");
	    mapForm.submit ();
	} else {
		var reportUri = "report?";			
		var key;
		_.each (opts, function (v, a) {
			reportUri += a + "=" + v + "&";
		});
		reportUri +=
			"storage=" + $o.code + "&" +
			"sessionId=" + $sessionId + "&" +
			"username=" + $o.currentUser + "&" +
			"time_offset_min=" + (new Date ()).getTimezoneOffset ()
		;
		var w = window.open (reportUri);
		w.focus ();
	}
}
common.serverJob = function (opts) {
	opts = typeof (opts) == "string" ? {fn: opts} : opts;
	$o.execute ({fn: "service.job", args: opts, success: function (opts) {
		window.open ("/projects/" + $o.id + "/resources/html/" + opts.logFile, opts.logFile);
	}});
}

Ext.namespace (
	'system.object',
	'system.object_attr',
	'system.class_',
	'system.class_attr',
	'system.view',
	'system.view_attr',
	'system.revision',
	'system.LoginPassword',
	'spr.conf',
	'system.access',
	'$layout.card',
	'ose.role',
	'ose.srole',
	'ose.ext',
	'ose.object',
	'system.vo.menu',
	'system.vo.menuItems',
	'subject.human'
);
// Инициализация
system.init = function () {
	$zp.onLogin = function () {
		if ($VERSION_MAJOR == '3') {
			system.getObjNews ();
		}
	}
	$zp.onLogout = function () {
		common.window.closeAll ();
	}
	$zp.application.on ('ready', function () {
		// hash navigation
		function getHash () {
			var dlh = document.location.href;
			var h = dlh.split ('#');
			if (h.length == 2) {
				h = h [1];
				return h;
			} else {
				return '';
			};
		};
		$zp.hash = getHash ();
		if ($zp.hash) {
			if (!activatePage ($zp.hash)) {
				addPage ($zp.hash);
			};
		};
		function activatePage (h) {
			var items = $zp.application.mainPanel.items;
			for (var i = 0; i < items.getCount (); i ++) {
				var item = items.getAt (i);
				if (item.id == h) {
					$zp.application.mainPanel.setActiveTab (item.id);
					return true;
				};
			};
			return false;
		};
		function addPage (h) {
			if (h [0] == 'v') {
				var record = $zs.viewsMap [h.substr (1)];
				if (record) {
					try {
				    	$zp.application.onClickMenuItem.call ($zp.application, {
				    		record: record,
				    		text: record.stub.get ('name')
				    	});
				    } catch (e) {
						$o.app.show.call ($o.app, {record: record});
				    };
			    };
			} else
			if (h [0] == 'o') {
				var id = h.substr (1);
				var o = $zs.getObject (id);
				if (o) {
					system.object.show ({id: id});
				};
			};
		};
		function onHashChange () {
			var h = getHash ();
			if (h != $zp.hash) {
				if (!activatePage (h)) {
					addPage (h);
				};
				$zp.hash = h;
			};
			setTimeout (onHashChange, 200);
		};
		if ('onhashchange' in window) {
			window.onhashchange = onHashChange;
		} else {
			setTimeout (onHashChange, 200);
		};
		if (common.getConf ("maxIdleSec").used) {
			$o.maxIdleSec = common.getConf ("maxIdleSec").value;
		};
	});
	$zp.application.on ('viewlayout', common.window.onViewLayout);
};
// Отображение истории изменения атрибута
// options: {(id), (olap, attr), (objectId, classAttrId)}
system.object_attr.history = function (options) {
	options = options || {};
	var id;
	if (options.id) {
		id = options.id;
	} else 
	if (options.objectId) {
		var r = common.execSQL ({
			select: [
				{"a":"___fid"}, "id"
			],
			from: [
				{"a":"system.object_attr"}
			],
			where: [
				{"a":"___fend_id"}, "=", system.revision.maxRevision, "and",
				{"a":"___fobject_id"}, "=", options.objectId, "and",
				{"a":"___fclass_attr_id"}, "=", options.classAttrId
			]
		});
		if (r.length == 0) {
			return;
		}
		id = r.get (0, "id");
	} else {
		options.olap = options.olap || "olap";
		options.attr = options.attr || "id";
		id = this.relatives [options.olap].getCurrentValue (options.attr);
	}
	common.window.show.call (this, {
		id: id,
		asWindow: true,
		modal: true,
		title: $zr.getString ("History of changes"),
		iconCls: "event-log",
		cardFn: function (options) {
			var result = {
				olap: {
					id: "olap",
					view: "ser.system.objectAttrHistory",
					filter: ["fid", "=", options.id]
				}
			};
			return result;
		}
	});
}
system.revision.maxRevision = 2147483647;
// Зарегистрировать класс (для system.object.show)
// options: {classId, showFunc}
system.object.classes = {};
system.object.registerClass = function (options) {
	system.object.classes [options.classId] = {};
	system.object.classes [options.classId].showFunc = options.showFunc;
}
// Показать карточку объекта
// options: {id}
system.object.show = function (options) {
	var id = options.id;
	if (!id && options.olap && options.attr) {
		id = this.zview.getCurrentValue (options.olap, options.attr);
	}
	var o = $zs.getObject (id);
	var classObj = $o.getClass (o.get ("classId"));
	var classId = classObj.get ("id");
	if (system.object.classes [classId]) {
		system.object.classes [classId].showFunc.call (this, {id: id});
	} else {
		// Сформировать и показать карточку объекта
		common.window.show ({
			id: id,
			asWindow: true,
			modal: true,
			title: $zr.getString ("Object") + " ID: " + o.getId (),
			width: 800,
			height: 600,
			cardFn: function (options) {
				var o = $zs.getObject (options.id);
				var card = {
					card: {
						id: "objectCard",
						readOnly: true,
						fields: []
					}
				};
				for (var key in o.data) {
					if (key == "classId" || key == "id") {
						continue;
					}
					card.card.fields.push ({objectId: options.id, attr: key});
				}
				return card;
			}
		});
	}
}
system.view.chooseAll = function (options) {
	this.relatives [options.olap].selModel.selectAll ();
}
/*
	Выбор запроса
*/
system.view.selectQuery = function (options) {
	var me = this;
	var success = options.success;
	function getTreeRecord (view) {
		var rec = {
			text: view.toString ()
		};
		if (view.childs) {
			rec.expanded = 0;
			rec.children = [];
			for (var i = 0; i < view.childs.length; i ++) {
				rec.children.push (getTreeRecord ($o.viewsMap [view.childs [i]]));
			};
		} else {
			rec.leaf = 1;
		}
		return rec;
	};
	var root = [];
	for (var id in $o.viewsMap) {
		var v = $o.viewsMap [id];
		if (!v.get ("parent") && !v.get ("system")) {
			root.push (getTreeRecord ($o.viewsMap [id]));
		};
	};
	var treeStore = Ext.create ('Ext.data.TreeStore', {
	    root: {
	        expanded: true,
	        children: root
	    },
		sorters: [{
			property: "text",
			direction: "ASC"
		}]	        
	});
	var viewId;
	var win = Ext.create ("Ext.Window", {
		width: 800,
		height: 600,
		layout: "border",
		frame: false,
		border: false,
		style: "background-color: #ffffff",
		bodyStyle: "background-color: #ffffff",
		title: $o.getString ("Select", "query"),
		iconCls: "gi_cogwheel",
		bodyPadding: 5,
		modal: 1,
		tbar: [{
			text: $o.getString ("Choose"),
			iconCls: "gi_ok",
			name: "ok",
			disabled: 1,
			handler: function () {
				success ({value: viewId});
				win.close ();
			}
		}, {
			text: $o.getString ("Cancel"),
			iconCls: "gi_remove",
			handler: function () {
				win.close ();
			}
		}],
		items: [{
		    split: true,
		    region: "west",
			width: 400,
			layout: "fit",
			items: {
	    		xtype: "treepanel",
	    		title: $o.getString ("Views"),
	    		iconCls: "gi_eye_open",
			    store: treeStore,
			    rootVisible: false,
		    	border: 0,
		    	listeners: {
		    		select: function (srm, record, index, eOpts) {
		    			var hasQuery = 0;
		    			if (record) {
							var id = record.get ("text").split (":")[1].split (")")[0];
							var v = $o.getView (Number (id));
	    					win.down ("*[name=query]").setValue (v.get ("query") ? v.get ("query") : "");
	    					if (v.get ("query")) {
	    						hasQuery = 1;
	    					};
	    					viewId = v.get ("id");
		    			}
		    			if (hasQuery) {
		    				win.down ("*[name=ok]").enable ();
		    			} else {
		    				win.down ("*[name=ok]").disable ();
		    			};
		    		}
		    	}
		    }
		},{
		    region: "center",
			layout: "fit",
		    items: {
		    	title: $o.getString ("Query"),
		    	name: "query",
				iconCls: "gi_cogwheel",
				xtype: "codemirrortextarea",
				mode: "application/ld+json",
		    	border: 0
		    }
		}]
	});
	win.show ();
};
// Открывает представление в закладке
// {id}
system.view.showPanel = function (options) {
	var app = $zp.application;
	var record = $zs.views.get (options.id, {async: false});
	var pageId = 'View-' + record.stub.get ("id");
	var view = new objectum.ui.layout.ViewLayout ({
		border: false,
		record: record,
		bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';'
	});
	var layoutName = 'zviewlayout'; 
	if (!(pageId in app.openPages)) {
		var iconCls = record.iconCls;
		if (!iconCls && record.stub && record.stub.get ("iconCls")) {
			iconCls = record.stub.get ("iconCls");
		}
		app.openPages [pageId] = app.mainPanel.add ({
			id: pageId,
			xtype: "panel",
			layout: 'fit',
			node: 1,
			iconCls: iconCls,
			tabTip: null,
			title: record.stub.get ("name"),
			closable: true,
			bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';',
			items: [
				view
			]
		});
		app.mainPanel.doLayout ();
	};
	app.mainPanel.activate (app.openPages [pageId]);
}
system.class_.create = function (options) {
	var name = options.name;
	var code = options.code;
	var parent = options.parent;
	if (common.extMajorVersion () == 3) {
		var nodes = $zs.classesMap;
		for (var key in nodes) {
			if (parent == nodes [key].stub.get ("parent") && code == nodes [key].stub.get ("code")) {
				throw 'class with code "' + code + '" already exists';
			};
		};
		var stub = new objectum.server.Class ({
			code: code,
			name: name
		});
		if (parent) {
			stub.set ('parent', parent);
		};
		stub.commit ();
		var fields = [];
		var node = objectum.server.Object.create (fields);
		node.stub = stub;
		node.storage = $zs;
		node.storage.registerClass (node);
	} else {
		var c = $o.createClass ({
			name: name,
			code: code,
			parent: parent ? parent : null
		});
		c.sync ();
	};
};
// Создание атрибута класса
// options: {attr1: {classCode, name, typeCode}}
system.class_attr.create = function (options) {
	function createAttr (options) {
		if (common.extMajorVersion () == 3) {
			var a = new objectum.server.ClassAttr ({
				name: options.name,
				code: options.code,
				"class": options.classId,
				type: options.typeId
			});		
			a.commit ();
			a.storage = $zs;
			$zs.classAttrs [a.get ('id')] = a;
			var cls = $zs.classAttrsMap [a.get ('class')] || [];
			cls.push (a);
			$zs.classAttrsMap [a.get ('class')] = cls;
		} else {
			var ca = $o.createClassAttr ({
				name: options.name,
				code: options.code,
				"class": options.classId,
				type: options.typeId
			});
			ca.sync ();
		};
	};
	if (options.hasOwnProperty ("name")) {
		// single attr
		createAttr ({
			name: options.name,
			code: options.code,
			classId: options.classId,
			typeId: options.typeId
		});
	} else {
		// many attrs
		for (var attr in options) {
			createAttr ({
				name: options [attr].name,
				code: attr,
				classId: $zs.getClass (options [attr].classCode).stub.get ("id"),
				typeId: $zs.getClass (options [attr].typeCode).stub.get ("id")
			});
		};
	};
};
// Получение атрибутов класса
// options: {classCode or classId}}
system.class_attr.get = function (options) {
	var classId = options.classId || $zs.getClass (options.classCode).stub.get ("id");
	var r = common.execSQL ({
		select: [
			{"a":"___fid"}, "id",
			{"a":"___fcode"}, "code",
			{"a":"___fname"}, "name",
			{"a":"___ftype_id"}, "type_id"
		],
		from: [
			{"a":"system.class_attr"}
		],
		where: [
			{"a":"___fend_id"}, "=", system.revision.maxRevision, "and",
			{"a":"___fclass_id"}, "=", classId
		]
	});
	return r;
};
system.view.create = function (options) {
	var name = options.name;
	var code = options.code;
	var parent = options.parent;
	if (common.extMajorVersion () == 3) {
		var nodes = $zs.viewsMap;
		for (var key in nodes) {
			if (parent == nodes [key].stub.get ("parent") && code == nodes [key].stub.get ("code")) {
				throw 'view with code "' + code + '" already exists';
			};
		};
		var stub = new objectum.server.View ({
			code: code,
			name: name
		});
		stub.set ('materialized', 0);
		if (parent) {
			stub.set ('parent', parent);
		};
		stub.commit ();
		var fields = [];
		var node = objectum.server.View.create (fields);
		node.stub = stub;
		node.storage = $zs;
		node.storage.registerView (node);
	} else {
		var v = $o.createView ({
			name: name,
			code: code,
			materialized: 0,
			parent: parent ? parent : null
		});
		v.sync ();
	};
};
// Создание атрибута представления
// options: {attr1: {viewCode, name, area, width}}
system.view_attr.create = function (options) {
	function createAttr (options) {
		if (common.extMajorVersion () == 3) {
	    	var a = new objectum.server.ViewAttr ({
	    		name: options.name,
	    		code: options.code,
	    		view: options.viewId,
	    		order: options.order,
	    		area: options.area ? options.area : 0,
	    		width: options.width ? options.width : 75
	    	});    	
	    	a.commit ();
			a.storage = $zs;
			$zs.viewAttrs [a.get ('id')] = a;
			var view = $zs.viewAttrsMap [options.viewId] || [];
			view.push (a);
			$zs.viewAttrsMap [options.viewId] = view;
		} else {
			var va = $o.createViewAttr ({
	    		name: options.name,
	    		code: options.code,
	    		view: options.viewId,
	    		order: options.order,
	    		area: options.area ? options.area : 0,
	    		width: options.width ? options.width : 75
			});
			va.sync ();
		};
    };
    if (options.hasOwnProperty ("name")) {
		// single attr
		createAttr ({
			name: options.name,
			code: options.code,
			viewId: options.viewId,
			area: options.area,
			width: options.width
		});
    } else {
    	// many attrs
		for (var attr in options) {
			createAttr ({
	    		name: options [attr].name,
	    		code: attr,
	    		viewId: $zs.getView (options [attr].viewCode).stub.get ("id"),
	    		area: options [attr].area ? options [attr].area : 0,
	    		width: options [attr].width ? options [attr].width : 75
			});
		};
	};
};
// Получение атрибутов представления
// options: {viewCode or viewId}}
system.view_attr.get = function (options) {
	var viewId = options.viewId || $zs.getView (options.viewCode).stub.get ("id");
	var r = common.execSQL ({
		select: [
			{"a":"___fid"}, "id",
			{"a":"___fcode"}, "code",
			{"a":"___fname"}, "name",
			{"a":"___farea"}, "area"
		],
		from: [
			{"a":"system.view_attr"}
		],
		where: [
			{"a":"___fend_id"}, "=", system.revision.maxRevision, "and",
			{"a":"___fview_id"}, "=", viewId
		]
	});
	return r;
}
// Создает
spr.conf.create = function (options) {
	var parent = this.getCurrentValue ('id') || null;
    var id = obj.create.call (this, {
    	classCode: "spr.conf",
    	attrs: {
    		parent: parent
    	},
    	refresh: !options.silence
    });
    if (options.silence) {
		return id;
	} else {
		options.id = id;
	    spr.conf.show.call (this, options);
	}
}
// Удаляет
spr.conf.remove = function () {
	obj.remove.call (this, {id: this.getCurrentValue ("id"), refresh: true});
}
// Карточка
spr.conf.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "confCard",
			listeners: {
				afterSave: function () {
					if (common.data.hasOwnProperty ("spr.conf")) {
						var o = $zs.getObject (id);
						common.data ["spr.conf"][o.get ("code")] = {
							id: o.get ("id"),
							used: o.get ("used"),
							name: o.get ("name"),
							value: o.get ("value")
						}
					};
				}
			},
			fields: [
				{objectId: id, attr: "npp"},
				{objectId: id, attr: "name"},
				{objectId: id, attr: "code"},
				{objectId: id, attr: "used"},
				{objectId: id, attr: "value"},
				{objectId: id, attr: "description"},
				{objectId: id, attr: "parent", choose: {type: "view", id: "system.conf", attr: "olap.id", width: 600, height: 400}}
			]
		}
	};
	return card;
}
// Отображение карточки
spr.conf.show = function (options) {
	common.window.show.call (this, Ext.apply (options, {
		title: $zr.getString ("Option"),
		cardFn: spr.conf.card,
		iconCls: "gi_settings"
	}));
}
spr.conf.get = function (options) {
	var r = common.execSQL ({
		select: [
			{"a":"value"}, "value"
		],
		from: [
			{"a":"spr.conf"}
		],
		where: [
			{"a":"code"}, "=", options.code
		]
	});
	if (r.length) {
		return r.get (0, 'value');
	} else {
		return null;
	};
};
common.data = common.data || {};
common.data ["spr.conf"] = {};
common.loadConf = function (subject) {
	common.data ["spr.conf"][subject] = {};
	var r = common.execSQL ({
		select: [
			{"a":"id"}, "id",
			{"a":"code"}, "code",
			{"a":"used"}, "used",
			{"a":"name"}, "name",
			{"a":"value"}, "value",
			{"a":"subject"}, "subject"
		],
		from: [
			{"a":"spr.conf"}
		],
		where: subject ? [
			{"a":"subject"}, "=", subject
		] : [
			{"a":"subject"}, "is null"
		]
	});
	for (var i = 0; i < r.length; i ++) {
		common.data ["spr.conf"][subject][r.get (i, "code")] = {
			id: r.get (i, "id"),
			used: r.get (i, "used"),
			name: r.get (i, "name"),
			value: r.get (i, "value")
		}
	}
};
// Получить объект параметра через код
// options: {code}
common.getConf = function (options) {
	var subject = options.subject || null;
	if (!common.data ["spr.conf"][subject]) {
		common.loadConf (subject);
	};
	var code = typeof (options) == "string" ? options : options.code;
	var result = common.data ["spr.conf"][subject][code];
	if (result == null) {
		//console.log ("spr.conf.code:" + code + " not exist");
		result = {};
	};
	return result;
};
common.setConf = function (code, options) {
	if (!code) {
		return;
	};
	var subject = options.subject || null;
	var inTransaction = $o.inTransaction;
	var tr;
	if (!inTransaction) {
		tr = $o.startTransaction ({description: "setConf"});
	};
	var r = common.execSQL ({
		select: [
			{"a":"id"}, "id"
		],
		from: [
			{"a":"spr.conf"}
		],
		where: (subject ? [
			{"a":"subject"}, "=", subject
		] : [
			{"a":"subject"}, "is null"
		]).concat ("and", {"a":"code"}, "=", code)
	});
	var o;
	if (r.length) {
		o = $o.getObject (r.get (0, "id"));
	} else {
		o = $o.createObject ("spr.conf");
	};
	o.set ("code", code);
	for (var attr in options) {
		o.set (attr, options [attr]);
	};
	o.commit ();
	if (!inTransaction) {
		$o.commitTransaction (tr);
	};
	if (common.data ["spr.conf"][subject]) {
		common.data ["spr.conf"][subject][code] = {
			id: o.get ("id"),
			used: o.get ("used"),
			name: o.get ("name"),
			value: o.get ("value")
		};
	} else {
		common.loadConf (subject);
	};
};
// user var
common.setVar = function (name, value) {
	if (!name) {
		return;
	};
	var inTransaction = $o.inTransaction;
	var tr;
	if (!inTransaction) {
		tr = $o.startTransaction ({description: "setVar"});
	};
	var r = common.execSQL ({
		select: [
			{"a":"id"}, "id"
		],
		from: [
			{"a":"spr.conf"}
		],
		where: [
			{"a":"subject"}, "=", $userId ? $userId : 0, "and", {"a":"name"}, "=", name
		]
	});
	var o;
	if (r.length) {
		o = $zs.getObject (r.get (0, "id"));
	} else {
		o = $zs.createObject ("spr.conf");
	};
	o.set ("subject", $userId ? $userId : 0);
	o.set ("name", name);
	o.set ("value", value);
	o.commit ();
	if (!inTransaction) {
		$o.commitTransaction (tr);
	};
};
// user var
common.getVar = function (name) {
	if (!name) {
		return null;
	};
	var r = common.execSQL ({
		select: [
			{"a":"value"}, "value"
		],
		from: [
			{"a":"spr.conf"}
		],
		where: [
			{"a":"subject"}, "=", $userId ? $userId : 0, "and", {"a":"name"}, "=", name
		]
	});
	if (r.length) {
		return r.get (0, "value");
	} else {
		return null;
	};
};
// Список объектов к которым есть доступ
// {subjectId, classId, comma, read, write}
system.access.getObjects = function (options) {
	options = options || {};
	var result = [];
	var where;
	if (options.subjects) {
		where = [{"a":"subjectId"}, "in", options.subjects];
	} else {
		where = [{"a":"subjectId"}, "=", options.subjectId];
	}
	var sql = {
		select: [
			{"a":"objectId"}, "objectId",
			{"a":"read"}, "read",
			{"a":"write"}, "write"
		],
		from: [
			{"a":"system.access"},
			"inner-join", {"d":"system.object"}, "on", [
				{"a":"objectId"}, "=", {"d":"___fid"}, "and", 
				{"d":"___fend_id"}, "=", "2147483647", "and",
				{"d":"___fclass_id"}, "=", options.classId
			]
		],
		where: where
	};
	var r = common.execSQL (sql);
	for (var i = 0; i < r.length; i ++) {
		if ((options.read == true && !r.get (i, "read")) ||
			(options.read == false && r.get (i, "read")) ||
			(options.write == true && !r.get (i, "write")) ||
			(options.write == false && r.get (i, "write"))
		) {
			continue;
		}
		if (options.comma && result.length) {
			result.push (",");
		}
		if (options.detail) {
			result.push ({id: r.get (i, "objectId"), read: r.get (i, "read"), write: r.get (i, "write")});
		} else {
			result.push (r.get (i, "objectId"));
		}
	}
	return result;
}
system.xmlObj = null;
system.getObjNews = function (revision) {
	revision = revision || 0;
	if (!system.xmlObj) {
		if (window.XMLHttpRequest) {
			system.xmlObj = new XMLHttpRequest ();
		} else
		if (window.ActiveXObject) {
			system.xmlObj = new ActiveXObject ("Microsoft.XMLHTTP");
		}
	}        
	if (system.xmlObj) {
		system.xmlObj.open ('POST', '/objectum/obj_news?sessionId=' + $sessionId + '&mustget=' + Math.random (), true);
		system.xmlObj.onreadystatechange = function () {
			if (system.xmlObj.readyState == 4) {
				if (system.xmlObj.status == 401) {
					common.message ($o.getString ("Session not authorized. Please, reload browser page"));
				} else
				if (system.xmlObj.responseText) {
					var r = eval ("(" + system.xmlObj.responseText + ")");
					if (r.header.error == 'session removed') {
						Ext.Msg.alert ($ptitle, $zr.getString ('Session disabled'), function () {
							location.reload ();
						});
					};
					if (r.revision) {
						revision = r.revision;
						var objects = r.objects;
						for (var i = 0; i < objects.length; i ++) {
							delete $zs.objectsMap [objects [i]];
							$zp.application.fireEvent ('objectChanged', {id: objects [i]});
						}
					}
					if (r.message) {
						common.balloon (
							$zr.getString ("Server message"), 
							$zr.getString (r.message)
						);
					}
					system.getObjNews (revision);
					system.objNewsFails = 0;
				} else {
					system.objNewsFails = system.objNewsFails || 0;
					system.objNewsFails ++;
					//if (system.objNewsFails > 2) {
					//	common.message ("Отсутствует связь с сервером.");
					//} else {
						setTimeout ('system.getObjNews (' + revision + ')', 5000);	
					//};
				}
			};
		};
		system.xmlObj.send ($zs.id + ' ' + revision);
	}
}
Ext.ns ('Ext.ux.state')
Ext.ux.state.LocalStorage = function (config){
    Ext.ux.state.LocalStorage.superclass.constructor.call (this);
    Ext.apply (this, config);
    this.state = localStorage;
};
Ext.extend (Ext.ux.state.LocalStorage, Ext.state.Provider, {
    get : function (name, defaultValue){
        if (typeof this.state[name] == "undefined") {
            return defaultValue
        } else {
            return this.decodeValue (this.state [name])
        }
    },
    set : function (name, value){
        if (typeof value == "undefined" || value === null) {
        	try {
            	this.clear (name);
            } catch (e) {
            };
            return;
        }
        this.state [name] = this.encodeValue (value)
        this.fireEvent ("statechange", this, name, value);
    }
});
if (window.localStorage) {
    Ext.state.Manager.setProvider (new Ext.ux.state.LocalStorage ())
} else {
    var thirtyDays = new Date (new Date ().getTime () + (1000*60*60*24*30))
    Ext.state.Manager.setProvider (new Ext.state.CookieProvider ({expires: thirtyDays}))
}
system.LoginPassword.create = function () {
	var o = $o.createObject ("system.LoginPassword");
	o.commit ();
	this.refresh ();
};
system.LoginPassword.remove = function () {
	var id = this.getCurrentValue ("id");
	common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
		if (btn == "yes") {
			$o.startTransaction ({description: 'Remove ' + id});
			obj.remove.call (this, {id: id, refresh: true});
			$o.commitTransaction ();
		}
	}});
};
ose.role.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "ose.role.card",
			items: [{
				objectId: id, attr: "npp"
			}, {
				objectId: id, attr: "name"
			}, {
				objectId: id, attr: "code"
			}, {
				objectId: id, attr: "menu", choose: {type: "layout", attr: "olap.a_id",
					layout: {
						olap: {
							id: "olap",
							view: "system.vo.menu"
						}
					}
				}
			}]
		}
	};
	return card;
};
ose.srole.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "ose.srole.card",
			items: [{
				objectId: id, attr: "role", choose: {type: "layout", attr: "olap.id",
					layout: {
						olap: {
							id: "olap",
							view: "system.ose.role"
						}
					}
				}
			}, {
				objectId: id, attr: "subject", xtype: "numberfield"
			}]
		}
	};
	return card;
};
ose.ext.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "ose.ext.card",
			items: [{
				objectId: id, attr: "npp"
			}, {
				objectId: id, attr: "classAttr"
			}, {
				objectId: id, attr: "take"
			}, {
				objectId: id, attr: "give"
			}]
		}
	};
	return card;
};
ose.object.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "ose.object.card",
			items: [{
				objectId: id, attr: "class"
			}, {
				objectId: id, attr: "object"
			}, {
				objectId: id, attr: "subject", xtype: "numberfield"
			}, {
				objectId: id, attr: "read"
			}, {
				objectId: id, attr: "update"
			}, {
				objectId: id, attr: "delete"
			}]
		}
	};
	return card;
};
system.vo.menu.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "system.vo.menu.card",
			items: [{
				objectId: id, attr: "name"
			}, {
				objectId: id, attr: "position",
				xtype: "combo",
				name: "position",
				width: 300,
				triggerAction: "all",
				lazyRender: true,
				mode: "local",
				queryMode: "local",
				editable: false,
				store: new Ext.data.ArrayStore ({
					fields: ["id", "text"],
					data: [
						["top", $o.getString ("Top")],
						["left", $o.getString ("Left")],
						["bottom", $o.getString ("Bottom")],
						["right", $o.getString ("Right")]
					]
				}),
				valueField: "id",
				displayField: "text",
				style: "margin-top: 5px;"
			}, {
				objectId: id, attr: "large"
			}, {
				objectId: id, attr: "npp"
			}, {
				objectId: id, attr: "hidden"
			}]
		}
	};
	return card;
};
system.vo.menuItems.card = function (options) {
	var id = options.id;
	var o = $o.getObject (id);
    var card = {
    	tab: {
    		items: [{
				card: {
					id: "system.vo.menu.card",
					title: $o.getString ("Menu item"),
					items: [{
						objectId: id, attr: "view", xtype: "numberfield", hideLabel: true, style: "display: none"
					}, {
						xtype: "$conffield", 
						fieldLabel: $o.getString ("View"),
						name: "view", 
						value: o.get ("view"), 
						anchor: "-20",
						confRef: "view",
						choose: {
							type: "custom", fn: function () {
								var me = this;
								dialog.getView ({success: function (options) {
									me.setValue (options.id);
								}});
							}
						},
						listeners: {
							change: function () {
								this.up ("*[objectumCmp=card]").down ("*[attr=view]").setValue (this.getValue ());
								if (this.getValue ()) {
									this.up ("*[objectumCmp=card]").down ("*[name=action]").setValue (null);
									var view = $o.getView (this.getValue ());
									this.up ("*[objectumCmp=card]").down ("*[attr=name]").setValue (view.get ("name"));
									this.up ("*[objectumCmp=card]").down ("*[attr=iconCls]").setValue (view.get ("iconCls"));
								};
							}
						}
					}, {
						objectId: id, attr: "action", xtype: "numberfield", hideLabel: true, style: "display: none"
					}, {
						xtype: "$conffield", 
						fieldLabel: $o.getString ("Action"),
						name: "action", 
						value: o.get ("action"), 
						anchor: "-20",
						confRef: "action",
						choose: {
							type: "custom", fn: function () {
								var me = this;
								dialog.getAction ({success: function (options) {
									me.setValue (options.id);
								}});
							}
						},
						listeners: {
							change: function () {
								this.up ("*[objectumCmp=card]").down ("*[attr=action]").setValue (this.getValue ());
								if (this.getValue ()) {
									this.up ("*[objectumCmp=card]").down ("*[name=view]").setValue (null);
									var action = $o.getAction (this.getValue ());
									this.up ("*[objectumCmp=card]").down ("*[attr=name]").setValue (action.get ("name"));
								};
							}
						}
					}, {
						objectId: id, attr: "name"
					}, {
						objectId: id, attr: "description"
					}, {
						objectId: id, attr: "iconCls", xtype: "$iconselector"
					}, {
						objectId: id, attr: "npp"
					}, {
						objectId: id, attr: "hidden"
					}]
				}
			}, {
				"olap": {
					"id": "olapMenuItems",
					"title": $o.getString ("Child menu items"),
					"view": "system.vo.menuItems",
					"actions": [
						{
							"fn": "common.tpl.show",
							"text": $o.getString ("Open"),
							"arguments": {
								"asWindow": 1,
								"card": "system.vo.menuItems.card"
							},
							"iconCls": "gi_edit",
							"active": "common.recordSelected"
						},
						{
							"fn": "common.tpl.create",
							"text": $o.getString ("Add"),
							"arguments": {
								"asWindow": 1,
								"classCode": "system.vo.menuItems",
								"attrs": {
									"parent": id
								}
							},
							"iconCls": "gi_circle_plus"
						},
						{
							"fn": "common.tpl.remove",
							"text": $o.getString ("Remove"),
							"iconCls": "gi_circle_minus",
							"active": "common.recordSelected"
						}
					],
					"listeners": {
						"cellRenderer": "system.vo.menuItems.cellRenderer",
						"dblclick": {
							"fn": "common.tpl.show",
							"arguments": {
								"asWindow": 1,
								"card": "system.vo.menuItems.card"
							}
						}
					},
					"filter": [
						"a_parent", "=", id
					]
				}
			}]
		}
	};
	return card;
};
system.vo.menu.cellRenderer = function (value, metaData, record, rowIndex, colIndex, store) {
	if (record.get ("a_position") && metaData.column.dataIndex == "a_position") {
		switch (record.get ("a_position")) {
		case "top":
			value = $o.getString ("Top");
			break;
		case "left":
			value = $o.getString ("Left");
			break;
		case "bottom":
			value = $o.getString ("Bottom");
			break;
		case "right":
			value = $o.getString ("Right");
			break;
		};
	};
	return value;
};
system.vo.menuItems.cellRenderer = function (value, metaData, record, rowIndex, colIndex, store) {
	if (record.get ("a_view") && metaData.column.dataIndex == "a_view") {
		value = $o.getView (record.get ("a_view")).toString ();
	};
	if (record.get ("action") && metaData.column.dataIndex == "action") {
		value = $o.getAction (record.get ("action")).toString ();
	};
	return value;
};
subject.human.create = function (options) {
	common.tpl.create.call (this, Ext.apply (options, {
		asWindow: 1,
		classCode: "subject.human"
	}));
};
subject.human.card = function (options) {
	var me = this;
	var id = options.id;
	var r = common.execSQL ({
		select: [
			{"a":"id"}, "id",
			{"a":"role"}, "role"
		],
		from: [
			{"a":"ose.srole"}
		],
		where: [
			{"a":"subject"}, "=", id
		]
	});
	var roleId = null;
	if (r.length) {
		roleId = r.get (0, "role");
	};
    var card = {
		card: {
			id: "subject.human.card",
			listeners: {
				afterSave: function () {
					roleId = this.down ("*[name=role]").getValue ();
					var os;
					if (r.length) {
						os = $o.getObject (r.get (0, "id"));
					} else {
						os = $o.createObject ("ose.srole");
						os.set ("subject", id);
					};
					os.set ("role", roleId);
					os.sync ();
				}
			},
			items: [{
				objectId: id, attr: "surname"
			}, {
				objectId: id, attr: "forename"
			}, {
				objectId: id, attr: "patronymic"
			}, {
				objectId: id, attr: "birthday", timefield: 0
			}, {
				objectId: id, attr: "login"
			}, {
				objectId: id, attr: "password"
			}, {
				xtype: "$objectfield", name: "role", fieldLabel: "Роль", value: roleId, anchor: "-20", choose: {
					type: "layout", attr: "olap.id",
					layout: {
						olap: {
							id: "olap",
							view: "system.ose.role"
						}
					}
				}
			}]
		}
	};
	return card;
};
system.vo.chooseAdminMenu = function () {
	var me = this;
	var win = Ext.create ("Ext.Window", {
		width: 400,
		height: 100,
		layout: "form",
		frame: false,
		border: false,
		style: "background-color: #ffffff",
		bodyStyle: "background-color: #ffffff",
		title: $o.getString ("Admin menu"),
		iconCls: "gi_list",
		bodyPadding: 5,
		modal: 1,
		tbar: [{
			text: "Ок",
			iconCls: "gi_ok",
			handler: function () {
				common.setConf ("adminMenu", {
					name: $o.getString ("Admin menu"),
					value: win.down ("*[name=menu]").getValue ()
				});
				win.close ();
			}
		}, {
			text: $o.getString ("Cancel"),
			iconCls: "gi_remove",
			handler: function () {
				win.close ();
			}
		}],
		items: {
			xtype: "$objectfield",
			name: "menu",
			fieldLabel: $o.getString ("Menu"),
			value: common.getConf ("adminMenu").value,
			choose: {type: "layout", attr: "olap.a_id", layout: {
		        olap: {
		            id: "olap",
		            view: "system.vo.menu"
		        }
			}}
		}
	});
	win.show ();
};
system.vo.buildMenu = function () {
	var menuId;
	if ($o.currentUser == "admin") {
		menuId = common.getConf ("adminMenu").value;
	} else
	if ($o.currentUser == "autologin") {
		menuId = common.getConf ("autologinMenu").value;
	} else {
		var oUser = $o.getObject ($o.userId);
		if ($o.getClass (oUser.get ("classId")).getFullCode () == "subject.human.vo_adm") {
			menuId = common.getConf ("adminMenu").value;
		} else {
			menuId = $o.menuId;
		};
	};
	if (!menuId) {
		if (oUser.get ("voRole")) {
			var oRole = $o.getObject (oUser.get ("voRole"));
			if (oRole && oRole.get ("menu")) {
				menuId = oRole.get ("menu");
			} else {
				return common.message ($o.getString ("User has no role"));
			}
		} else {
			return common.message ($o.getString ("User has no role"));
		}
	};
	var m = common.execSQL ({
		select: [
			{"a":"id"}, "id",
			{"a":"position"}, "position",
			{"a":"large"}, "large"
		],
		from: [
			{"a":"system.vo.menu"}
		],
		where: [
			[{"a": "hidden"}, "is null", "or", {"a": "hidden"}, "=", 0], "and", {"a": "id"}, "=", menuId
		],
		order: [
			{"a": "npp"}, ",", {"a": "name"}
		]
	});
	var r = common.execSQL ({
		select: [
			{"a":"id"}, "id",
			{"a":"menu"}, "menu",
			{"a":"name"}, "name",
			{"a":"iconCls"}, "iconCls",
			{"a":"parent"}, "parent",
			{"a":"view"}, "view",
			{"a":"action"}, "action",
			{"a":"readOnly"}, "readOnly"
		],
		from: [
			{"a":"system.vo.menuItems"}
		],
		where: [
			{"a": "hidden"}, "is null", "or", {"a": "hidden"}, "=", 0
		],
		order: [
			{"a": "npp"}, ",", {"a": "name"}
		]
	});
	// preload actions
	var actions = [];
	for (var i = 0; i < r.length; i ++) {
		if (r.get (i, "action")) {
			actions.push (r.get (i, "action"));
		};
	};
	var actionRecs = [];
	if (actions.length) {
		actionRecs = $o.execute ({
			asArray: true,
			select: [
				{"a": "___fid"}, "id",
				{"a": "___fclass_id"}, "classId",
				{"a": "___fcode"}, "code"
			],
			from: [
				{"a": "system.action"}
			],
			where: [
				{"a": "___fid"}, "in", actions.join (".,.").split (".")
			]
		});
	};
	var menu = [];
	for (var i = 0; i < r.length; i ++) {
		if (r.get (i, "menu") == menuId && !r.get (i, "parent")) {
			var iconCls = r.get (i, "iconCls");
			if (iconCls && m.get (0, "large")) {
				iconCls = "gib" + iconCls.substr (2);
			};
			var o = {
				id: r.get (i, "id"),
				text: r.get (i, "name"),
				iconCls: iconCls,
				viewRecord: $o.getView (r.get (i, "view")),
				viewReadOnly: r.get (i, "readOnly"),
//				actionRecord: $o.getAction (r.get (i, "action")),
				actionId: r.get (i, "action"),
				handler: function () {
					if (this.viewRecord) {
						$o.app.show.call ($o.app, {
							record: this.viewRecord,
							readOnly: this.viewReadOnly
						});
					} else
					if (this.actionId) {
						var actionRec = _.findWhere (actionRecs, {id: this.actionId});
						if (actionRec) {
							var cls = $o.getClass (actionRec.classId);
							var _fn = (cls ? (cls.getFullCode () + ".") : "") + actionRec.code;
							_fn = eval (_fn);
							if (typeof (_fn) == "function") {
								_fn ({readOnly: this.viewReadOnly});
							};
						};
					};
				}
			};
			if (m.get (0, "large")) {
				o.iconAlign = "top";
				o.scale = "large";
				if (m.get (0, "position") == "left" || m.get (0, "position") == "right") {
					o.arrowAlign = "bottom";
					o.menuAlign = "tr";
					o.arrowCls = "arrow-right-white";
				};
			};
			menu.push (o);
		};
	};
	function getMenuElements (menu, parentId) {
		var items = [];
		for (var i = 0; i < r.length; i ++) {
			if (parentId == r.get (i, "parent")) {
				try {
					$o.getView (r.get (i, "view"));
				} catch (e) {
					console.log (r.get (i, "id"));
				};
				var o = {
					text: r.get (i, "name"),
					iconCls: r.get (i, "iconCls"),
					viewRecord: $o.getView (r.get (i, "view")),
					viewReadOnly: r.get (i, "readOnly"),
//					actionRecord: $o.getAction (r.get (i, "action")),
					actionId: r.get (i, "action"),
					handler: function () {
						if (this.viewRecord) {
							$o.app.show.call ($o.app, {
								record: this.viewRecord,
								readOnly: this.viewReadOnly
							});
						} else
						/*
						if (this.actionRecord) {
							this.actionRecord.execute ({readOnly: this.viewReadOnly});
						};
						*/
						if (this.actionId) {
							var actionRec = _.findWhere (actionRecs, {id: this.actionId});
							if (actionRec) {
								var cls = $o.getClass (actionRec.classId);
								var _fn = (cls ? (cls.getFullCode () + ".") : "") + actionRec.code;
								_fn = eval (_fn);
								if (typeof (_fn) == "function") {
									_fn ({readOnly: this.viewReadOnly});
								};
							};
						};
					}
				};
				getMenuElements (o, r.get (i, "id"));
				items.push (o);
			};
		};
		if (items.length) {
			menu.menu = {items: items};
		};
	};
	for (var j = 0; j < menu.length; j ++) {
		getMenuElements (menu [j], menu [j].id);
	};
	var o = {
		text: $o.getString ("Exit"),
		iconCls: "gi_exit",
		handler: function () {
			if ($o.userId) {
				$o.startTransaction ();
				var o = $o.getObject ($o.userId);
				o.set ("lastLogout", new Date ());
				o.sync ();
				$o.commitTransaction ();
			}
			$o.logout ({success: function () {
				location.reload ();
			}});
		}
	};
	if (m.get (0, "large")) {
		o.iconCls = "gib_exit";
		o.iconAlign = "top";
		o.scale = "large";
	};
	menu.push (o);
	if ($o.visualObjectum.timeMachine && $o.visualObjectum.timeMachine.showDates) {
		var date1 = new Date ();
		$o.visualObjectum.timeMachine.dates = $o.visualObjectum.timeMachine.dates || [];
		for (var i = 0; i < $o.visualObjectum.timeMachine.dates.length; i ++) {
			var d = $o.visualObjectum.timeMachine.dates [i].date;
			if (d.getTime () < date1.getTime ()) {
				date1 = d;
			};
		};
		menu.push ({
			xtype: "displayfield",
			value: $o.getString ("System date") + ":"
		}, {
			xtype: "datefield",
			minValue: date1,
			maxValue: new Date (),
			value: new Date (),
			width: 100,
			listeners: {
				render: function () {
					Ext.tip.QuickTipManager.register ({
						target: this.id,
						text: $o.getString ("View data in last dates"),
						width: 200,
						dismissDelay: 3000
					});			
				},
				change: function (f, nv) {
					var revisionId;
					var nJul = common.getJulianDay (nv);
					var cJul = common.getJulianDay (new Date ());
					if (nJul == cJul) {
						$o.setRevision ();
					} else {
						for (var i = $o.visualObjectum.timeMachine.dates.length - 1; i >= 0; i --) {
							var dJul = common.getJulianDay ($o.visualObjectum.timeMachine.dates [i].date);
							if (dJul <= nJul) {
								revisionId = $o.visualObjectum.timeMachine.dates [i].id;
							};
						};
						$o.setRevision (revisionId);
					};
				}
			}
		});
	};
	switch (m.get (0, "position")) {
	case "top":
		$o.app.tb.add (menu);
		$o.app.tb.doLayout ();
		break;
	case "left":
		$o.app.lb.add (menu);
		$o.app.lb.doLayout ();
		break;
	case "right":
		$o.app.rb.add (menu);
		$o.app.rb.doLayout ();
		break;
	case "bottom":
		$o.app.bb.add (menu);
		$o.app.bb.doLayout ();
		break;
	};
};
Ext.override (Ext.menu.Menu, {
    onMouseLeave: function (e) {
	    var me = this;
	    // BEGIN FIX
	    var visibleSubmenu = false;
	    me.items.each (function (item) { 
	        if (item.menu && item.menu.isVisible ()) { 
	            visibleSubmenu = true;
	        };
	    });
	    if (visibleSubmenu) {
	        //console.log('apply fix hide submenu');
	        return;
	    };
	    // END FIX
	    me.deactivateActiveItem ();
	    if (me.disabled) {
	        return;
	    };
	    me.fireEvent ("mouseleave", me, e);
    }
});
Ext.namespace ("subject.human.vo_adm");
subject.human.vo_adm.create = function (options) {
	common.tpl.create.call (this, {
		asWindow: 1,
		classCode: "subject.human.vo_adm",
		fn: function (o, options) {
			options.layout = subject.human.vo_adm.card.layout (o.get ("id"))
		}
	});
};
subject.human.vo_adm.card = function (options) {
	var me = this;
	var id = me.getValue ("id") || me.getValue ("a_id");
	common.tpl.show.call (this, {
		id: id,
		asWindow: 1,
		layout: subject.human.vo_adm.card.layout (id)
	});
};
subject.human.vo_adm.card.layout = function (id) {
	var l = {
		"card": {
			"id": "card",
			"items": [
				{
					"anchor": "100%",
					"fieldLabel": $o.getString ("Login"),
					"attr": "login",
					"objectId": id
				},
				{
					"anchor": "100%",
					"fieldLabel": $o.getString ("Password"),
					"attr": "password",
					"objectId": id
				},
				{
					"anchor": "100%",
					"fieldLabel": $o.getString ("Surname"),
					"attr": "surname",
					"objectId": id
				},
				{
					"anchor": "100%",
					"fieldLabel": $o.getString ("Forename"),
					"attr": "forename",
					"objectId": id
				},
				{
					"anchor": "100%",
					"fieldLabel": $o.getString ("Patronymic"),
					"attr": "patronymic",
					"objectId": id
				}
			]
		}
	};
	return l;
};


Ext.define ("ImportCSVObjects.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.importcsvobjects"],
	border: false,
	layout: "fit",
	defaults: {
		border: false
	},
    bodyPadding: 2,
    classId: null,
	initComponent: function () {
		var me = this;
		me.oCls = $o.getClass (me.classId);
		me.attrs = _.map (me.oCls.attrs, function (ca) {
			ca.set ("fullName", ca.get ("name") + " (" + ca.get ("code") + ")");
			return ca;
		});
		var filePanel = new Ext.Panel ({
			bodyStyle: 'background-color: white; padding: 5px;',
			border: false,
			html: '<input type="file" id="selectedFile">'
		});
		me.tbar = [{
			xtype: "combo",
			fieldLabel: $o.getString ("Encoding"),
			labelWidth: 65,
			width: 150,
			name: "coding",
			triggerAction: "all",
			lazyRender: true,
			mode: "local",
			queryMode: "local",
			store: {
				type: "json",
				fields: ["id", "name"],
				data: [{id: "utf8", name: "utf-8"}, {id: "win1251", name: "win-1251"}]
			},
			valueField: "id",
			displayField: "name",
			value: "utf8",
			editable: false
		}, filePanel, {
			text: $o.getString ("Load"),
			iconCls: "gi_table",
			name: "load",
			disabled: true,
			handler: function () {
				var inp = Ext.getDom ("selectedFile");
				var file = inp.files [0];
				var reader = new FileReader ();
				reader.onload = function () {
					var rows = reader.result.split ("\n");
					me.data = [];
					me.fields = [];
					_.each (rows, function (row, i) {
						var cells = row.split (";");
						var o = {};
						_.each (cells, function (s, j) {
							var s = s == null ? "" : s.trim ();
							if (!i) {
								me.fields.push ({
									name: s,
									code: "attr-" + j
								});
							} else {
								o ["attr-" + j] = s;
							}
						});
						if (i && cells.length && cells [0] != "") {
							me.data.push (o);
						}
					});
					if (me.fields.length && !me.fields [me.fields.length - 1].name) {
						me.fields.splice (me.fields.length - 1, 1);
					}
					var grid = me.down ("*[name=grid]");
		            grid.reconfigure ({
						xtype: "store",
						fields: _.map (me.fields, function (a) {
							return a.code;
						}),
						data: me.data
					}, _.map (me.fields, function (a) {
						return {
							text: a.name,
							dataIndex: a.code,
							width: 90
						};
					}));
		            grid.getStore ().loadData (me.data);
		            me.down ("*[name=recNum]").setValue (me.data.length);
					var items = _.map (me.fields, function (field) {
						var value;
						_.each (me.attrs, function (ca) {
							if (ca.get ("name") == field.name) {
								value = ca.get ("code");
							}
						});
						var o = {
							xtype: "combo",
							fieldLabel: field.name,
							name: field.code,
							triggerAction: "all",
							lazyRender: true,
							mode: "local",
							queryMode: "local",
							store: {
								type: "json",
								fields: ["id", "name"],
								data: _.map (me.attrs, function (ca) {
									return {id: ca.get ("code"), name: ca.get ("fullName")};
								})
							},
							valueField: "id",
							displayField: "name",
							editable: false,
							value: value,
							width: "100%"
						};
						return o;
					});
					me.down ("*[name=map]").removeAll ();
					me.down ("*[name=map]").add (items);
					me.down ("*[name=import]").setDisabled (false);
				};
				reader.readAsText (file, me.down ("*[name=coding]").getValue () == "utf8" ? "utf-8" : "windows-1251");
			}
		}, {
			text: $o.getString ("Import"),
			iconCls: "gi_file_import",
			name: "import",
			disabled: true,
			handler: function () {
				if (me.importer) {
					me.importer (me.data);
				} else {
					Ext.MessageBox.show ({
					    title: $o.getString ("Please wait"),
					    msg: $o.getString ("Action in progress") + " ...",
					    progressText: "",
					    width: 300,
					    progress: 1,
					    closable: 0
					});	
					setTimeout (function () {
						$o.startTransaction ();
						var map = {};
						_.each (me.fields, function (field) {
							var c = me.down ("*[name=" + field.code + "]");
							map [field.code] = c.getValue ();
						});
						var recs = [];
						var idAttr = me.down ("*[name=idAttr]").getValue ();
						if (idAttr) {
							recs = $o.execute ({
								asArray: true,
								select: [
									{"a": "id"}, "id",
									{"a": idAttr}, idAttr
								],
								from: [
									{"a": me.oCls.getFullCode ()}
								]
							});
						}
						var idMap = {};
						_.each (recs, function (rec) {
							idMap [rec [idAttr]] = rec.id;
						});
						async.reduce (me.data, 0, function (i, rec, cb) {
							var attrs = {};
							_.each (rec, function (v, a) {
								attrs [map [a]] = v;
							});
							var o;
							if (!idAttr || (idAttr && attrs [idAttr])) {
								if (idAttr) {
									if (idMap [attrs [idAttr]]) {
										o = $o.getObject (idMap [attrs [idAttr]]);
									} else {
										o = $o.createObject (me.classId);
									}
								} else {
									o = $o.createObject (me.classId);
								}
								_.each (attrs, function (v, a) {
									o.set (a, v);
								});
								o.sync ();
							}
							Ext.MessageBox.updateProgress (i / me.data.length, i + " / " + me.data.length);
					        setTimeout (function () {
					        	cb (null, i + 1);
					        }, 1);
					    }, function (err) {
							$o.commitTransaction ();
							Ext.MessageBox.hide ();
							me.fireEvent ("imported");
						});
					}, 100);
				}
			}
		}];
		me.items = {
			xtype: "tabpanel",
			items: [{
				title: $o.getString ("Field mapping"),
				layout: "vbox",
				name: "map",
				bodyPadding: 5,
				tbar: [{
					xtype: "textfield",
					fieldLabel: $o.getString ("Class"),
					labelWidth: 50,
					width: 400,
					disabled: true,
					value: me.oCls.toString ()
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Identifier"),
					name: "idAttr",
					triggerAction: "all",
					lazyRender: true,
					mode: "local",
					queryMode: "local",
					store: {
						type: "json",
						fields: ["id", "name"],
						data: _.map (me.attrs, function (ca) {
							return {id: ca.get ("code"), name: ca.get ("fullName")};
						})
					},
					width: 300,
					style: "margin-left: 5px",
					valueField: "id",
					displayField: "name",
					editable: false
				}],
				items: []
			}, {
				title: "CSV",
				xtype: "grid",
				name: "grid",
				tbar: [{
					xtype: "textfield",
					disabled: true,
					name: "recNum",
					fieldLabel: $o.getString ("Amount")
				}],
				store: {
					xtype: "store",
					fields: ["name"],
					data: []
				},
				columns: [{
					text: $o.getString ("Name"),
					dataIndex: "name",
					width: 90
				}],
				width: "100%",
				columnLines: true,
				rowLines: true
			}]
		};
		me.on ("afterrender", function () {
			Ext.get ("selectedFile").on ("change", function (e) {
				me.down ("*[name=load]").setDisabled (false);
			}, this);
		});
		me.addEvents ("imported");
		me.callParent (arguments);
	}
});

/**
* Allows GroupTab to render a table structure.
*/
Ext.define('Ext.ux.GroupTabRenderer', {
    alias: 'plugin.grouptabrenderer',
    extend: 'Ext.AbstractPlugin',

    tableTpl: new Ext.XTemplate(
        '<div id="{view.id}-body" class="' + Ext.baseCSSPrefix + '{view.id}-table ' + Ext.baseCSSPrefix + 'grid-table-resizer" style="{tableStyle}">',
            '{%',
                'values.view.renderRows(values.rows, values.viewStartIndex, out);',
            '%}',
        '</div>',
        {
            priority: 5
        }
    ),

    rowTpl: new Ext.XTemplate(
        '{%',
            'Ext.Array.remove(values.itemClasses, "', Ext.baseCSSPrefix + 'grid-row");',
            'var dataRowCls = values.recordIndex === -1 ? "" : " ' + Ext.baseCSSPrefix + 'grid-data-row";',
        '%}',
        '<div {[values.rowId ? ("id=\\"" + values.rowId + "\\"") : ""]} ',
            'data-boundView="{view.id}" ',
            'data-recordId="{record.internalId}" ',
            'data-recordIndex="{recordIndex}" ',
            'class="' + Ext.baseCSSPrefix + 'grouptab-row {[values.itemClasses.join(" ")]} {[values.rowClasses.join(" ")]}{[dataRowCls]}" ',
            '{rowAttr:attributes}>',
            '<tpl for="columns">' +
                '{%',
                    'parent.view.renderCell(values, parent.record, parent.recordIndex, xindex - 1, out, parent)',
                 '%}',
            '</tpl>',
        '</div>',
        {
            priority: 5
        }
    ),

    cellTpl: new Ext.XTemplate(
        '{%values.tdCls = values.tdCls.replace(" ' + Ext.baseCSSPrefix + 'grid-cell "," ");%}',
        '<div class="' + Ext.baseCSSPrefix + 'grouptab-cell {tdCls}" {tdAttr}>',
            '<div {unselectableAttr} class="' + Ext.baseCSSPrefix + 'grid-cell-inner" style="text-align: {align}; {style};">{value}</div>',
            '<div class="x-grouptabs-corner x-grouptabs-corner-top-left"></div>',
            '<div class="x-grouptabs-corner x-grouptabs-corner-bottom-left"></div>',
        '</div>',
        {
            priority: 5
        }
    ),

    selectors: {
        // Outer table
        bodySelector: 'div.' + Ext.baseCSSPrefix + 'grid-table-resizer',

        // Element which contains rows
        nodeContainerSelector: 'div.' + Ext.baseCSSPrefix + 'grid-table-resizer',

        // row
        itemSelector: 'div.' + Ext.baseCSSPrefix + 'grouptab-row',

        // row which contains cells as opposed to wrapping rows
        dataRowSelector: 'div.' + Ext.baseCSSPrefix + 'grouptab-row',

        // cell
        cellSelector: 'div.' + Ext.baseCSSPrefix + 'grouptab-cell', 

        getCellSelector: function(header) {
            var result = 'div.' + Ext.baseCSSPrefix + 'grid-cell';
            if (header) {
                result += '-' + header.getItemId();
            }
            return result;
        }

    },

    init: function(grid) {
        var view = grid.getView(), 
            me = this;
        view.addTableTpl(me.tableTpl);
        view.addRowTpl(me.rowTpl);
        view.addCellTpl(me.cellTpl);
        Ext.apply(view, me.selectors);
    }
});




/**
 * @author Nicolas Ferrero
 * A TabPanel with grouping support.
 */
Ext.define('Ext.ux.GroupTabPanel', {
    extend: 'Ext.Container',

    alias: 'widget.grouptabpanel',

    requires:[
        'Ext.tree.Panel',
        'Ext.ux.GroupTabRenderer'
    ],

    baseCls : Ext.baseCSSPrefix + 'grouptabpanel',

    initComponent: function(config) {
        var me = this;

        Ext.apply(me, config);

        // Processes items to create the TreeStore and also set up
        // "this.cards" containing the actual card items.
        me.store = me.createTreeStore();

        me.layout = {
            type: 'hbox',
            align: 'stretch'
        };
        me.defaults = {
            border: false
        };

        me.items = [{
            xtype: 'treepanel',
            cls: 'x-tree-panel x-grouptabbar',
            width: 150,
            rootVisible: false,
            store: me.store,
            hideHeaders: true,
            animate: false,
            processEvent: Ext.emptyFn,
            border: false,
            plugins: [{
                ptype: 'grouptabrenderer'
            }],
            viewConfig: {
                overItemCls: '',
                getRowClass: me.getRowClass
            },
            columns: [{
                xtype: 'treecolumn',
                sortable: false,
                dataIndex: 'text',
                flex: 1,
                renderer: function (value, cell, node, idx1, idx2, store, tree) {
                    var cls = '';

                    if (node.parentNode && node.parentNode.parentNode === null) {
                        cls += ' x-grouptab-first';
                        if (node.previousSibling) {
                            cls += ' x-grouptab-prev';
                        }
                        if (!node.get('expanded') || node.firstChild == null) {
                            cls += ' x-grouptab-last';
                        }
                    } else if (node.nextSibling === null) {
                        cls += ' x-grouptab-last';
                    } else {
                        cls += ' x-grouptab-center';
                    }
                    if (node.data.activeTab) {
                        cls += ' x-active-tab';
                    }
                    cell.tdCls= 'x-grouptab'+ cls;

                    return value;
                }
             }]
        }, {
            xtype: 'container',
            flex: 1,
            layout: 'card',
            activeItem: me.mainItem,
            baseCls: Ext.baseCSSPrefix + 'grouptabcontainer',
            items: me.cards
        }];

        me.addEvents(
            /**
             * @event beforetabchange
             * Fires before a tab change (activated by {@link #setActiveTab}). Return false in any listener to cancel
             * the tabchange
             * @param {Ext.ux.GroupTabPanel} grouptabPanel The GroupTabPanel
             * @param {Ext.Component} newCard The card that is about to be activated
             * @param {Ext.Component} oldCard The card that is currently active
             */
            'beforetabchange',

            /**
             * @event tabchange
             * Fires when a new tab has been activated (activated by {@link #setActiveTab}).
             * @param {Ext.ux.GroupTabPanel} grouptabPanel The GroupTabPanel
             * @param {Ext.Component} newCard The newly activated item
             * @param {Ext.Component} oldCard The previously active item
             */
            'tabchange',

            /**
             * @event beforegroupchange
             * Fires before a group change (activated by {@link #setActiveGroup}). Return false in any listener to cancel
             * the groupchange
             * @param {Ext.ux.GroupTabPanel} grouptabPanel The GroupTabPanel
             * @param {Ext.Component} newGroup The root group card that is about to be activated
             * @param {Ext.Component} oldGroup The root group card that is currently active
             */
            'beforegroupchange',

            /**
             * @event groupchange
             * Fires when a new group has been activated (activated by {@link #setActiveGroup}).
             * @param {Ext.ux.GroupTabPanel} grouptabPanel The GroupTabPanel
             * @param {Ext.Component} newGroup The newly activated root group item
             * @param {Ext.Component} oldGroup The previously active root group item
             */
            'groupchange'
        );

        me.callParent(arguments);
        me.setActiveTab(me.activeTab);
        me.setActiveGroup(me.activeGroup);
        me.mon(me.down('treepanel').getSelectionModel(), 'select', me.onNodeSelect, me);
    },

    getRowClass: function(node, rowIndex, rowParams, store) {
        var cls = '';
        if (node.data.activeGroup) {
           cls += ' x-active-group';
        }
        return cls;
    },

    /**
     * @private
     * Node selection listener.
     */
    onNodeSelect: function (selModel, node) {
        var me = this,
            currentNode = me.store.getRootNode(),
            parent;

        if (node.parentNode && node.parentNode.parentNode === null) {
            parent = node;
        } else {
            parent = node.parentNode;
        }

        if (me.setActiveGroup(parent.get('id')) === false || me.setActiveTab(node.get('id')) === false) {
            return false;
        }

        while (currentNode) {
            currentNode.set('activeTab', false);
            currentNode.set('activeGroup', false);
            currentNode = currentNode.firstChild || currentNode.nextSibling || currentNode.parentNode.nextSibling;
        }

        parent.set('activeGroup', true);
        parent.eachChild(function(child) {
            child.set('activeGroup', true);
        });
        node.set('activeTab', true);
        selModel.view.refresh();
    },

    /**
     * Makes the given component active (makes it the visible card in the GroupTabPanel's CardLayout)
     * @param {Ext.Component} cmp The component to make active
     */
    setActiveTab: function(cmp) {
        var me = this,
            newTab = cmp,
            oldTab;

        if(Ext.isString(cmp)) {
            newTab = Ext.getCmp(newTab);
        }

        if (newTab === me.activeTab) {
            return false;
        }

        oldTab = me.activeTab;
        if (me.fireEvent('beforetabchange', me, newTab, oldTab) !== false) {
             me.activeTab = newTab;
             if (me.rendered) {
                 me.down('container[baseCls=' + Ext.baseCSSPrefix + 'grouptabcontainer' + ']').getLayout().setActiveItem(newTab);
             }
             me.fireEvent('tabchange', me, newTab, oldTab);
         }
         return true;
    },

    /**
     * Makes the given group active
     * @param {Ext.Component} cmp The root component to make active.
     */
    setActiveGroup: function(cmp) {
        var me = this,
            newGroup = cmp,
            oldGroup;

        if(Ext.isString(cmp)) {
            newGroup = Ext.getCmp(newGroup);
        }

        if (newGroup === me.activeGroup) {
            return true;
        }

        oldGroup = me.activeGroup;
        if (me.fireEvent('beforegroupchange', me, newGroup, oldGroup) !== false) {
             me.activeGroup = newGroup;
             me.fireEvent('groupchange', me, newGroup, oldGroup);
         } else {
             return false;
         }
         return true;
    },

    /**
     * @private
     * Creates the TreeStore used by the GroupTabBar.
     */
    createTreeStore: function() {
        var me = this,
            groups = me.prepareItems(me.items),
            data = {
                text: '.',
                children: []
            },
            cards = me.cards = [];
        me.activeGroup = me.activeGroup || 0;
        
        Ext.each(groups, function(groupItem, idx) {
            var leafItems = groupItem.items.items,
                rootItem = (leafItems[groupItem.mainItem] || leafItems[0]),
                groupRoot = {
                    children: []
                };

            // Create the root node of the group
            groupRoot.id = rootItem.id;
            groupRoot.text = rootItem.title;
            groupRoot.iconCls = rootItem.iconCls;

            groupRoot.expanded = true;
            groupRoot.activeGroup = (me.activeGroup === idx);
            groupRoot.activeTab = groupRoot.activeGroup ? true : false;
            if (groupRoot.activeTab) {
                me.activeTab = groupRoot.id;
            }

            if (groupRoot.activeGroup) {
                me.mainItem = groupItem.mainItem || 0;
                me.activeGroup = groupRoot.id;
            }

            Ext.each(leafItems, function(leafItem) {
                // First node has been done
                if (leafItem.id !== groupRoot.id) {
                    var child = {
                        id: leafItem.id,
                        leaf: true,
                        text: leafItem.title,
                        iconCls: leafItem.iconCls,
                        activeGroup: groupRoot.activeGroup,
                        activeTab: false
                    };
                    groupRoot.children.push(child);
                }

                // Ensure the items do not get headers
                delete leafItem.title;
                delete leafItem.iconCls;
                cards.push(leafItem);
            });

            data.children.push(groupRoot);
      });

       return Ext.create('Ext.data.TreeStore', {
            fields: ['id', 'text', 'activeGroup', 'activeTab'],
            root: {
                expanded: true
            },
            proxy: {
                type: 'memory',
                data: data
            }
        });
    },

    /**
     * Returns the item that is currently active inside this GroupTabPanel.
     * @return {Ext.Component/Number} The currently active item
     */
    getActiveTab: function() {
        return this.activeTab;
    },

    /**
     * Returns the root group item that is currently active inside this GroupTabPanel.
     * @return {Ext.Component/Number} The currently active root group item
     */
    getActiveGroup: function() {
        return this.activeGroup;
    }
});

/**
 * A control that allows selection of multiple items in a list.
 */
Ext.define('Ext.ux.form.MultiSelect', {
    
    extend: 'Ext.form.FieldContainer',
    
    mixins: {
        bindable: 'Ext.util.Bindable',
        field: 'Ext.form.field.Field'    
    },
    
    alternateClassName: 'Ext.ux.Multiselect',
    alias: ['widget.multiselectfield', 'widget.multiselect'],
    
    requires: ['Ext.panel.Panel', 'Ext.view.BoundList', 'Ext.layout.container.Fit'],
    
    uses: ['Ext.view.DragZone', 'Ext.view.DropZone'],
    
    layout: 'anchor',
    
    /**
     * @cfg {String} [dragGroup=""] The ddgroup name for the MultiSelect DragZone.
     */

    /**
     * @cfg {String} [dropGroup=""] The ddgroup name for the MultiSelect DropZone.
     */
    
    /**
     * @cfg {String} [title=""] A title for the underlying panel.
     */
    
    /**
     * @cfg {Boolean} [ddReorder=false] Whether the items in the MultiSelect list are drag/drop reorderable.
     */
    ddReorder: false,

    /**
     * @cfg {Object/Array} tbar An optional toolbar to be inserted at the top of the control's selection list.
     * This can be a {@link Ext.toolbar.Toolbar} object, a toolbar config, or an array of buttons/button configs
     * to be added to the toolbar. See {@link Ext.panel.Panel#tbar}.
     */

    /**
     * @cfg {String} [appendOnly=false] `true` if the list should only allow append drops when drag/drop is enabled.
     * This is useful for lists which are sorted.
     */
    appendOnly: false,

    /**
     * @cfg {String} [displayField="text"] Name of the desired display field in the dataset.
     */
    displayField: 'text',

    /**
     * @cfg {String} [valueField="text"] Name of the desired value field in the dataset.
     */

    /**
     * @cfg {Boolean} [allowBlank=true] `false` to require at least one item in the list to be selected, `true` to allow no
     * selection.
     */
    allowBlank: true,

    /**
     * @cfg {Number} [minSelections=0] Minimum number of selections allowed.
     */
    minSelections: 0,

    /**
     * @cfg {Number} [maxSelections=Number.MAX_VALUE] Maximum number of selections allowed.
     */
    maxSelections: Number.MAX_VALUE,

    /**
     * @cfg {String} [blankText="This field is required"] Default text displayed when the control contains no items.
     */
    blankText: 'This field is required',

    /**
     * @cfg {String} [minSelectionsText="Minimum {0}item(s) required"] 
     * Validation message displayed when {@link #minSelections} is not met. 
     * The {0} token will be replaced by the value of {@link #minSelections}.
     */
    minSelectionsText: 'Minimum {0} item(s) required',
    
    /**
     * @cfg {String} [maxSelectionsText="Maximum {0}item(s) allowed"] 
     * Validation message displayed when {@link #maxSelections} is not met
     * The {0} token will be replaced by the value of {@link #maxSelections}.
     */
    maxSelectionsText: 'Maximum {0} item(s) required',

    /**
     * @cfg {String} [delimiter=","] The string used to delimit the selected values when {@link #getSubmitValue submitting}
     * the field as part of a form. If you wish to have the selected values submitted as separate
     * parameters rather than a single delimited parameter, set this to `null`.
     */
    delimiter: ',',
    
    /**
     * @cfg String [dragText="{0} Item{1}"] The text to show while dragging items.
     * {0} will be replaced by the number of items. {1} will be replaced by the plural
     * form if there is more than 1 item.
     */
    dragText: '{0} Item{1}',

    /**
     * @cfg {Ext.data.Store/Array} store The data source to which this MultiSelect is bound (defaults to `undefined`).
     * Acceptable values for this property are:
     * <div class="mdetail-params"><ul>
     * <li><b>any {@link Ext.data.Store Store} subclass</b></li>
     * <li><b>an Array</b> : Arrays will be converted to a {@link Ext.data.ArrayStore} internally.
     * <div class="mdetail-params"><ul>
     * <li><b>1-dimensional array</b> : (e.g., <tt>['Foo','Bar']</tt>)<div class="sub-desc">
     * A 1-dimensional array will automatically be expanded (each array item will be the combo
     * {@link #valueField value} and {@link #displayField text})</div></li>
     * <li><b>2-dimensional array</b> : (e.g., <tt>[['f','Foo'],['b','Bar']]</tt>)<div class="sub-desc">
     * For a multi-dimensional array, the value in index 0 of each item will be assumed to be the combo
     * {@link #valueField value}, while the value at index 1 is assumed to be the combo {@link #displayField text}.
     * </div></li></ul></div></li></ul></div>
     */
    
    ignoreSelectChange: 0,

    /**
     * @cfg {Object} listConfig
     * An optional set of configuration properties that will be passed to the {@link Ext.view.BoundList}'s constructor.
     * Any configuration that is valid for BoundList can be included.
     */

    initComponent: function(){
        var me = this;

        me.bindStore(me.store, true);
        if (me.store.autoCreated) {
            me.valueField = me.displayField = 'field1';
            if (!me.store.expanded) {
                me.displayField = 'field2';
            }
        }

        if (!Ext.isDefined(me.valueField)) {
            me.valueField = me.displayField;
        }
        me.items = me.setupItems();
        
        
        me.callParent();
        me.initField();
        me.addEvents('drop');    
    },
    
    setupItems: function() {
        var me = this;

        me.boundList = Ext.create('Ext.view.BoundList', Ext.apply({
            anchor: 'none 100%',
            deferInitialRefresh: false,
            border: 1,
            multiSelect: true,
            store: me.store,
            displayField: me.displayField,
            disabled: me.disabled
        }, me.listConfig));
        me.boundList.getSelectionModel().on('selectionchange', me.onSelectChange, me);
        
        // Only need to wrap the BoundList in a Panel if we have a title.
        if (!me.title) {
            return me.boundList;
        }

        // Wrap to add a title
        me.boundList.border = false;
        return {
            border: true,
            anchor: 'none 100%',
            layout: 'anchor',
            title: me.title,
            tbar: me.tbar,
            items: me.boundList
        };
    },

    onSelectChange: function(selModel, selections){
        if (!this.ignoreSelectChange) {
            this.setValue(selections);
        }    
    },
    
    getSelected: function(){
        return this.boundList.getSelectionModel().getSelection();
    },
    
    // compare array values
    isEqual: function(v1, v2) {
        var fromArray = Ext.Array.from,
            i = 0, 
            len;

        v1 = fromArray(v1);
        v2 = fromArray(v2);
        len = v1.length;

        if (len !== v2.length) {
            return false;
        }

        for(; i < len; i++) {
            if (v2[i] !== v1[i]) {
                return false;
            }
        }

        return true;
    },
    
    afterRender: function(){
        var me = this,
            records;
        
        me.callParent();
        if (me.selectOnRender) {
            records = me.getRecordsForValue(me.value);
            if (records.length) {
                ++me.ignoreSelectChange;
                me.boundList.getSelectionModel().select(records);
                --me.ignoreSelectChange;
            }
            delete me.toSelect;
        }    
        
        if (me.ddReorder && !me.dragGroup && !me.dropGroup){
            me.dragGroup = me.dropGroup = 'MultiselectDD-' + Ext.id();
        }

        if (me.draggable || me.dragGroup){
            me.dragZone = Ext.create('Ext.view.DragZone', {
                view: me.boundList,
                ddGroup: me.dragGroup,
                dragText: me.dragText
            });
        }
        if (me.droppable || me.dropGroup){
            me.dropZone = Ext.create('Ext.view.DropZone', {
                view: me.boundList,
                ddGroup: me.dropGroup,
                handleNodeDrop: function(data, dropRecord, position) {
                    var view = this.view,
                        store = view.getStore(),
                        records = data.records,
                        index;

                    // remove the Models from the source Store
                    data.view.store.remove(records);

                    index = store.indexOf(dropRecord);
                    if (position === 'after') {
                        index++;
                    }
                    store.insert(index, records);
                    view.getSelectionModel().select(records);
                    me.fireEvent('drop', me, records);
                }
            });
        }
    },
    
    isValid : function() {
        var me = this,
            disabled = me.disabled,
            validate = me.forceValidation || !disabled;
            
        
        return validate ? me.validateValue(me.value) : disabled;
    },
    
    validateValue: function(value) {
        var me = this,
            errors = me.getErrors(value),
            isValid = Ext.isEmpty(errors);
            
        if (!me.preventMark) {
            if (isValid) {
                me.clearInvalid();
            } else {
                me.markInvalid(errors);
            }
        }

        return isValid;
    },
    
    markInvalid : function(errors) {
        // Save the message and fire the 'invalid' event
        var me = this,
            oldMsg = me.getActiveError();
        me.setActiveErrors(Ext.Array.from(errors));
        if (oldMsg !== me.getActiveError()) {
            me.updateLayout();
        }
    },

    /**
     * Clear any invalid styles/messages for this field.
     *
     * __Note:__ this method does not cause the Field's {@link #validate} or {@link #isValid} methods to return `true`
     * if the value does not _pass_ validation. So simply clearing a field's errors will not necessarily allow
     * submission of forms submitted with the {@link Ext.form.action.Submit#clientValidation} option set.
     */
    clearInvalid : function() {
        // Clear the message and fire the 'valid' event
        var me = this,
            hadError = me.hasActiveError();
        me.unsetActiveError();
        if (hadError) {
            me.updateLayout();
        }
    },
    
    getSubmitData: function() {
        var me = this,
            data = null,
            val;
        if (!me.disabled && me.submitValue && !me.isFileUpload()) {
            val = me.getSubmitValue();
            if (val !== null) {
                data = {};
                data[me.getName()] = val;
            }
        }
        return data;
    },

    /**
     * Returns the value that would be included in a standard form submit for this field.
     *
     * @return {String} The value to be submitted, or `null`.
     */
    getSubmitValue: function() {
        var me = this,
            delimiter = me.delimiter,
            val = me.getValue();
        
        return Ext.isString(delimiter) ? val.join(delimiter) : val;
    },
    
    getValue: function(){
        return this.value || [];
    },
    
    getRecordsForValue: function(value){
        var me = this,
            records = [],
            all = me.store.getRange(),
            valueField = me.valueField,
            i = 0,
            allLen = all.length,
            rec,
            j,
            valueLen;
            
        for (valueLen = value.length; i < valueLen; ++i) {
            for (j = 0; j < allLen; ++j) {
                rec = all[j];   
                if (rec.get(valueField) == value[i]) {
                    records.push(rec);
                }
            }    
        }
            
        return records;
    },
    
    setupValue: function(value){
        var delimiter = this.delimiter,
            valueField = this.valueField,
            i = 0,
            out,
            len,
            item;
            
        if (Ext.isDefined(value)) {
            if (delimiter && Ext.isString(value)) {
                value = value.split(delimiter);
            } else if (!Ext.isArray(value)) {
                value = [value];
            }
        
            for (len = value.length; i < len; ++i) {
                item = value[i];
                if (item && item.isModel) {
                    value[i] = item.get(valueField);
                }
            }
            out = Ext.Array.unique(value);
        } else {
            out = [];
        }
        return out;
    },
    
    setValue: function(value){
        var me = this,
            selModel = me.boundList.getSelectionModel(),
            store = me.store;

        // Store not loaded yet - we cannot set the value
        if (!store.getCount()) {
            store.on({
                load: Ext.Function.bind(me.setValue, me, [value]),
                single: true
            });
            return;
        }

        value = me.setupValue(value);
        me.mixins.field.setValue.call(me, value);
        
        if (me.rendered) {
            ++me.ignoreSelectChange;
            selModel.deselectAll();
            selModel.select(me.getRecordsForValue(value));
            --me.ignoreSelectChange;
        } else {
            me.selectOnRender = true;
        }
    },
    
    clearValue: function(){
        this.setValue([]);    
    },
    
    onEnable: function(){
        var list = this.boundList;
        this.callParent();
        if (list) {
            list.enable();
        }
    },
    
    onDisable: function(){
        var list = this.boundList;
        this.callParent();
        if (list) {
            list.disable();
        }
    },
    
    getErrors : function(value) {
        var me = this,
            format = Ext.String.format,
            errors = [],
            numSelected;

        value = Ext.Array.from(value || me.getValue());
        numSelected = value.length;

        if (!me.allowBlank && numSelected < 1) {
            errors.push(me.blankText);
        }
        if (numSelected < me.minSelections) {
            errors.push(format(me.minSelectionsText, me.minSelections));
        }
        if (numSelected > me.maxSelections) {
            errors.push(format(me.maxSelectionsText, me.maxSelections));
        }
        return errors;
    },
    
    onDestroy: function(){
        var me = this;
        
        me.bindStore(null);
        Ext.destroy(me.dragZone, me.dropZone);
        me.callParent();
    },
    
    onBindStore: function(store){
        var boundList = this.boundList;
        
        if (boundList) {
            boundList.bindStore(store);
        }
    }
    
});

/**
 * FiltersFeature is a grid {@link Ext.grid.feature.Feature feature} that allows for a slightly more
 * robust representation of filtering than what is provided by the default store.
 *
 * Filtering is adjusted by the user using the grid's column header menu (this menu can be
 * disabled through configuration). Through this menu users can configure, enable, and
 * disable filters for each column.
 *
 * #Features#
 *
 * ##Filtering implementations:##
 *
 * Default filtering for Strings, Numeric Ranges, Date Ranges, Lists (which can be backed by a
 * {@link Ext.data.Store}), and Boolean. Additional custom filter types and menus are easily
 * created by extending {@link Ext.ux.grid.filter.Filter}.
 *
 * ##Graphical Indicators:##
 *
 * Columns that are filtered have {@link #filterCls a configurable css class} applied to the column headers.
 *
 * ##Automatic Reconfiguration:##
 *
 * Filters automatically reconfigure when the grid 'reconfigure' event fires.
 *
 * ##Stateful:##
 *
 * Filter information will be persisted across page loads by specifying a `stateId`
 * in the Grid configuration.
 *
 * The filter collection binds to the {@link Ext.grid.Panel#beforestaterestore beforestaterestore}
 * and {@link Ext.grid.Panel#beforestatesave beforestatesave} events in order to be stateful.
 *
 * ##GridPanel Changes:##
 *
 * - A `filters` property is added to the GridPanel using this feature.
 * - A `filterupdate` event is added to the GridPanel and is fired upon onStateChange completion.
 *
 * ##Server side code examples:##
 *
 * - [PHP](http://www.vinylfox.com/extjs/grid-filter-php-backend-code.php) - (Thanks VinylFox)
 * - [Ruby on Rails](http://extjs.com/forum/showthread.php?p=77326#post77326) - (Thanks Zyclops)
 * - [Ruby on Rails](http://extjs.com/forum/showthread.php?p=176596#post176596) - (Thanks Rotomaul)
 *
 * #Example usage:#
 *
 *     var store = Ext.create('Ext.data.Store', {
 *         pageSize: 15
 *         ...
 *     });
 *
 *     var filtersCfg = {
 *         ftype: 'filters',
 *         autoReload: false, //don't reload automatically
 *         local: true, //only filter locally
 *         // filters may be configured through the plugin,
 *         // or in the column definition within the headers configuration
 *         filters: [{
 *             type: 'numeric',
 *             dataIndex: 'id'
 *         }, {
 *             type: 'string',
 *             dataIndex: 'name'
 *         }, {
 *             type: 'numeric',
 *             dataIndex: 'price'
 *         }, {
 *             type: 'date',
 *             dataIndex: 'dateAdded'
 *         }, {
 *             type: 'list',
 *             dataIndex: 'size',
 *             options: ['extra small', 'small', 'medium', 'large', 'extra large'],
 *             phpMode: true
 *         }, {
 *             type: 'boolean',
 *             dataIndex: 'visible'
 *         }]
 *     };
 *
 *     var grid = Ext.create('Ext.grid.Panel', {
 *          store: store,
 *          columns: ...,
 *          features: [filtersCfg],
 *          height: 400,
 *          width: 700,
 *          bbar: Ext.create('Ext.PagingToolbar', {
 *              store: store
 *          })
 *     });
 *
 *     // a filters property is added to the GridPanel
 *     grid.filters
 */
Ext.define('Ext.ux.grid.FiltersFeature', {
    extend: 'Ext.grid.feature.Feature',
    alias: 'feature.filters',
    uses: [
        'Ext.ux.grid.menu.ListMenu',
        'Ext.ux.grid.menu.RangeMenu',
        'Ext.ux.grid.filter.BooleanFilter',
        'Ext.ux.grid.filter.DateFilter',
        'Ext.ux.grid.filter.DateTimeFilter',
        'Ext.ux.grid.filter.ListFilter',
        'Ext.ux.grid.filter.NumericFilter',
        'Ext.ux.grid.filter.StringFilter'
    ],

    /**
     * @cfg {Boolean} autoReload
     * Defaults to true, reloading the datasource when a filter change happens.
     * Set this to false to prevent the datastore from being reloaded if there
     * are changes to the filters.  See <code>{@link #updateBuffer}</code>.
     */
    autoReload : true,
    /**
     * @cfg {Boolean} encode
     * Specify true for {@link #buildQuery} to use Ext.util.JSON.encode to
     * encode the filter query parameter sent with a remote request.
     * Defaults to false.
     */
    /**
     * @cfg {Array} filters
     * An Array of filters config objects. Refer to each filter type class for
     * configuration details specific to each filter type. Filters for Strings,
     * Numeric Ranges, Date Ranges, Lists, and Boolean are the standard filters
     * available.
     */
    /**
     * @cfg {String} filterCls
     * The css class to be applied to column headers with active filters.
     * Defaults to <tt>'ux-filterd-column'</tt>.
     */
    filterCls : 'ux-filtered-column',
    /**
     * @cfg {Boolean} local
     * <tt>true</tt> to use Ext.data.Store filter functions (local filtering)
     * instead of the default (<tt>false</tt>) server side filtering.
     */
    local : false,
    /**
     * @cfg {String} menuFilterText
     * defaults to <tt>'Filters'</tt>.
     */
    menuFilterText : 'Filters',
    /**
     * @cfg {String} paramPrefix
     * The url parameter prefix for the filters.
     * Defaults to <tt>'filter'</tt>.
     */
    paramPrefix : 'filter',
    /**
     * @cfg {Boolean} showMenu
     * Defaults to true, including a filter submenu in the default header menu.
     */
    showMenu : true,
    /**
     * @cfg {String} stateId
     * Name of the value to be used to store state information.
     */
    stateId : undefined,
    /**
     * @cfg {Number} updateBuffer
     * Number of milliseconds to defer store updates since the last filter change.
     */
    updateBuffer : 500,

    // doesn't handle grid body events
    hasFeatureEvent: false,


    /** @private */
    constructor : function (config) {
        var me = this;

        me.callParent(arguments);

        me.deferredUpdate = Ext.create('Ext.util.DelayedTask', me.reload, me);

        // Init filters
        me.filters = me.createFiltersCollection();
        me.filterConfigs = config.filters;
    },

    init: function(grid) {
        var me = this,
            view = me.view,
            headerCt = view.headerCt;

        me.bindStore(view.getStore(), true);

        // Listen for header menu being created
        headerCt.on('menucreate', me.onMenuCreate, me);

        view.on('refresh', me.onRefresh, me);
        grid.on({
            scope: me,
            beforestaterestore: me.applyState,
            beforestatesave: me.saveState,
            beforedestroy: me.destroy
        });

        // Add event and filters shortcut on grid panel
        grid.filters = me;
        grid.addEvents('filterupdate');
    },

    createFiltersCollection: function () {
        return Ext.create('Ext.util.MixedCollection', false, function (o) {
            return o ? o.dataIndex : null;
        });
    },

    /**
     * @private Create the Filter objects for the current configuration, destroying any existing ones first.
     */
    createFilters: function() {
        var me = this,
            hadFilters = me.filters.getCount(),
            grid = me.getGridPanel(),
            filters = me.createFiltersCollection(),
            model = grid.store.model,
            fields = model.prototype.fields,
            field,
            filter,
            state;

        if (hadFilters) {
            state = {};
            me.saveState(null, state);
        }

        function add (dataIndex, config, filterable) {
            if (dataIndex && (filterable || config)) {
                field = fields.get(dataIndex);
                filter = {
                    dataIndex: dataIndex,
                    type: (field && field.type && field.type.type) || 'auto'
                };

                if (Ext.isObject(config)) {
                    Ext.apply(filter, config);
                }

                filters.replace(filter);
            }
        }

        // We start with filters from our config
        Ext.Array.each(me.filterConfigs, function (filterConfig) {
            add(filterConfig.dataIndex, filterConfig);
        });

        // Then we merge on filters from the columns in the grid. The columns' filters take precedence.
        Ext.Array.each(grid.columnManager.getColumns(), function (column) {
            if (column.filterable === false) {
                filters.removeAtKey(column.dataIndex);
            } else {
                add(column.dataIndex, column.filter, column.filterable);
            }
        });
        

        me.removeAll();
        if (filters.items) {
            me.initializeFilters(filters.items);
        }

        if (hadFilters) {
            me.applyState(null, state);
        }
    },

    /**
     * @private
     */
    initializeFilters: function(filters) {
        var me = this,
            filtersLength = filters.length,
            i, filter, FilterClass;

        for (i = 0; i < filtersLength; i++) {
            filter = filters[i];
            if (filter) {
                FilterClass = me.getFilterClass(filter.type);
                filter = filter.menu ? filter : new FilterClass(Ext.apply({
                    grid: me.grid
                }, filter));
                me.filters.add(filter);
                Ext.util.Observable.capture(filter, this.onStateChange, this);
            }
        }
    },

    /**
     * @private Handle creation of the grid's header menu. Initializes the filters and listens
     * for the menu being shown.
     */
    onMenuCreate: function(headerCt, menu) {
        var me = this;
        me.createFilters();
        menu.on('beforeshow', me.onMenuBeforeShow, me);
    },

    /**
     * @private Handle showing of the grid's header menu. Sets up the filter item and menu
     * appropriate for the target column.
     */
    onMenuBeforeShow: function(menu) {
        var me = this,
            menuItem, filter;

        if (me.showMenu) {
            menuItem = me.menuItem;
            if (!menuItem || menuItem.isDestroyed) {
                me.createMenuItem(menu);
                menuItem = me.menuItem;
            }

            filter = me.getMenuFilter();

            if (filter) {
                menuItem.setMenu(filter.menu, false);
                menuItem.setChecked(filter.active);
                // disable the menu if filter.disabled explicitly set to true
                menuItem.setDisabled(filter.disabled === true);
            }
            menuItem.setVisible(!!filter);
            this.sep.setVisible(!!filter);
        }
    },


    createMenuItem: function(menu) {
        var me = this;
        me.sep  = menu.add('-');
        me.menuItem = menu.add({
            checked: false,
            itemId: 'filters',
            text: me.menuFilterText,
            listeners: {
                scope: me,
                checkchange: me.onCheckChange,
                beforecheckchange: me.onBeforeCheck
            }
        });
    },

    getGridPanel: function() {
        return this.view.up('gridpanel');
    },

    /**
     * @private
     * Handler for the grid's beforestaterestore event (fires before the state of the
     * grid is restored).
     * @param {Object} grid The grid object
     * @param {Object} state The hash of state values returned from the StateProvider.
     */
    applyState : function (grid, state) {
        var me = this,
            key, filter;
        me.applyingState = true;
        me.clearFilters();
        if (state.filters) {
            for (key in state.filters) {
                if (state.filters.hasOwnProperty(key)) {
                    filter = me.filters.get(key);
                    if (filter) {
                        filter.setValue(state.filters[key]);
                        filter.setActive(true);
                    }
                }
            }
        }
        me.deferredUpdate.cancel();
        if (me.local) {
            me.reload();
        }
        delete me.applyingState;
        delete state.filters;
    },

    /**
     * Saves the state of all active filters
     * @param {Object} grid
     * @param {Object} state
     * @return {Boolean}
     */
    saveState : function (grid, state) {
        var filters = {};
        this.filters.each(function (filter) {
            if (filter.active) {
                filters[filter.dataIndex] = filter.getValue();
            }
        });
        return (state.filters = filters);
    },

    /**
     * @private
     * Handler called by the grid 'beforedestroy' event
     */
    destroy : function () {
        var me = this;
        Ext.destroyMembers(me, 'menuItem', 'sep');
        me.removeAll();
        me.clearListeners();
    },

    /**
     * Remove all filters, permanently destroying them.
     */
    removeAll : function () {
        if(this.filters){
            Ext.destroy.apply(Ext, this.filters.items);
            // remove all items from the collection
            this.filters.clear();
        }
    },


    /**
     * Changes the data store bound to this view and refreshes it.
     * @param {Ext.data.Store} store The store to bind to this view
     */
    bindStore : function(store) {
        var me = this;

        // Unbind from the old Store
        if (me.store && me.storeListeners) {
            me.store.un(me.storeListeners);
        }

        // Set up correct listeners
        if (store) {
            me.storeListeners = {
                scope: me
            };
            if (me.local) {
                me.storeListeners.load = me.onLoad;
            } else {
                me.storeListeners['before' + (store.buffered ? 'prefetch' : 'load')] = me.onBeforeLoad;
            }
            store.on(me.storeListeners);
        } else {
            delete me.storeListeners;
        }
        me.store = store;
    },

    /**
     * @private
     * Get the filter menu from the filters MixedCollection based on the clicked header
     */
    getMenuFilter : function () {
        var header = this.view.headerCt.getMenu().activeHeader;
        return header ? this.filters.get(header.dataIndex) : null;
    },

    /** @private */
    onCheckChange : function (item, value) {
        this.getMenuFilter().setActive(value);
    },

    /** @private */
    onBeforeCheck : function (check, value) {
        return !value || this.getMenuFilter().isActivatable();
    },

    /**
     * @private
     * Handler for all events on filters.
     * @param {String} event Event name
     * @param {Object} filter Standard signature of the event before the event is fired
     */
    onStateChange : function (event, filter) {
        if (event !== 'serialize') {
            var me = this,
                grid = me.getGridPanel();

            if (filter == me.getMenuFilter()) {
                me.menuItem.setChecked(filter.active, false);
            }

            if ((me.autoReload || me.local) && !me.applyingState) {
                me.deferredUpdate.delay(me.updateBuffer);
            }
            me.updateColumnHeadings();

            if (!me.applyingState) {
                grid.saveState();
            }
            grid.fireEvent('filterupdate', me, filter);
        }
    },

    /**
     * @private
     * Handler for store's beforeload event when configured for remote filtering
     * @param {Object} store
     * @param {Object} options
     */
    onBeforeLoad : function (store, options) {
        options.params = options.params || {};
        this.cleanParams(options.params);
        var params = this.buildQuery(this.getFilterData());
        Ext.apply(options.params, params);
    },

    /**
     * @private
     * Handler for store's load event when configured for local filtering
     * @param {Object} store
     */
    onLoad : function (store) {
        store.filterBy(this.getRecordFilter());
    },

    /**
     * @private
     * Handler called when the grid's view is refreshed
     */
    onRefresh : function () {
        this.updateColumnHeadings();
    },

    /**
     * Update the styles for the header row based on the active filters
     */
    updateColumnHeadings : function () {
        var me = this,
            headerCt = me.view.headerCt;
        if (headerCt) {
            headerCt.items.each(function(header) {
                var filter = me.getFilter(header.dataIndex);
                header[filter && filter.active ? 'addCls' : 'removeCls'](me.filterCls);
            });
        }
    },

    /** @private */
    reload : function () {
        var me = this,
            store = me.view.getStore();

        if (me.local) {
            store.clearFilter(true);
            store.filterBy(me.getRecordFilter());
            store.sort();
        } else {
            me.deferredUpdate.cancel();
            if (store.buffered) {
                store.data.clear();
            }
            store.loadPage(1);
        }
    },

    /**
     * Method factory that generates a record validator for the filters active at the time
     * of invokation.
     * @private
     */
    getRecordFilter : function () {
        var f = [], len, i,
            lockingPartner = this.lockingPartner;

        this.filters.each(function (filter) {
            if (filter.active) {
                f.push(filter);
            }
        });

        // Be sure to check the active filters on a locking partner as well.
        if (lockingPartner) {
            lockingPartner.filters.each(function (filter) {
                if (filter.active) {
                    f.push(filter);
                }
            });
        }

        len = f.length;
        return function (record) {
            for (i = 0; i < len; i++) {
                if (!f[i].validateRecord(record)) {
                    return false;
                }
            }
            return true;
        };
    },

    /**
     * Adds a filter to the collection and observes it for state change.
     * @param {Object/Ext.ux.grid.filter.Filter} config A filter configuration or a filter object.
     * @return {Ext.ux.grid.filter.Filter} The existing or newly created filter object.
     */
    addFilter : function (config) {
        var me = this,
            columns = me.getGridPanel().columnManager.getColumns(),
            i, columnsLength, column, filtersLength, filter;

        
        for (i = 0, columnsLength = columns.length; i < columnsLength; i++) {
            column = columns[i];
            if (column.dataIndex === config.dataIndex) {
                column.filter = config;
            }
        }
        
        if (me.view.headerCt.menu) {
            me.createFilters();
        } else {
            // Call getMenu() to ensure the menu is created, and so, also are the filters. We cannot call
            // createFilters() withouth having a menu because it will cause in a recursion to applyState()
            // that ends up to clear all the filter values. This is likely to happen when we reorder a column
            // and then add a new filter before the menu is recreated.
            me.view.headerCt.getMenu();
        }
        
        for (i = 0, filtersLength = me.filters.items.length; i < filtersLength; i++) {
            filter = me.filters.items[i];
            if (filter.dataIndex === config.dataIndex) {
                return filter;
            }
        }
    },

    /**
     * Adds filters to the collection.
     * @param {Array} filters An Array of filter configuration objects.
     */
    addFilters : function (filters) {
        if (filters) {
            var me = this,
                i, filtersLength;
            for (i = 0, filtersLength = filters.length; i < filtersLength; i++) {
                me.addFilter(filters[i]);
            }
        }
    },

    /**
     * Returns a filter for the given dataIndex, if one exists.
     * @param {String} dataIndex The dataIndex of the desired filter object.
     * @return {Ext.ux.grid.filter.Filter}
     */
    getFilter : function (dataIndex) {
        return this.filters.get(dataIndex);
    },

    /**
     * Turns all filters off. This does not clear the configuration information
     * (see {@link #removeAll}).
     */
    clearFilters : function () {
        this.filters.each(function (filter) {
            filter.setActive(false);
        });
    },

    getFilterItems: function () {
        var me = this;

        // If there's a locked grid then we must get the filter items for each grid.
        if (me.lockingPartner) {
            return me.filters.items.concat(me.lockingPartner.filters.items);
        }

        return me.filters.items;
    },

    /**
     * Returns an Array of the currently active filters.
     * @return {Array} filters Array of the currently active filters.
     */
    getFilterData : function () {
        var items = this.getFilterItems(),
            filters = [],
            n, nlen, item, d, i, len;

        for (n = 0, nlen = items.length; n < nlen; n++) {
            item = items[n];
            if (item.active) {
                d = [].concat(item.serialize());
                for (i = 0, len = d.length; i < len; i++) {
                    filters.push({
                        field: item.dataIndex,
                        data: d[i]
                    });
                }
            }
        }
        return filters;
    },

    /**
     * Function to take the active filters data and build it into a query.
     * The format of the query depends on the {@link #encode} configuration:
     *
     *   - `false` (Default) :
     *     Flatten into query string of the form (assuming <code>{@link #paramPrefix}='filters'</code>:
     *
     *         filters[0][field]="someDataIndex"&
     *         filters[0][data][comparison]="someValue1"&
     *         filters[0][data][type]="someValue2"&
     *         filters[0][data][value]="someValue3"&
     *
     *
     *   - `true` :
     *     JSON encode the filter data
     *
     *         {filters:[{"field":"someDataIndex","comparison":"someValue1","type":"someValue2","value":"someValue3"}]}
     *
     * Override this method to customize the format of the filter query for remote requests.
     *
     * @param {Array} filters A collection of objects representing active filters and their configuration.
     * Each element will take the form of {field: dataIndex, data: filterConf}. dataIndex is not assured
     * to be unique as any one filter may be a composite of more basic filters for the same dataIndex.
     *
     * @return {Object} Query keys and values
     */
    buildQuery : function (filters) {
        var p = {}, i, f, root, dataPrefix, key, tmp,
            len = filters.length;

        if (!this.encode){
            for (i = 0; i < len; i++) {
                f = filters[i];
                root = [this.paramPrefix, '[', i, ']'].join('');
                p[root + '[field]'] = f.field;

                dataPrefix = root + '[data]';
                for (key in f.data) {
                    p[[dataPrefix, '[', key, ']'].join('')] = f.data[key];
                }
            }
        } else {
            tmp = [];
            for (i = 0; i < len; i++) {
                f = filters[i];
                tmp.push(Ext.apply(
                    {},
                    {field: f.field},
                    f.data
                ));
            }
            // only build if there is active filter
            if (tmp.length > 0){
                p[this.paramPrefix] = Ext.JSON.encode(tmp);
            }
        }
        return p;
    },

    /**
     * Removes filter related query parameters from the provided object.
     * @param {Object} p Query parameters that may contain filter related fields.
     */
    cleanParams : function (p) {
        // if encoding just delete the property
        if (this.encode) {
            delete p[this.paramPrefix];
        // otherwise scrub the object of filter data
        } else {
            var regex, key;
            regex = new RegExp('^' + this.paramPrefix + '\[[0-9]+\]');
            for (key in p) {
                if (regex.test(key)) {
                    delete p[key];
                }
            }
        }
    },

    /**
     * Function for locating filter classes, overwrite this with your favorite
     * loader to provide dynamic filter loading.
     * @param {String} type The type of filter to load ('Filter' is automatically
     * appended to the passed type; eg, 'string' becomes 'StringFilter').
     * @return {Function} The Ext.ux.grid.filter.Class
     */
    getFilterClass : function (type) {
        // map the supported Ext.data.Field type values into a supported filter
        switch(type) {
            case 'auto':
              type = 'string';
              break;
            case 'int':
            case 'float':
              type = 'numeric';
              break;
            case 'bool':
              type = 'boolean';
              break;
        }
        return Ext.ClassManager.getByAlias('gridfilter.' + type);
    }
});

/**
 * Abstract base class for filter implementations.
 */
Ext.define('Ext.ux.grid.filter.Filter', {
    extend: 'Ext.util.Observable',

    /**
     * @cfg {Boolean} active
     * Indicates the initial status of the filter (defaults to false).
     */
    active : false,
    /**
     * True if this filter is active.  Use setActive() to alter after configuration.
     * @type Boolean
     * @property active
     */
    /**
     * @cfg {String} dataIndex
     * The {@link Ext.data.Store} dataIndex of the field this filter represents.
     * The dataIndex does not actually have to exist in the store.
     */
    dataIndex : null,
    /**
     * The filter configuration menu that will be installed into the filter submenu of a column menu.
     * @type Ext.menu.Menu
     * @property
     */
    menu : null,
    /**
     * @cfg {Number} updateBuffer
     * Number of milliseconds to wait after user interaction to fire an update. Only supported
     * by filters: 'list', 'numeric', and 'string'. Defaults to 500.
     */
    updateBuffer : 500,

    constructor : function (config) {
        Ext.apply(this, config);

        this.addEvents(
            /**
             * @event activate
             * Fires when an inactive filter becomes active
             * @param {Ext.ux.grid.filter.Filter} this
             */
            'activate',
            /**
             * @event deactivate
             * Fires when an active filter becomes inactive
             * @param {Ext.ux.grid.filter.Filter} this
             */
            'deactivate',
            /**
             * @event serialize
             * Fires after the serialization process. Use this to attach additional parameters to serialization
             * data before it is encoded and sent to the server.
             * @param {Array/Object} data A map or collection of maps representing the current filter configuration.
             * @param {Ext.ux.grid.filter.Filter} filter The filter being serialized.
             */
            'serialize',
            /**
             * @event update
             * Fires when a filter configuration has changed
             * @param {Ext.ux.grid.filter.Filter} this The filter object.
             */
            'update'
        );
        Ext.ux.grid.filter.Filter.superclass.constructor.call(this);

        this.menu = this.createMenu(config);
        this.init(config);
        if(config && config.value){
            this.setValue(config.value);
            this.setActive(config.active !== false, true);
            delete config.value;
        }
    },

    /**
     * Destroys this filter by purging any event listeners, and removing any menus.
     */
    destroy : function(){
        if (this.menu){
            this.menu.destroy();
        }
        this.clearListeners();
    },

    /**
     * Template method to be implemented by all subclasses that is to
     * initialize the filter and install required menu items.
     * Defaults to Ext.emptyFn.
     */
    init : Ext.emptyFn,

    /**
     * @private @override
     * Creates the Menu for this filter.
     * @param {Object} config Filter configuration
     * @return {Ext.menu.Menu}
     */
    createMenu: function(config) {
        config.plain = true;
        return Ext.create('Ext.menu.Menu', config);
    },

    /**
     * Template method to be implemented by all subclasses that is to
     * get and return the value of the filter.
     * Defaults to Ext.emptyFn.
     * @return {Object} The 'serialized' form of this filter
     * @template
     */
    getValue : Ext.emptyFn,

    /**
     * Template method to be implemented by all subclasses that is to
     * set the value of the filter and fire the 'update' event.
     * Defaults to Ext.emptyFn.
     * @param {Object} data The value to set the filter
     * @template
     */
    setValue : Ext.emptyFn,

    /**
     * Template method to be implemented by all subclasses that is to
     * return <tt>true</tt> if the filter has enough configuration information to be activated.
     * Defaults to <tt>return true</tt>.
     * @return {Boolean}
     */
    isActivatable : function(){
        return true;
    },

    /**
     * Template method to be implemented by all subclasses that is to
     * get and return serialized filter data for transmission to the server.
     * Defaults to Ext.emptyFn.
     */
    getSerialArgs : Ext.emptyFn,

    /**
     * Template method to be implemented by all subclasses that is to
     * validates the provided Ext.data.Record against the filters configuration.
     * Defaults to <tt>return true</tt>.
     * @param {Ext.data.Record} record The record to validate
     * @return {Boolean} true if the record is valid within the bounds
     * of the filter, false otherwise.
     */
    validateRecord : function(){
        return true;
    },

    /**
     * Returns the serialized filter data for transmission to the server
     * and fires the 'serialize' event.
     * @return {Object/Array} An object or collection of objects containing
     * key value pairs representing the current configuration of the filter.
     */
    serialize : function(){
        var args = this.getSerialArgs();
        this.fireEvent('serialize', args, this);
        return args;
    },

    /** @private */
    fireUpdate : function(){
        if (this.active) {
            this.fireEvent('update', this);
        }
        this.setActive(this.isActivatable());
    },

    /**
     * Sets the status of the filter and fires the appropriate events.
     * @param {Boolean} active        The new filter state.
     * @param {Boolean} suppressEvent True to prevent events from being fired.
     */
    setActive : function(active, suppressEvent){
        if(this.active != active){
            this.active = active;
            if (suppressEvent !== true) {
                this.fireEvent(active ? 'activate' : 'deactivate', this);
            }
        }
    }
});

/**
 * Filter by a configurable Ext.picker.DatePicker menu
 *
 * Example Usage:
 *
 *     var filters = Ext.create('Ext.ux.grid.GridFilters', {
 *         ...
 *         filters: [{
 *             // required configs
 *             type: 'date',
 *             dataIndex: 'dateAdded',
 *      
 *             // optional configs
 *             dateFormat: 'm/d/Y',  // default
 *             beforeText: 'Before', // default
 *             afterText: 'After',   // default
 *             onText: 'On',         // default
 *             pickerOpts: {
 *                 // any DatePicker configs
 *             },
 *      
 *             active: true // default is false
 *         }]
 *     });
 */
Ext.define('Ext.ux.grid.filter.DateFilter', {
    extend: 'Ext.ux.grid.filter.Filter',
    alias: 'gridfilter.date',
    uses: ['Ext.picker.Date', 'Ext.menu.Menu'],

    /**
     * @cfg {String} afterText
     * Defaults to 'After'.
     */
    afterText : 'After',
    afterEqText : 'After equal',
    /**
     * @cfg {String} beforeText
     * Defaults to 'Before'.
     */
    beforeText : 'Before',
    beforeEqText : 'Before equal',
    /**
     * @cfg {Object} compareMap
     * Map for assigning the comparison values used in serialization.
     */
    compareMap : {
        beforeEq: 'lte',
        before: 'lt',
        afterEq:  'gte',
        after:  'gt',
        non:     'neq',
        on:     'eq'
    },
    /**
     * @cfg {String} dateFormat
     * The date format to return when using getValue.
     * Defaults to 'm/d/Y'.
     */
    dateFormat : 'm/d/Y',

    /**
     * @cfg {Date} maxDate
     * Allowable date as passed to the Ext.DatePicker
     * Defaults to undefined.
     */
    /**
     * @cfg {Date} minDate
     * Allowable date as passed to the Ext.DatePicker
     * Defaults to undefined.
     */
    /**
     * @cfg {Array} menuItems
     * The items to be shown in this menu
     * Defaults to:<pre>
     * menuItems : ['before', 'after', '-', 'on'],
     * </pre>
     */
    menuItems : ['beforeEq', 'before', 'afterEq', 'after', '-', 'non', 'on'],

    /**
     * @cfg {Object} menuItemCfgs
     * Default configuration options for each menu item
     */
    menuItemCfgs : {
        selectOnFocus: true,
        width: 125
    },

    /**
     * @cfg {String} onText
     * Defaults to 'On'.
     */
    onText : 'On',
    nonText : 'NOn',

    /**
     * @cfg {Object} pickerOpts
     * Configuration options for the date picker associated with each field.
     */
    pickerOpts : {},

    /**
     * @private
     * Template method that is to initialize the filter and install required menu items.
     */
    init : function (config) {
        var me = this,
            pickerCfg, i, len, item, cfg;

        pickerCfg = Ext.apply(me.pickerOpts, {
            xtype: 'datepicker',
            minDate: me.minDate,
            maxDate: me.maxDate,
            format:  me.dateFormat,
            listeners: {
                scope: me,
                select: me.onMenuSelect
            }
        });

        me.fields = {};
        for (i = 0, len = me.menuItems.length; i < len; i++) {
            item = me.menuItems[i];
            if (item !== '-') {
                cfg = {
                    itemId: 'range-' + item,
                    text: me[item + 'Text'],
                    menu: Ext.create('Ext.menu.Menu', {
                        plain: true,
                        items: [
                            Ext.apply(pickerCfg, {
                                itemId: item,
                                listeners: {
                                    select: me.onPickerSelect,
                                    scope: me
                                }
                            })
                        ]
                    }),
                    listeners: {
                        scope: me,
                        checkchange: me.onCheckChange
                    }
                };
                item = me.fields[item] = Ext.create('Ext.menu.CheckItem', cfg);
            }
            //me.add(item);
            me.menu.add(item);
        }
        me.menu.add ("-");
        me.menu.add ({
            xtype: "checkbox",
            name: "isNull",
            boxLabel: "Пусто",
            style: "color: white; margin-left: 4px",
            listeners: {
                change: function () {
                    me.setActive (me.isActivatable ());
                    me.fireEvent ("update", me);
                    if (me.menu.down ("*[name=isNull]").getValue ()) {
                        me.menu.down ("*[name=isNotNull]").disable ();
                    } else {
                        me.menu.down ("*[name=isNotNull]").enable ();
                    };
                },
                scope: me
            }
        });
        me.menu.add ({
            xtype: "checkbox",
            name: "isNotNull",
            boxLabel: "Непусто",
            style: "color: white; margin-left: 4px",
            listeners: {
                change: function () {
                    me.setActive (me.isActivatable ());
                    me.fireEvent ("update", me);
                    if (me.menu.down ("*[name=isNotNull]").getValue ()) {
                        me.menu.down ("*[name=isNull]").disable ();
                    } else {
                        me.menu.down ("*[name=isNull]").enable ();
                    };
                },
                scope: me
            }
        });
        me.values = {};
    },

    onCheckChange : function (item, checked) {
        var me = this,
            picker = item.menu.items.first(),
            itemId = picker.itemId,
            values = me.values;

        if (checked) {
            values[itemId] = picker.getValue();
        } else {
            delete values[itemId]
        }
        me.setActive(me.isActivatable());
        me.fireEvent('update', me);
    },

    /**
     * @private
     * Handler method called when there is a keyup event on an input
     * item of this menu.
     */
    onInputKeyUp : function (field, e) {
        var k = e.getKey();
        if (k == e.RETURN && field.isValid()) {
            e.stopEvent();
            this.menu.hide();
        }
    },

    /**
     * Handler for when the DatePicker for a field fires the 'select' event
     * @param {Ext.picker.Date} picker
     * @param {Object} date
     */
    onMenuSelect : function (picker, date) {
        var fields = this.fields,
            field = this.fields[picker.itemId];

        field.setChecked(true);

        if (field == fields.on) {
            fields.before.setChecked(false, true);
            fields.after.setChecked(false, true);
        } else {
            fields.on.setChecked(false, true);
            if (field == fields.after && this.getFieldValue('before') < date) {
                fields.before.setChecked(false, true);
            } else if (field == fields.before && this.getFieldValue('after') > date) {
                fields.after.setChecked(false, true);
            }
        }
        this.fireEvent('update', this);

        picker.up('menu').hide();
    },

    /**
     * @private
     * Template method that is to get and return the value of the filter.
     * @return {String} The value of this filter
     */
    getValue : function () {
        var key, result = {};
        if (me.menu.down ("*[name=isNull]").getValue ()) {
            return {isNull: true};
        };
        if (me.menu.down ("*[name=isNotNull]").getValue ()) {
            return {isNotNull: true};
        };
        for (key in this.fields) {
            if (this.fields[key].checked) {
                result[key] = this.getFieldValue(key);
            }
        }
        return result;
    },

    /**
     * @private
     * Template method that is to set the value of the filter.
     * @param {Object} value The value to set the filter
     * @param {Boolean} preserve true to preserve the checked status
     * of the other fields.  Defaults to false, unchecking the
     * other fields
     */
    setValue : function (value, preserve) {
        var key;
        for (key in this.fields) {
            if(value[key]){
                this.getPicker(key).setValue(value[key]);
                this.fields[key].setChecked(true);
            } else if (!preserve) {
                this.fields[key].setChecked(false);
            }
        }
        this.fireEvent('update', this);
    },

    /**
     * Template method that is to return <tt>true</tt> if the filter
     * has enough configuration information to be activated.
     * @return {Boolean}
     */
    isActivatable : function () {
        var me = this;
        if (me.menu.down ("*[name=isNull]").getValue ()) {
            return true;
        };
        if (me.menu.down ("*[name=isNotNull]").getValue ()) {
            return true;
        };
        for (var key in me.fields) {
            if (me.fields [key].checked) {
                return true;
            }
        }
        return false;
    },

    /**
     * @private
     * Template method that is to get and return serialized filter data for
     * transmission to the server.
     * @return {Object/Array} An object or collection of objects containing
     * key value pairs representing the current configuration of the filter.
     */
    getSerialArgs : function () {
        var me = this;
        if (me.menu.down ("*[name=isNull]").getValue ()) {
            return {type: "string", value: {isNull: true}};
        };
        if (me.menu.down ("*[name=isNotNull]").getValue ()) {
            return {type: "string", value: {isNotNull: true}};
        };
        var args = [];
        for (var key in this.fields) {
            if(this.fields[key].checked){
                args.push({
                    type: 'date',
                    comparison: this.compareMap[key],
                    value: Ext.Date.format(this.getFieldValue(key), this.dateFormat)
                });
            }
        }
        return args;
    },

    /**
     * Get and return the date menu picker value
     * @param {String} item The field identifier ('before', 'after', 'on')
     * @return {Date} Gets the current selected value of the date field
     */
    getFieldValue : function(item){
        return this.values[item];
    },

    /**
     * Gets the menu picker associated with the passed field
     * @param {String} item The field identifier ('before', 'after', 'on')
     * @return {Object} The menu picker
     */
    getPicker : function(item){
        return this.fields[item].menu.items.first();
    },

    /**
     * Template method that is to validate the provided Ext.data.Record
     * against the filters configuration.
     * @param {Ext.data.Record} record The record to validate
     * @return {Boolean} true if the record is valid within the bounds
     * of the filter, false otherwise.
     */
    validateRecord : function (record) {
        var key,
            pickerValue,
            val = record.get(this.dataIndex),
            clearTime = Ext.Date.clearTime;

        if(!Ext.isDate(val)){
            return false;
        }
        val = clearTime(val, true).getTime();

        for (key in this.fields) {
            if (this.fields[key].checked) {
                pickerValue = clearTime(this.getFieldValue(key), true).getTime();
                if (key == 'beforeEq' && pickerValue <= val) {
                    return false;
                }
                if (key == 'before' && pickerValue < val) {
                    return false;
                }
                if (key == 'afterEq' && pickerValue >= val) {
                    return false;
                }
                if (key == 'after' && pickerValue > val) {
                    return false;
                }
                if (key == 'non' && pickerValue == val) {
                    return false;
                }
                if (key == 'on' && pickerValue != val) {
                    return false;
                }
            }
        }
        return true;
    },

    onPickerSelect: function(picker, date) {
        // keep track of the picker value separately because the menu gets destroyed
        // when columns order changes.  We return this value from getValue() instead
        // of picker.getValue()
        this.values[picker.itemId] = date;
        this.fireEvent('update', this);
    }
});

/**
 * Boolean filters use unique radio group IDs (so you can have more than one!)
 * <p><b><u>Example Usage:</u></b></p>
 * <pre><code>
var filters = Ext.create('Ext.ux.grid.GridFilters', {
    ...
    filters: [{
        // required configs
        type: 'boolean',
        dataIndex: 'visible'

        // optional configs
        defaultValue: null, // leave unselected (false selected by default)
        yesText: 'Yes',     // default
        noText: 'No'        // default
    }]
});
 * </code></pre>
 */
Ext.define('Ext.ux.grid.filter.BooleanFilter', {
    extend: 'Ext.ux.grid.filter.Filter',
    alias: 'gridfilter.boolean',

	/**
	 * @cfg {Boolean} defaultValue
	 * Set this to null if you do not want either option to be checked by default. Defaults to false.
	 */
	defaultValue : false,
	/**
	 * @cfg {String} yesText
	 * Defaults to 'Yes'.
	 */
	yesText : 'Yes',
	/**
	 * @cfg {String} noText
	 * Defaults to 'No'.
	 */
	noText : 'No',

    /**
     * @private
     * Template method that is to initialize the filter and install required menu items.
     */
    init : function (config) {
        var gId = Ext.id();
		this.options = [
			Ext.create('Ext.menu.CheckItem', {text: this.yesText, group: gId, checked: this.defaultValue === true}),
			Ext.create('Ext.menu.CheckItem', {text: this.noText, group: gId, checked: this.defaultValue === false})];

		this.menu.add(this.options[0], this.options[1]);

		for(var i=0; i<this.options.length; i++){
			this.options[i].on('click', this.fireUpdate, this);
			this.options[i].on('checkchange', this.fireUpdate, this);
		}
	},

    /**
     * @private
     * Template method that is to get and return the value of the filter.
     * @return {String} The value of this filter
     */
    getValue : function () {
		return this.options[0].checked;
	},

    /**
     * @private
     * Template method that is to set the value of the filter.
     * @param {Object} value The value to set the filter
     */
	setValue : function (value) {
		this.options[value ? 0 : 1].setChecked(true);
	},

    /**
     * @private
     * Template method that is to get and return serialized filter data for
     * transmission to the server.
     * @return {Object/Array} An object or collection of objects containing
     * key value pairs representing the current configuration of the filter.
     */
    getSerialArgs : function () {
		var args = {type: 'boolean', value: this.getValue()};
		return args;
	},

    /**
     * Template method that is to validate the provided Ext.data.Record
     * against the filters configuration.
     * @param {Ext.data.Record} record The record to validate
     * @return {Boolean} true if the record is valid within the bounds
     * of the filter, false otherwise.
     */
    validateRecord : function (record) {
		return record.get(this.dataIndex) == this.getValue();
	}
});

/**
 * Filter by a configurable Ext.picker.DatePicker menu
 *
 * This filter allows for the following configurations:
 *
 * - Any of the normal configs will be passed through to either component.
 * - There can be a docked config.
 * - The timepicker can be on the right or left (datepicker, too, of course).
 * - Choose which component will initiate the filtering, i.e., the event can be
 *   configured to be bound to either the datepicker or the timepicker, or if
 *   there is a docked config it be automatically have the handler bound to it.
 *
 * Although not shown here, this class accepts all configuration options
 * for {@link Ext.picker.Date} and {@link Ext.picker.Time}.
 *
 * In the case that a custom dockedItems config is passed in, the
 * class will handle binding the default listener to it so the
 * developer need not worry about having to do it.
 *
 * The default dockedItems position and the toolbar's
 * button text can be passed a config for convenience, i.e.,:
 *
 *     dock: {
 *        buttonText: 'Click to Filter',
 *        dock: 'left'
 *     }
 *
 * Or, pass in a full dockedItems config:
 *
 *     dock: {
 *        dockedItems: {
 *            xtype: 'toolbar',
 *            dock: 'bottom',
 *            ...
 *        }
 *     }
 *
 * Or, give a value of `true` to accept dock defaults:
 *
 *     dock: true
 *
 * But, it must be one or the other.
 *
 * Example Usage:
 *
 *     var filters = Ext.create('Ext.ux.grid.GridFilters', {
 *         ...
 *         filters: [{
 *             // required configs
 *             type: 'datetime',
 *             dataIndex: 'date',
 *
 *             // optional configs
 *             positionDatepickerFirst: false,
 *             //selectDateToFilter: false, // this is overridden b/c of the presence of the dock cfg object
 *
 *             date: {
 *                 format: 'm/d/Y',
 *             },
 *
 *             time: {
 *                 format: 'H:i:s A',
 *                 increment: 1
 *             },
 *
 *             dock: {
 *                 buttonText: 'Click to Filter',
 *                 dock: 'left'
 *
 *                 // allows for custom dockedItems cfg
 *                 //dockedItems: {}
 *             }
 *         }]
 *     });
 *
 * In the above example, note that the filter is being passed a {@link #date} config object,
 * a {@link #time} config object and a {@link #dock} config. These are all optional.
 *
 * As for positioning, the datepicker will be on the right, the timepicker on the left
 * and the docked items will be docked on the left. In addition, since there's a {@link #dock}
 * config, clicking the button in the dock will trigger the filtering.
 */
Ext.define('Ext.ux.grid.filter.DateTimeFilter', {
    extend: 'Ext.ux.grid.filter.DateFilter',
    alias: 'gridfilter.datetime',

    /**
     * @private
     */
    dateDefaults: {
        xtype: 'datepicker',
        format: 'm/d/Y'
    },

    /**
     * @private
     */
    timeDefaults: {
        xtype: 'timepicker',
        width: 100,
        height: 200,
        format: 'g:i A'
    },

    /**
     * @private
     */
    dockDefaults: {
        dock: 'top',
        buttonText: 'Filter'
    },

    /**
     * @cfg {Object} date
     * A {@link Ext.picker.Date} can be configured here.
     * Uses {@link #dateDefaults} by default.
     */

    /**
     * @cfg {Object} time
     * A {@link Ext.picker.Time} can be configured here.
     * Uses {@link #timeDefaults} by default.
     */

    /**
     * @cfg {Boolean/Object} dock
     * A {@link Ext.panel.AbstractPanel#cfg-dockedItems} can be configured here.
     * A `true` value will use the {@link #dockDefaults} default configuration.
     * If present, the button in the docked items will initiate the filtering.
     */

    /**
     * @cfg {Boolean} [selectDateToFilter=true]
     * By default, the datepicker has the default event listener bound to it.
     * Setting to `false` will bind it to the timepicker.
     *
     * The config will be ignored if there is a `dock` config.
     */
    selectDateToFilter: true,

    /**
     * @cfg {Boolean} [positionDatepickerFirst=true]
     * Positions the datepicker within its container.
     * A `true` value will place it on the left in the container.
     * Set to `false` if the timepicker should be placed on the left.
     * Defaults to `true`.
     */
    positionDatepickerFirst: true,

    reTime: /\s(am|pm)/i,
    reItemId: /\w*-(\w*)$/,

    /**
     * Replaces the selected value of the timepicker with the default 00:00:00.
     * @private
     * @param {Object} date
     * @param {Ext.picker.Time} timepicker
     * @return Date object
     */
    addTimeSelection: function (date, timepicker) {
        var me = this,
            selection = timepicker.getSelectionModel().getSelection(),
            time, len, fn, val,
            i = 0,
            arr = [],
            timeFns = ['setHours', 'setMinutes', 'setSeconds', 'setMilliseconds'];


        if (selection.length) {
            time = selection[0].get('disp');

            // Loop through all of the splits and add the time values.
            arr = time.replace(me.reTime, '').split(':');

            for (len = arr.length; i < len; i++) {
                fn = timeFns[i];
                val = arr[i];

                if (val) {
                    date[fn](parseInt(val, 10));
                }
            }
        }

        return date;
    },

    /**
     * @private
     * Template method that is to initialize the filter and install required menu items.
     */
    init: function (config) {
        var me = this,
            dateCfg = Ext.applyIf(me.date || {}, me.dateDefaults),
            timeCfg = Ext.applyIf(me.time || {}, me.timeDefaults),
            dockCfg = me.dock, // should not default to empty object
            defaultListeners = {
                click: {
                    scope: me,
                    click: me.onMenuSelect
                },
                select: {
                    scope: me,
                    select: me.onMenuSelect
                }
            },
            pickerCtnCfg, i, len, item, cfg,
            items = [dateCfg, timeCfg],

            // we need to know the datepicker's position in the items array
            // for when the itemId name is bound to it before adding to the menu
            datepickerPosition = 0;

        if (!me.positionDatepickerFirst) {
            items = items.reverse();
            datepickerPosition = 1;
        }

        pickerCtnCfg = Ext.apply(me.pickerOpts, {
            xtype: !dockCfg ? 'container' : 'panel',
            layout: 'hbox',
            items: items
        });

        // If there's no dock config then bind the default listener to the desired picker.
        if (!dockCfg) {
            if (me.selectDateToFilter) {
                dateCfg.listeners = defaultListeners.select;
            } else {
                timeCfg.listeners = defaultListeners.select;
            }
        } else if (dockCfg) {
            me.selectDateToFilter = null;

            if (dockCfg.dockedItems) {
                pickerCtnCfg.dockedItems = dockCfg.dockedItems;
                // TODO: allow config that will tell which item to bind the listener to
                // right now, it's using the first item
                pickerCtnCfg.dockedItems.items[dockCfg.bindToItem || 0].listeners = defaultListeners.click;
            } else {
                // dockCfg can be `true` if button text and dock position defaults are wanted
                if (Ext.isBoolean(dockCfg)) {
                    dockCfg = {};
                }
                dockCfg = Ext.applyIf(dockCfg, me.dockDefaults);
                pickerCtnCfg.dockedItems = {
                    xtype: 'toolbar',
                    dock: dockCfg.dock,
                    items: [
                        {
                            xtype: 'button',
                            text: dockCfg.buttonText,
                            flex: 1,
                            listeners: defaultListeners.click
                        }
                    ]   
                };
            }
        }

        me.fields = {};
        for (i = 0, len = me.menuItems.length; i < len; i++) {
            item = me.menuItems[i];
            if (item !== '-') {
                pickerCtnCfg.items[datepickerPosition].itemId = item;

                cfg = {
                    itemId: 'range-' + item,
                    text: me[item + 'Text'],
                    menu: Ext.create('Ext.menu.Menu', {
                        items: pickerCtnCfg
                    }),
                    listeners: {
                        scope: me,
                        checkchange: me.onCheckChange
                    }
                };
                item = me.fields[item] = Ext.create('Ext.menu.CheckItem', cfg);
            }
            me.menu.add(item);
        }
        me.values = {};
    },

    /**
     * @private
     */
    onCheckChange: function (item, checked) {
        var me = this,
            menu = item.menu,
            timepicker = menu.down('timepicker'),
            datepicker = menu.down('datepicker'),
            itemId = datepicker.itemId,
            values = me.values;

        if (checked) {
            values[itemId] = me.addTimeSelection(datepicker.value, timepicker);
        } else {
            delete values[itemId];
        }
        me.setActive(me.isActivatable());
        me.fireEvent('update', me);
    },

    /** 
     * Handler for when the DatePicker for a field fires the 'select' event
     * @param {Ext.picker.Date} picker
     * @param {Object} date
     */
    onMenuSelect: function (picker, date) {
        // NOTE: we need to redefine the picker.
        var me = this,
            menu = me.menu,
            checkItemId = menu.getFocusEl().itemId.replace(me.reItemId, '$1'),
            fields = me.fields,
            field;

        picker = menu.queryById(checkItemId);
        field = me.fields[picker.itemId];
        field.setChecked(true);

        if (field == fields.on) {
            fields.before.setChecked(false, true);
            fields.after.setChecked(false, true);
        } else {
            fields.on.setChecked(false, true);
            if (field == fields.after && me.getFieldValue('before') < date) {
                fields.before.setChecked(false, true);
            } else if (field == fields.before && me.getFieldValue('after') > date) {
                fields.after.setChecked(false, true);
            }   
        }   
        me.fireEvent('update', me);

        // The timepicker's getBubbleTarget() returns the boundlist's implementation,
        // so it doesn't look up ownerCt chain (it looks up this.pickerField).
        // This is a problem :)
        // This can be fixed by just walking up the ownerCt chain
        // (same thing, but confusing without comment).
        picker.ownerCt.ownerCt.hide();
    },

    /**
     * @private
     * Template method that is to get and return serialized filter data for
     * transmission to the server.
     * @return {Object/Array} An object or collection of objects containing
     * key value pairs representing the current configuration of the filter.
     */
    getSerialArgs: function () {
        var me = this,
            key,
            fields = me.fields,
            args = [];

        for (key in fields) {
            if (fields[key].checked) {
                args.push({
                    type: 'datetime',
                    comparison: me.compareMap[key],
                    value: Ext.Date.format(me.getFieldValue(key), (me.date.format || me.dateDefaults.format) + ' ' + (me.time.format || me.timeDefaults.format))
                });
            }
        }
        return args;
    },

    /**
     * @private
     * Template method that is to set the value of the filter.
     * @param {Object} value The value to set the filter
     * @param {Boolean} preserve true to preserve the checked status
     * of the other fields.  Defaults to false, unchecking the
     * other fields
     */
    setValue: function (value, preserve) {
        var me = this,
            fields = me.fields,
            key,
            val,
            datepicker;

        for (key in fields) {
            val = value[key];
            if (val) {
                datepicker = me.menu.down('datepicker[itemId="' + key + '"]');
                // Note that calling the Ext.picker.Date:setValue() calls Ext.Date.clearTime(),
                // which we don't want, so just call update() instead and set the value on the component.
                datepicker.update(val);
                datepicker.value = val;

                fields[key].setChecked(true);
            } else if (!preserve) {
                fields[key].setChecked(false);
            }
        }
        me.fireEvent('update', me);
    },

    /**
     * Template method that is to validate the provided Ext.data.Record
     * against the filters configuration.
     * @param {Ext.data.Record} record The record to validate
     * @return {Boolean} true if the record is valid within the bounds
     * of the filter, false otherwise.
     */
    validateRecord: function (record) {
        // remove calls to Ext.Date.clearTime
        var me = this,
            key,
            pickerValue,
            val = record.get(me.dataIndex);

        if(!Ext.isDate(val)){
            return false;
        }

        val = val.getTime();

        for (key in me.fields) {
            if (me.fields[key].checked) {
                pickerValue = me.getFieldValue(key).getTime();
                if (key == 'before' && pickerValue <= val) {
                    return false;
                }
                if (key == 'after' && pickerValue >= val) {
                    return false;
                }
                if (key == 'on' && pickerValue != val) {
                    return false;
                }
            }
        }
        return true;
    }
});

/**
 * List filters are able to be preloaded/backed by an Ext.data.Store to load
 * their options the first time they are shown. ListFilter utilizes the
 * {@link Ext.ux.grid.menu.ListMenu} component.
 *
 * List filters are also able to create their own list of values from  all unique values of
 * the specified {@link #dataIndex} field in the store at first time of filter invocation.
 *
 * Although not shown here, this class accepts all configuration options
 * for {@link Ext.ux.grid.menu.ListMenu}.
 *
 * Example Usage:
 *
 *     var filters = Ext.create('Ext.ux.grid.GridFilters', {
 *         ...
 *         filters: [{
 *             type: 'list',
 *             dataIndex: 'size',
 *             phpMode: true,
 *             // options will be used as data to implicitly creates an ArrayStore
 *             options: ['extra small', 'small', 'medium', 'large', 'extra large']
 *         }]
 *     });
 *
 */
Ext.define('Ext.ux.grid.filter.ListFilter', {
    extend: 'Ext.ux.grid.filter.Filter',
    alias: 'gridfilter.list',

    /**
     * @cfg {Array} [options]
     * `data` to be used to implicitly create a data store
     * to back this list when the data source is **local**. If the
     * data for the list is remote, use the {@link #store}
     * config instead.
     *
     * If neither store nor {@link #options} is specified, then the choices list is automatically
     * populated from all unique values of the specified {@link #dataIndex} field in the store at first
     * time of filter invocation.
     *
     * Each item within the provided array may be in one of the
     * following formats:
     *
     *   - **Array** :
     *
     *         options: [
     *             [11, 'extra small'],
     *             [18, 'small'],
     *             [22, 'medium'],
     *             [35, 'large'],
     *             [44, 'extra large']
     *         ]
     *
     *   - **Object** :
     *
     *         labelField: 'name', // override default of 'text'
     *         options: [
     *             {id: 11, name:'extra small'},
     *             {id: 18, name:'small'},
     *             {id: 22, name:'medium'},
     *             {id: 35, name:'large'},
     *             {id: 44, name:'extra large'}
     *         ]
     * 
     *   - **String** :
     *
     *         options: ['extra small', 'small', 'medium', 'large', 'extra large']
     *
     */
    /**
     * @cfg {Boolean} phpMode
     * Adjust the format of this filter. Defaults to false.
     *
     * When GridFilters `@cfg encode = false` (default):
     *
     *     // phpMode == false (default):
     *     filter[0][data][type] list
     *     filter[0][data][value] value1
     *     filter[0][data][value] value2
     *     filter[0][field] prod
     *
     *     // phpMode == true:
     *     filter[0][data][type] list
     *     filter[0][data][value] value1, value2
     *     filter[0][field] prod
     *
     * When GridFilters `@cfg encode = true`:
     *
     *     // phpMode == false (default):
     *     filter : [{"type":"list","value":["small","medium"],"field":"size"}]
     *
     *     // phpMode == true:
     *     filter : [{"type":"list","value":"small,medium","field":"size"}]
     *
     */
    phpMode : false,
    /**
     * @cfg {Ext.data.Store} [store]
     * The {@link Ext.data.Store} this list should use as its data source
     * when the data source is **remote**. If the data for the list
     * is local, use the {@link #options} config instead.
     *
     * If neither store nor {@link #options} is specified, then the choices list is automatically
     * populated from all unique values of the specified {@link #dataIndex} field in the store at first
     * time of filter invocation.
     */

    /**
     * @private
     * Template method that is to initialize the filter.
     * @param {Object} config
     */
    init : function (config) {
        this.dt = Ext.create('Ext.util.DelayedTask', this.fireUpdate, this);
    },

    /**
     * @private @override
     * Creates the Menu for this filter.
     * @param {Object} config Filter configuration
     * @return {Ext.menu.Menu}
     */
    createMenu: function(config) {
        var menu = Ext.create('Ext.ux.grid.menu.ListMenu', config);
        menu.on('checkchange', this.onCheckChange, this);
        return menu;
    },

    /**
     * @private
     * Template method that is to get and return the value of the filter.
     * @return {String} The value of this filter
     */
    getValue : function () {
        return this.menu.getSelected();
    },
    /**
     * @private
     * Template method that is to set the value of the filter.
     * @param {Object} value The value to set the filter
     */
    setValue : function (value) {
        this.menu.setSelected(value);
        this.fireEvent('update', this);
    },

    /**
     * Template method that is to return true if the filter
     * has enough configuration information to be activated.
     * @return {Boolean}
     */
    isActivatable : function () {
        return this.getValue().length > 0;
    },

    /**
     * @private
     * Template method that is to get and return serialized filter data for
     * transmission to the server.
     * @return {Object/Array} An object or collection of objects containing
     * key value pairs representing the current configuration of the filter.
     */
    getSerialArgs : function () {
        return {type: 'list', value: this.phpMode ? this.getValue().join(',') : this.getValue()};
    },

    /** @private */
    onCheckChange : function(){
        this.dt.delay(this.updateBuffer);
    },


    /**
     * Template method that is to validate the provided Ext.data.Record
     * against the filters configuration.
     * @param {Ext.data.Record} record The record to validate
     * @return {Boolean} true if the record is valid within the bounds
     * of the filter, false otherwise.
     */
    validateRecord : function (record) {
        var valuesArray = this.getValue();
        return Ext.Array.indexOf(valuesArray, record.get(this.dataIndex)) > -1;
    }
});

/**
 * Filters using an Ext.ux.grid.menu.RangeMenu.
 * <p><b><u>Example Usage:</u></b></p>
 * <pre><code>
var filters = Ext.create('Ext.ux.grid.GridFilters', {
    ...
    filters: [{
        type: 'numeric',
        dataIndex: 'price'
    }]
});
 * </code></pre>
 * <p>Any of the configuration options for {@link Ext.ux.grid.menu.RangeMenu} can also be specified as
 * configurations to NumericFilter, and will be copied over to the internal menu instance automatically.</p>
 */
Ext.define('Ext.ux.grid.filter.NumericFilter', {
    extend: 'Ext.ux.grid.filter.Filter',
    alias: 'gridfilter.numeric',
    uses: ['Ext.form.field.Number'],

    /**
     * @private @override
     * Creates the Menu for this filter.
     * @param {Object} config Filter configuration
     * @return {Ext.menu.Menu}
     */
    createMenu: function(config) {
        var me = this,
            menu;
        menu = Ext.create('Ext.ux.grid.menu.RangeMenu', config);
        menu.on('update', me.fireUpdate, me);
        return menu;
    },

    /**
     * @private
     * Template method that is to get and return the value of the filter.
     * @return {String} The value of this filter
     */
    getValue : function () {
        return this.menu.getValue();
    },

    /**
     * @private
     * Template method that is to set the value of the filter.
     * @param {Object} value The value to set the filter
     */
    setValue : function (value) {
        this.menu.setValue(value);
    },

    /**
     * Template method that is to return <tt>true</tt> if the filter
     * has enough configuration information to be activated.
     * @return {Boolean}
     */
    isActivatable : function () {
        var values = this.getValue(),
            key;
        for (key in values) {
            if (values[key] !== undefined) {
                return true;
            }
        }
        return false;
    },

    /**
     * @private
     * Template method that is to get and return serialized filter data for
     * transmission to the server.
     * @return {Object/Array} An object or collection of objects containing
     * key value pairs representing the current configuration of the filter.
     */
    getSerialArgs : function () {
        var key,
            args = [],
            values = this.menu.getValue();
        for (key in values) {
            args.push({
                type: 'numeric',
                comparison: key,
                value: values[key]
            });
        }
        return args;
    },

    /**
     * Template method that is to validate the provided Ext.data.Record
     * against the filters configuration.
     * @param {Ext.data.Record} record The record to validate
     * @return {Boolean} true if the record is valid within the bounds
     * of the filter, false otherwise.
     */
    validateRecord : function (record) {
        var val = record.get(this.dataIndex),
            values = this.getValue(),
            isNumber = Ext.isNumber;
        if (isNumber(values.eq) && val != values.eq) {
            return false;
        }
        if (isNumber(values.lt) && val >= values.lt) {
            return false;
        }
        if (isNumber(values.gt) && val <= values.gt) {
            return false;
        }
        return true;
    }
});

/**
 * Filter by a configurable Ext.form.field.Text
 * <p><b><u>Example Usage:</u></b></p>
 * <pre><code>
var filters = Ext.create('Ext.ux.grid.GridFilters', {
    ...
    filters: [{
        // required configs
        type: 'string',
        dataIndex: 'name',

        // optional configs
        value: 'foo',
        active: true, // default is false
        iconCls: 'ux-gridfilter-text-icon' // default
        // any Ext.form.field.Text configs accepted
    }]
});
 * </code></pre>
 */
Ext.define('Ext.ux.grid.filter.StringFilter', {
    extend: 'Ext.ux.grid.filter.Filter',
    alias: 'gridfilter.string',

    /**
     * @cfg {String} iconCls
     * The iconCls to be applied to the menu item.
     * Defaults to <tt>'ux-gridfilter-text-icon'</tt>.
     */
    iconCls : 'ux-gridfilter-text-icon',

    emptyText: 'Enter Filter Text...',
    selectOnFocus: true,
    width: 125,

    /**
     * @private
     * Template method that is to initialize the filter and install required menu items.
     */
    init : function (config) {
        Ext.applyIf(config, {
            enableKeyEvents: true,
            labelCls: 'ux-rangemenu-icon ' + this.iconCls,
            hideEmptyLabel: false,
            labelSeparator: '',
            labelWidth: 29,
            listeners: {
                scope: this,
                keyup: this.onInputKeyUp,
                el: {
                    click: function(e) {
                        e.stopPropagation();
                    }
                }
            }
        });

        this.inputItem = Ext.create('Ext.form.field.Text', config);
        this.menu.add(this.inputItem);
        this.menu.add({
            xtype: "checkbox",
            name: "notLike",
            boxLabel: "Отсутствует",
            style: "color: white",
            listeners: {
                change: function () {
                    this.updateTask.delay(1);
                },
                scope: this
            }
        });
        var me = this;
        this.menu.add({
            xtype: "checkbox",
            name: "isNull",
            boxLabel: "Пусто",
            style: "color: white",
            listeners: {
                change: function () {
                    this.updateTask.delay(1);
                    if (me.menu.down ("*[name=isNull]").getValue ()) {
                        me.menu.down ("*[name=isNotNull]").disable ();
                        me.menu.down ("*[name=notLike]").disable ();
                    } else {
                        me.menu.down ("*[name=isNotNull]").enable ();
                        me.menu.down ("*[name=notLike]").enable ();
                    };
                },
                scope: this
            }
        });
        this.menu.add({
            xtype: "checkbox",
            name: "isNotNull",
            boxLabel: "Непусто",
            style: "color: white",
            listeners: {
                change: function () {
                    this.updateTask.delay(1);
                    if (me.menu.down ("*[name=isNotNull]").getValue ()) {
                        me.menu.down ("*[name=isNull]").disable ();
                        me.menu.down ("*[name=notLike]").disable ();
                    } else {
                        me.menu.down ("*[name=isNull]").enable ();
                        me.menu.down ("*[name=notLike]").enable ();
                    };
                },
                scope: this
            }
        });
        this.menu.showSeparator = false;
        this.updateTask = Ext.create('Ext.util.DelayedTask', this.fireUpdate, this);
    },

    /**
     * @private
     * Template method that is to get and return the value of the filter.
     * @return {String} The value of this filter
     */
    getValue : function () {
        var me = this;
        return {
            value: me.inputItem.getValue(),
            notLike: me.menu.down ("*[name=notLike]").getValue (),
            isNull: me.menu.down ("*[name=isNull]").getValue (),
            isNotNull: me.menu.down ("*[name=isNotNull]").getValue ()
        };
    },

    /**
     * @private
     * Template method that is to set the value of the filter.
     * @param {Object} value The value to set the filter
     */
    setValue : function (value) {
        this.inputItem.setValue(value);
        this.fireEvent('update', this);
    },

    /**
     * Template method that is to return <tt>true</tt> if the filter
     * has enough configuration information to be activated.
     * @return {Boolean}
     */
    isActivatable : function () {
        var me = this;
        return this.inputItem.getValue().length > 0 || me.menu.down ("*[name=isNull]").getValue () || me.menu.down ("*[name=isNotNull]").getValue ();
    },

    /**
     * @private
     * Template method that is to get and return serialized filter data for
     * transmission to the server.
     * @return {Object/Array} An object or collection of objects containing
     * key value pairs representing the current configuration of the filter.
     */
    getSerialArgs : function () {
        return {type: 'string', value: this.getValue()};
    },

    /**
     * Template method that is to validate the provided Ext.data.Record
     * against the filters configuration.
     * @param {Ext.data.Record} record The record to validate
     * @return {Boolean} true if the record is valid within the bounds
     * of the filter, false otherwise.
     */
    validateRecord : function (record) {
        var val = record.get(this.dataIndex);

        if(typeof val != 'string') {
            return (this.getValue().length === 0);
        }

        return val.toLowerCase().indexOf(this.getValue().toLowerCase()) > -1;
    },

    /**
     * @private
     * Handler method called when there is a keyup event on this.inputItem
     */
    onInputKeyUp : function (field, e) {
        var k = e.getKey();
        if (k == e.RETURN && field.isValid()) {
            e.stopEvent();
            //this.menu.hide();
        this.updateTask.delay(1);
            return;
        }
        // restart the timer
        //this.updateTask.delay(this.updateBuffer);
    }
});

/**
 * This is a supporting class for {@link Ext.ux.grid.filter.ListFilter}.
 * Although not listed as configuration options for this class, this class
 * also accepts all configuration options from {@link Ext.ux.grid.filter.ListFilter}.
 */
Ext.define('Ext.ux.grid.menu.ListMenu', {
    extend: 'Ext.menu.Menu',
    
    /**
     * @cfg {String} idField
     * Defaults to 'id'.
     */
    idField :  'id',

    /**
     * @cfg {String} labelField
     * Defaults to 'text'.
     */
    labelField :  'text',
    /**
     * @cfg {String} paramPrefix
     * Defaults to 'Loading...'.
     */
    loadingText : 'Loading...',
    /**
     * @cfg {Boolean} loadOnShow
     * Defaults to true.
     */
    loadOnShow : true,
    /**
     * @cfg {Boolean} single
     * Specify true to group all items in this list into a single-select
     * radio button group. Defaults to false.
     */
    single : false,

    plain: true,

    constructor : function (cfg) {
        var me = this,
            options,
            i,
            len,
            value;
            
        me.selected = [];
        me.addEvents(
            /**
             * @event checkchange
             * Fires when there is a change in checked items from this list
             * @param {Object} item Ext.menu.CheckItem
             * @param {Object} checked The checked value that was set
             */
            'checkchange'
        );

        me.callParent(arguments);

        // A ListMenu which is completely unconfigured acquires its store from the unique values of its field in the store
        if (!me.store && !me.options) {
            me.options = me.grid.store.collect(me.dataIndex, false, true);
        }

        if (!me.store && me.options) {
            options = [];
            for(i = 0, len = me.options.length; i < len; i++) {
                value = me.options[i];
                switch (Ext.type(value)) {
                    case 'array': 
                        options.push(value);
                        break;
                    case 'object':
                        options.push([value[me.idField], value[me.labelField]]);
                        break;
                    default:
                        if (value != null) {
                            options.push([value, value]);
                        }
                }
            }

            me.store = Ext.create('Ext.data.ArrayStore', {
                fields: [me.idField, me.labelField],
                data:   options,
                listeners: {
                    load: me.onLoad,
                    scope:  me
                }
            });
            me.loaded = true;
            me.autoStore = true;
        } else {
            me.add({
                text: me.loadingText,
                iconCls: 'loading-indicator'
            });
            me.store.on('load', me.onLoad, me);
        }
    },

    destroy : function () {
        var me = this,
            store = me.store;
            
        if (store) {
            if (me.autoStore) {
                store.destroyStore();
            } else {
                store.un('unload', me.onLoad, me);
            }
        }
        me.callParent();
    },

    /**
     * Lists will initially show a 'loading' item while the data is retrieved from the store.
     * In some cases the loaded data will result in a list that goes off the screen to the
     * right (as placement calculations were done with the loading item). This adapter will
     * allow show to be called with no arguments to show with the previous arguments and
     * thus recalculate the width and potentially hang the menu from the left.
     */
    show : function () {
        var me = this;
        if (me.loadOnShow && !me.loaded && !me.store.loading) {
            me.store.load();
        }
        me.callParent();
    },

    /** @private */
    onLoad : function (store, records) {
        var me = this,
            gid, itemValue, i, len,
            listeners = {
                checkchange: me.checkChange,
                scope: me
            };

        Ext.suspendLayouts();
        me.removeAll(true);
        gid = me.single ? Ext.id() : null;
        for (i = 0, len = records.length; i < len; i++) {
            itemValue = records[i].get(me.idField);
            me.add(Ext.create('Ext.menu.CheckItem', {
                text: records[i].get(me.labelField),
                group: gid,
                checked: Ext.Array.contains(me.selected, itemValue),
                hideOnClick: false,
                value: itemValue,
                listeners: listeners
            }));
        }

        me.loaded = true;
        Ext.resumeLayouts(true);
        me.fireEvent('load', me, records);
    },

    /**
     * Get the selected items.
     * @return {Array} selected
     */
    getSelected : function () {
        return this.selected;
    },

    /** @private */
    setSelected : function (value) {
        value = this.selected = [].concat(value);

        if (this.loaded) {
            this.items.each(function(item){
                item.setChecked(false, true);
                for (var i = 0, len = value.length; i < len; i++) {
                    if (item.value == value[i]) {
                        item.setChecked(true, true);
                    }
                }
            });
        }
    },

    /**
     * Handler for the 'checkchange' event from an check item in this menu
     * @param {Object} item Ext.menu.CheckItem
     * @param {Object} checked The checked value that was set
     */
    checkChange : function (item, checked) {
        var value = [];
        this.items.each(function(item){
            if (item.checked) {
                value.push(item.value);
            }
        });
        this.selected = value;

        this.fireEvent('checkchange', item, checked);
    }
});

/**
 * Custom implementation of {@link Ext.menu.Menu} that has preconfigured items for entering numeric
 * range comparison values: less-than, greater-than, and equal-to. This is used internally
 * by {@link Ext.ux.grid.filter.NumericFilter} to create its menu.
 */
Ext.define('Ext.ux.grid.menu.RangeMenu', {
    extend: 'Ext.menu.Menu',

    /**
     * @cfg {String} fieldCls
     * The Class to use to construct each field item within this menu
     * Defaults to:<pre>
     * fieldCls : Ext.form.field.Number
     * </pre>
     */
    fieldCls : 'Ext.form.field.Number',

    /**
     * @cfg {Object} fieldCfg
     * The default configuration options for any field item unless superseded
     * by the <code>{@link #fields}</code> configuration.
     * Defaults to:<pre>
     * fieldCfg : {}
     * </pre>
     * Example usage:
     * <pre><code>
fieldCfg : {
    width: 150,
},
     * </code></pre>
     */

    /**
     * @cfg {Object} fields
     * The field items may be configured individually
     * Defaults to <tt>undefined</tt>.
     * Example usage:
     * <pre><code>
fields : {
    gt: { // override fieldCfg options
        width: 200,
        fieldCls: Ext.ux.form.CustomNumberField // to override default {@link #fieldCls}
    }
},
     * </code></pre>
     */

    /**
     * @cfg {Object} itemIconCls
     * The itemIconCls to be applied to each comparator field item.
     * Defaults to:<pre>
itemIconCls : {
    gt : 'ux-rangemenu-gt',
    lt : 'ux-rangemenu-lt',
    eq : 'ux-rangemenu-eq'
}
     * </pre>
     */
    itemIconCls : {
        gte : 'ux-rangemenu-gt',
        gt : 'ux-rangemenu-gt',
        lte : 'ux-rangemenu-lt',
        lt : 'ux-rangemenu-lt',
        neq : 'gi_search',
        eq : 'ux-rangemenu-eq'
    },
    itemName : {
        lte : 'Меньше или равно',
        lt : 'Меньше',
        gte : 'Больше или равно',
        gt : 'Больше',
        neq : 'Не равно',
        eq : 'Равно'
        /*
        gte : '<=',
        gt : '<',
        lte : '>=',
        lt : '>',
        neq : '<>',
        eq : '='
        */
    },

    /**
     * @cfg {Object} fieldLabels
     * Accessible label text for each comparator field item. Can be overridden by localization
     * files. Defaults to:<pre>
fieldLabels : {
     gt: 'Greater Than',
     lt: 'Less Than',
     eq: 'Equal To'
}</pre>
     */
    fieldLabels: {
        gt: 'Greater Than',
        lt: 'Less Than',
        eq: 'Equal To'
    },

    /**
     * @cfg {Object} menuItemCfgs
     * Default configuration options for each menu item
     * Defaults to:<pre>
menuItemCfgs : {
    emptyText: 'Enter Filter Text...',
    selectOnFocus: true,
    width: 125
}
     * </pre>
     */
    menuItemCfgs : {
        emptyText: 'Enter Number...',
        selectOnFocus: false,
        width: 155
    },

    /**
     * @cfg {Array} menuItems
     * The items to be shown in this menu.  Items are added to the menu
     * according to their position within this array. Defaults to:<pre>
     * menuItems : ['lt','gt','-','eq']
     * </pre>
     */
    menuItems : ['lte', 'lt', 'gte', 'gt', '-', 'neq', 'eq'],

    plain: true,

    constructor : function (config) {
        var me = this,
            fields, fieldCfg, i, len, item, cfg, Cls;

        me.callParent(arguments);

        fields = me.fields = me.fields || {};
        fieldCfg = me.fieldCfg = me.fieldCfg || {};
        
        me.addEvents(
            /**
             * @event update
             * Fires when a filter configuration has changed
             * @param {Ext.ux.grid.filter.Filter} this The filter object.
             */
            'update'
        );
      
        me.updateTask = Ext.create('Ext.util.DelayedTask', me.fireUpdate, me);
    
        for (i = 0, len = me.menuItems.length; i < len; i++) {
            item = me.menuItems[i];
            if (item !== '-') {
                // defaults
                cfg = {
                    itemId: 'range-' + item,
                    enableKeyEvents: true,
                    hideEmptyLabel: false,
                    fieldLabel: me.itemName [item],
                    labelStyle: "color: white",
                    //labelCls: 'ux-rangemenu-icon ' + me.itemIconCls[item],
                    labelSeparator: '',
                    labelWidth: 49,
                    listeners: {
                        scope: me,
                        change: me.onInputChange,
                        keyup: me.onInputKeyUp,
                        el: {
                            click: this.stopFn
                        }
                    },
                    activate: Ext.emptyFn,
                    deactivate: Ext.emptyFn
                };
                Ext.apply(
                    cfg,
                    // custom configs
                    Ext.applyIf(fields[item] || {}, fieldCfg[item]),
                    // configurable defaults
                    me.menuItemCfgs
                );
                Cls = cfg.fieldCls || me.fieldCls;
                item = fields[item] = Ext.create(Cls, cfg);
            }
            me.add(item);
        }
        /*
        me.add ("-");
        me.add ({
            xtype: "checkbox",
            name: "isNull",
            boxLabel: "Пусто",
            style: "color: white",
            listeners: {
                change: function () {
                    this.updateTask.delay (1);
                    if (me.menu.down ("*[name=isNull]").getValue ()) {
                        me.menu.down ("*[name=isNotNull]").disable ();
                    } else {
                        me.menu.down ("*[name=isNotNull]").enable ();
                    };
                },
                scope: me
            }
        });
        me.add ({
            xtype: "checkbox",
            name: "isNotNull",
            boxLabel: "Непусто",
            style: "color: white",
            listeners: {
                change: function () {
                    this.updateTask.delay (1);
                    if (me.menu.down ("*[name=isNotNull]").getValue ()) {
                        me.menu.down ("*[name=isNull]").disable ();
                    } else {
                        me.menu.down ("*[name=isNull]").enable ();
                    };
                },
                scope: me
            }
        });
        */
    },
    
    stopFn: function(e) {
        e.stopPropagation();
    },

    /**
     * @private
     * called by this.updateTask
     */
    fireUpdate : function () {
        this.fireEvent('update', this);
    },
    
    /**
     * Get and return the value of the filter.
     * @return {String} The value of this filter
     */
    getValue : function () {
        var me = this;
        var result = {},
            fields = this.fields, 
            key, field;
            
        for (key in fields) {
            if (fields.hasOwnProperty(key)) {
                field = fields[key];
                if (field.isValid() && field.getValue() !== null) {
                    result[key] = field.getValue();
                }
            }
        }
        return result;
    },
  
    /**
     * Set the value of this menu and fires the 'update' event.
     * @param {Object} data The data to assign to this menu
     */	
    setValue : function (data) {
        var me = this,
            fields = me.fields,
            key,
            field;

        for (key in fields) {
            if (fields.hasOwnProperty(key)) {
                // Prevent field's change event from tiggering a Store filter. The final upate event will do that
                field =fields[key];
                field.suspendEvents();
                field.setValue(key in data ? data[key] : '');
                field.resumeEvents();
            }
        }

        // Trigger the filering of the Store
        me.fireEvent('update', me);
    },

    /**  
     * @private
     * Handler method called when there is a keyup event on an input
     * item of this menu.
     */
    onInputKeyUp: function(field, e) {
        if (e.getKey() === e.RETURN && field.isValid()) {
            e.stopEvent();
            //this.hide();
        this.updateTask.delay(1);
        }
    },

    /**
     * @private
     * Handler method called when the user changes the value of one of the input
     * items in this menu.
     */
    onInputChange: function(field) {
        var me = this,
            fields = me.fields,
            neq = fields.neq,
            eq = fields.eq,
            gte = fields.gte,
            gt = fields.gt,
            lte = fields.lte,
            lt = fields.lt;

        if (field == eq || field == neq) {
            if (gte) {
                gte.setValue(null);
            }
            if (gt) {
                gt.setValue(null);
            }
            if (lte) {
                lte.setValue(null);
            }
            if (lt) {
                lt.setValue(null);
            }
        }
        else {
            neq.setValue(null);
            eq.setValue(null);
        }

        // restart the timer
        //this.updateTask.delay(this.updateBuffer);
    }
});
