///
/// LOG.IO WINSTON TRANSPORT USE NODE EMITTER NO SOCKET.
///

var os = require('os');

var net = require('net');

var util = require('util');

var winston = require('winston');


var LogIO = exports.LogIO = function (options) {

    winston.Transport.call(this, options);

    options = options || {};

    this.name       = 'logio';
    this.localhost  = options.localhost || os.hostname();
    this.node_name  = options.node_name || process.title;
    this.pid        = options.pid || process.pid;

    this.connected = false;

    // Protocol definition
    this.delimiter = '\r\n';

    this.connect();
};

//
// Inherit from `winston.Transport`.
//
util.inherits(LogIO, winston.Transport);

//
// Define a getter so that `winston.transports.LogIO`
// is available and thus backwards compatible.
//
winston.transports.LogIO = LogIO;


LogIO.prototype.log = function (level, msg, meta, callback) {
    var self = this;
    meta = winston.clone(meta || {});

    if (self.silent) {
        return callback(null, true);
    }

    var humanizeJSON = function (json) {
        var humanized_json = '';

        if (json && json instanceof Object &&
            Object.keys(json).length > 0) {
            humanized_json = ', meta: ';
            for(var item in json) {
                humanized_json += [item, json[item]].join('=') + ' ';
            }
        }
        return humanized_json;
    };

    // Log format
    var log_entry = [
        '+log',    
        self.node_name,
        self.localhost,
        level,
        [msg, humanizeJSON(meta)].join('')
    ];

    if (!self.connected) {
        self.log_queue.push({
            message: log_entry,
            callback: function () {
//                self.emit('logged');
//                callback(null, true);
            }
        });
    } else {
        self.emitLog(log_entry, function () {
//            self.emit('logged');
//            callback(null, true);
        });
    }
};

LogIO.prototype.connect = function () {
    var self = this;
    this.socket = new net.Socket();

    this.socket.on('error', function (err) {
        self.connected = false;
        self.socket.destroy();

        if (self.retries < 3) {
            self.retries++;

            setTimeout(function () {
                self.connect();
            }, 100);
        } else {
            self.log_queue = [];
            self.silent = true;
        }
    });

    this.socket.on('timeout', function() {
        if (self.socket.readyState !== 'open') {
            self.socket.destroy();
        }
    });

    this.socket.on('close', function () {
        self.connected = false;
        self.connect();
    });

    this.socket.connect(self.port, self.host, function () {
        self.announce();
    });
};

LogIO.prototype.announce = function () {
    var data = '+node|' + this.localhost +'|'+
            this.node_name + this.delimiter;

    this.logio.emit('data', data);
    
    this.connected = true;
    this.flush();
};

LogIO.prototype.flush = function () {
    for (var i = 0; i < this.log_queue.length; i++) {
        this.emitLog(this.log_queue[i].message, this.log_queue[i].callback);
        this.emit('logged');
    }
    this.log_queue.length = 0;
};

LogIO.prototype.emitLog = function (message, callback) {
    var log_message = message.join('|') + this.delimiter;

    this.logio.emit('data', log_message);
    callback();
};
