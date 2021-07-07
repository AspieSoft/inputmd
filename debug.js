function log(){
  console.log(...arguments);
}

function time(options = {}){
  let opts = {
    minSpeed: 10,
    slowOnly: false
  };

  opts = Object.assign(opts, options);

  let speedList = {};

  function debug(id){
    if(speedList[id]){
      let t = Math.round((process.hrtime()[1] - speedList[id]) / 1000) / 1000;
      delete speedList[id];
      let slow = '';
      if(t > opts.minSpeed){
        slow = ' \x1b[31mSlow!';
      }
      if(opts.slowOnly && slow === ''){
        return t;
      }
      let timeStr = t.toString().split('.');
      if(timeStr[1].length === 2){
        timeStr[1] += '0';
      }else if(timeStr[1].length === 1){
        timeStr[1] += '00';
      }else if(timeStr[1].length === 0){
        timeStr[1] += '000';
      }
      timeStr = timeStr.join('.');
      console.log(`\x1b[32mFinished \x1b[34m\x1b[1m${id}\x1b[0m \x1b[32mIn \x1b[34m\x1b[1m${timeStr}ms\x1b[0m${slow}\x1b[0m`);
      return t;
    }
    speedList[id] = process.hrtime()[1];
    return function(){return debug(id);};
  };
  const debugSpeed = debug;

  debugSpeed.options = function(options){
    opts = Object.assign(opts, options);
  };

  debugSpeed.reset = function(id){delete speedList[id];};
  debugSpeed.resetAll = function(){speedList = {};};

  debugSpeed.new = function(options = {}){
    return time(Object.assign({...opts}, options));
  };

  return debugSpeed;
}

module.exports = (function(){
  const exports = log;

  exports.log = log;
  exports.time = time;

  return exports;
})();
