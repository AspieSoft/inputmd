function log(){
  
}

function time(){
  let speedList = {};

  function debug(id){
    if(speedList[id]){
      delete speedList[id];
      return 0;
    }
    speedList[id] = true;
    return function(){return debug(id);};
  };
  const debugSpeed = debug;

  debugSpeed.options = function(){
    
  };

  debugSpeed.reset = function(id){delete speedList[id];};
  debugSpeed.resetAll = function(){speedList = {};};

  debugSpeed.new = function(){
    return time();
  };

  return debugSpeed;
}

module.exports = (function(){
  const exports = log;

  exports.log = log;
  exports.time = time;

  return exports;
})();
