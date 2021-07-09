const fs = require('fs');
const {join, dirname} = require('path');

const debug = requireOptional('./debug') || require('./debug_null');

const zlib = require('zlib');

const express = requireOptional('express');

const debugSpeed = debug.time({
  minSpeed: 3,
  slowOnly: true
});

const __ModuleVersion = '0.1.0';


// todo: add vscode extension for imdl syntax highlighting


function timeToMS(time){
  if(!time){return undefined;}
  if(typeof time === 'number'){
    return time;
  }
  let n = 0;
  let t = time.toString().replace(/([0-9]+(?:\.[0-9]+|))([a-zA-Z]|)/, (_, num, time) => {
    n = Number(num);
    return time;
  });
  if(!n){return 0;}
  if(n === -1){return Infinity;}
  if(!t){return n;}
  switch(t){
    case 's':
      return n * 1000;
    case 'm':
      return n * 60000;
    case 'h':
      return n * 3600000;
    case 'd' || 'D':
      return n * 86400000;
    case 'w' || 'W':
      return n * 86400000 * 7;
    case 'M':
      return n * 86400000 * 30;
    case 'Y' || 'y':
      return n * 86400000 * 365;
    default:
      return n;
  }
}

const info = {
  ext: 'imdl',
  dir: join(dirname(require.main.filename), 'views') || undefined,
  cache: timeToMS('2h'),
  cacheInterval: timeToMS('10m'),
  logSpeed: false
};

const cache = {};

let inDev = process.env.NODE_ENV !== 'production';


function compress(str, speed){
  const debugTime = debugSpeed.new();

  debugTime('compress');

  str = zlib.deflateSync(Buffer.from(str, 'utf8'));

  debugTime('compress');

  return {
    decomp: function(){
      debugTime('decompress');

      const result = zlib.inflateSync(str).toString('utf8');

      debugTime('decompress');
      return result;
    }
  };
}


function startCache(){
  inDev = false;
  setInterval(function(){
    let now = new Date().getTime();
    let cacheList = Object.keys(cache);
    for(let i = 0; i < cacheList.length; i++){
      if(now > cache[cacheList[i]].time + info.cache){
        delete cache[cacheList[i]];
      }
    }
  }, info.cacheInterval);

  fs.watch(info.dir, (event, file) => {
    if(file){
      delete cache[file.replace(/\.\w+$/, '')];
    }
  });
}


function requireOptional(path){
  try{
    return require(path);
  }catch(e){
    return undefined;
  }
}

function getCache(path){
  let cid = path.replace(info.dir, '').replace(/^[\/\\]+/, '').replace(/\.\w+$/, '');
  if(inDev || cache[cid] === undefined){return undefined;}
  cache[cid].time = new Date().getTime();
  if(cache[cid].data === false){
    return false;
  }
  return cache[cid].data;
}

function setCache(path, data){
  let cid = path.replace(info.dir, '').replace(/^[\/\\]+/, '').replace(/\.\w+$/, '');
  if(inDev){return undefined;}
  if(data === false){
    cache[cid] = {data: false, time: new Date().getTime()};
    return;
  }
  if(typeof data === 'string'){
    data = compress(data, 5);
  }
  cache[cid] = {data, time: new Date().getTime()};
}


function engine(path, opts, cb){
  if(info.logSpeed){opts.startTime = new Date().getTime();}
  if(!info.ext){info.ext = path.substr(path.lastIndexOf('.'));}
  if(!info.dir){info.dir = join(path, '..');}
  let cid = path.replace(info.dir, '').replace(/^[\/\\]+/, '').replace(/\.\w+$/, '');
  let data = getCache(cid);
  if(data === false){return undefined;}
  if(info.logSpeed){opts['time:'+cid] = {};}
  if(!data){
    if(!path.startsWith(info.dir)){path = join(info.dir, path);}
    if(!path.endsWith('.'+info.ext)){path += '.'+info.ext;}
    fs.readFile(path, (err, data) => {
      if(err){
        setCache(cid, false);
        return cb(err);
      }
      data = data.toString();
      if(info.logSpeed){opts['time:'+cid].startCompile = new Date().getTime();}
      if(info.beforeCompile){
        let d = info.beforeCompile.call({path, cid, data}, opts);
        if(d !== undefined){data = d;}
      }
      data = compile(data);
      setCache(cid, data);
      if(info.logSpeed){
        opts['time:'+cid].startRender = new Date().getTime();
        if(opts['time:'+cid].startCompile){
          console.log(`\x1b[31mCompiled \x1b[34m${cid} \x1b[31mIn \x1b[34m${opts['time:'+cid].startRender - opts['time:'+cid].startCompile}ms\x1b[0m`);
        }
      }
      if(info.before){
        let d = info.before.call({path, cid, data}, opts);
        if(d !== undefined){data = d;}
      }
      data = insertInputs(data, opts);
      if(info.logSpeed){
        opts['time:'+cid].finishRender = new Date().getTime();
        if(opts['time:'+cid].startCompile){
          console.log(`\x1b[35mRendered \x1b[36m${cid} \x1b[35mIn \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startRender}ms \x1b[35mTotal \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startCompile}ms\x1b[0m`);
        }else{
          console.log(`\x1b[35mRendered \x1b[36m${cid} \x1b[35mIn \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startRender}ms\x1b[0m`);
        }
      }
      if(info.after){
        let d = info.after.call({path, cid, data}, opts);
        if(d !== undefined){data = d;}
      }
      if(info.logSpeed){console.log(`\x1b[32mLoaded \x1b[33m${cid} \x1b[32mIn \x1b[33m${new Date().getTime() - opts.startTime}ms\x1b[0m`);}
      return cb(null, data.toString());
    });
  }else{
    if(info.logSpeed){
      opts['time:'+cid].startRender = new Date().getTime();
      if(opts['time:'+cid].startCompile){
        console.log(`\x1b[31mCompiled \x1b[34m${cid} \x1b[31mIn \x1b[34m${opts['time:'+cid].startRender - opts['time:'+cid].startCompile}ms\x1b[0m`);
      }
    }
    if(info.before){
      let d = info.before.call({path, cid, data}, opts);
      if(d !== undefined){data = d;}
    }
    data = insertInputs(data, opts);
    if(info.logSpeed){
      opts['time:'+cid].finishRender = new Date().getTime();
      if(opts['time:'+cid].startCompile){
        console.log(`\x1b[35mRendered \x1b[36m${cid} \x1b[35mIn \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startRender}ms \x1b[35mTotal \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startCompile}ms\x1b[0m`);
      }else{
        console.log(`\x1b[35mRendered \x1b[36m${cid} \x1b[35mIn \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startRender}ms\x1b[0m`);
      }
    }
    if(info.after){
      let d = info.after.call({path, cid, data}, opts);
      if(d !== undefined){data = d;}
    }
    if(info.logSpeed){console.log(`\x1b[32mLoaded \x1b[33m${cid} \x1b[32mIn \x1b[33m${new Date().getTime() - opts.startTime}ms\x1b[0m`);}
    return cb(null, data.toString());
  }
}

function render(path, opts, skipTemplate){
  if(info.logSpeed && !skipTemplate){opts.startTime = new Date().getTime();}
  if(!info.ext){info.ext = path.substr(path.lastIndexOf('.'));}
  if(!info.dir){info.dir = join(path, '..');}
  let cid = path.replace(info.dir, '').replace(/^[\/\\]+/, '').replace(/\.\w+$/, '');
  let data = getCache(cid);
  if(data === false){return undefined;}
  if(info.logSpeed){opts['time:'+cid] = {};}
  if(!data){
    if(!path.startsWith(info.dir)){path = join(info.dir, path);}
    if(!path.endsWith('.'+info.ext)){path += '.'+info.ext;}
    fs.readFile(path, (err, data) => {
      if(err){
        setCache(cid, false);
        return undefined;
      }
      data = data.toString();
      if(info.logSpeed){opts['time:'+cid].startCompile = new Date().getTime();}
      if(info.beforeCompile){
        let d = info.beforeCompile.call({path, cid, data}, opts);
        if(d !== undefined){data = d;}
      }
      data = compile(data);
      setCache(cid, data);
      if(info.logSpeed){
        opts['time:'+cid].startRender = new Date().getTime();
        if(opts['time:'+cid].startCompile){
          console.log(`\x1b[31mCompiled \x1b[34m${cid} \x1b[31mIn \x1b[34m${opts['time:'+cid].startRender - opts['time:'+cid].startCompile}ms\x1b[0m`);
        }
      }
      if(info.before){
        let d = info.before.call({path, cid, data}, opts);
        if(d !== undefined){data = d;}
      }
      data = insertInputs(data, opts, skipTemplate);
      if(info.logSpeed){
        opts['time:'+cid].finishRender = new Date().getTime();
        if(opts['time:'+cid].startCompile){
          console.log(`\x1b[35mRendered \x1b[36m${cid} \x1b[35mIn \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startRender}ms \x1b[35mTotal \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startCompile}ms\x1b[0m`);
        }else{
          console.log(`\x1b[35mRendered \x1b[36m${cid} \x1b[35mIn \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startRender}ms\x1b[0m`);
        }
      }
      if(info.after){
        let d = info.after.call({path, cid, data}, opts);
        if(d !== undefined){data = d;}
      }
      if(info.logSpeed && !skipTemplate){console.log(`\x1b[32mLoaded \x1b[33m${cid} \x1b[32mIn \x1b[33m${new Date().getTime() - opts.startTime}ms\x1b[0m`);}
      return data.toString();
    });
  }else{
    if(info.logSpeed){
      opts['time:'+cid].startRender = new Date().getTime();
      if(opts['time:'+cid].startCompile){
        console.log(`\x1b[31mCompiled \x1b[34m${cid} \x1b[31mIn \x1b[34m${opts['time:'+cid].startRender - opts['time:'+cid].startCompile}ms\x1b[0m`);
      }
    }
    if(info.before){
      let d = info.before.call({path, cid, data}, opts);
      if(d !== undefined){data = d;}
    }
    data = insertInputs(data, opts, skipTemplate);
    if(info.logSpeed){
      opts['time:'+cid].finishRender = new Date().getTime();
      if(opts['time:'+cid].startCompile){
        console.log(`\x1b[35mRendered \x1b[36m${cid} \x1b[35mIn \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startRender}ms \x1b[35mTotal \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startCompile}ms\x1b[0m`);
      }else{
        console.log(`\x1b[35mRendered \x1b[36m${cid} \x1b[35mIn \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startRender}ms\x1b[0m`);
      }
    }
    if(info.after){
      let d = info.after.call({path, cid, data}, opts);
      if(d !== undefined){data = d;}
    }
    if(info.logSpeed && !skipTemplate){console.log(`\x1b[32mLoaded \x1b[33m${cid} \x1b[32mIn \x1b[33m${new Date().getTime() - opts.startTime}ms\x1b[0m`);}
    return data.toString();
  }
}


function getFile(path, opts, skipTemplate, skipCompile){
  if(info.logSpeed && !skipTemplate){opts.startTime = new Date().getTime();}
  let cid = path.replace(info.dir, '').replace(/^[\/\\]+/, '').replace(/\.\w+$/, '');
  if(skipCompile){cid += '>raw';}
  let data = getCache(cid);
  if(data === false){return undefined;}
  if(info.logSpeed){opts['time:'+cid] = {};}
  if(!data){
    if(!path.startsWith(info.dir)){path = join(info.dir, path);}
    if(!path.endsWith('.'+info.ext)){path += '.'+info.ext;}
    if(fs.existsSync(path)){
      try{
        data = fs.readFileSync(path).toString();
      }catch(e){
        setCache(cid, false);
        return undefined;
      }
      if(!skipCompile){
        if(info.logSpeed){opts['time:'+cid].startCompile = new Date().getTime();}
        if(info.beforeCompile){
          let d = info.beforeCompile.call({path, cid, data}, opts);
          if(d !== undefined){data = d;}
        }
        data = compile(data);
      }else{
        data = {
          html: compress(data, 5), tags: {}
        };
      }
      setCache(cid, data);
    }else{
      setCache(cid, false);
      return undefined;
    }
  }
  if(info.logSpeed){
    opts['time:'+cid].startRender = new Date().getTime();
    if(opts['time:'+cid].startCompile){
      console.log(`\x1b[31mCompiled \x1b[34m${cid} \x1b[31mIn \x1b[34m${opts['time:'+cid].startRender - opts['time:'+cid].startCompile}ms\x1b[0m`);
    }
  }
  if(info.before){
    let d = info.before.call({path, cid, data}, opts);
    if(d !== undefined){data = d;}
  }
  data = insertInputs(data, opts, skipTemplate);
  if(info.logSpeed){
    opts['time:'+cid].finishRender = new Date().getTime();
    if(opts['time:'+cid].startCompile){
      console.log(`\x1b[35mRendered \x1b[36m${cid} \x1b[35mIn \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startRender}ms \x1b[35mTotal \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startCompile}ms\x1b[0m`);
    }else{
      console.log(`\x1b[35mRendered \x1b[36m${cid} \x1b[35mIn \x1b[36m${opts['time:'+cid].finishRender - opts['time:'+cid].startRender}ms\x1b[0m`);
    }
  }
  if(info.after){
    let d = info.after.call({path, cid, data}, opts);
    if(d !== undefined){data = d;}
  }
  if(info.logSpeed && !skipTemplate){console.log(`\x1b[32mLoaded \x1b[33m${cid} \x1b[32mIn \x1b[33m${new Date().getTime() - opts.startTime}ms\x1b[0m`);}
  return data.toString();
}


function compile(data){

  const debugTime = debugSpeed.new();

  debugTime('comp: entities');
  // escape special entities
  data = data.replace(/&;|&(\+-|\?=|\^\/|!=|<=|>=|#[scropid]|\$[cpeyruw]|#pi|[<>&\\\/"'`?=$#*|(){}\[\]]);?/gsi, (_, char) => {
    if(!char){return '&amp;';}
    switch(char.toLowerCase()){
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '*': return '&ast;';
      case '\\': return '&bsol;';
      case '/': return '&sol;';
      case '"': return '&quot;';
      case '\'': return '&apos;';
      case '`': return '&grave;';
      case '?': return '&quest;';
      case '=': return '&equals;';
      case '|': return '&verbar;';
      case '(': return '&lpar;';
      case ')': return '&rpar;';
      case '{': return '&lcub;';
      case '}': return '&rcub;';
      case '[': return '&lsqb;';
      case ']': return '&rsqb;';
      case '#s': return '&sect;';
      case '#c': return '&copy;';
      case '#r': return '&reg;';
      case '#o' || '#d': return '&deg;';
      case '#p': return '&para;';
      case '#i': return '&infin;';
      case '+-': return '&plusmn;';
      case '?=': return '&asymp;';
      case '^/': return '&radic;';
      case '!=': return '&ne;';
      case '<=': return '&le;';
      case '>=': return '&ge;';
      case '$' || '$c': return '&cent;';
      case '$p': return '&pound;';
      case '$e': return '&euro;';
      case '$y': return '&yen;';
      case '$r': return '&#8377;';
      case '$u': return '&#20803;';
      case '$w': return '&#8361;';
      case '#' || '#pi': return '&#960;';
      default: return '';
    }
  });
  debugTime('comp: entities');

  debugTime('comp: comments');
  // strip comments
  data = data.replace(/<!--.*?-->/gs, '');
  data = data.replace(/^[\s\t ]*\/\*([\r\n]|.)*?^[\s\t ]*\*\//gm, '');
  data = data.replace(/^[\s\t ]*\/\/.*$/gm, '');
  debugTime('comp: comments');


  // slow 4ms
  debugTime('comp: extract');
  // extract scripts, styles, links, and metadata
  const pulledTags = {
    script: [],
    style: [],
    link: [],
    meta: []
  };
  let includeScripts = {};

  data = data.replace(/\<(script|style)((?:[\s\t\n\r\v ]+[\w_$-]+=(?:"(?:(?<!\\)\\"|.)*?"|'(?:(?<!\\)\\'|.)*?'))*|)\>(.+?)\<\/\1\>/gsi, (str, tag, attrs, content) => {
    tag = tag.toLowerCase();
    if(tag === 'script'){
      if(info.script){
        let attrList = {};
        attrs.replace(/[\s\t\n\r\v ]+([\w_$-]+)=(["']|)((?:(?<!\\)\\["']|.)*?)\2/gs, (_, attr, q, cont) => {
          attrList[attr] = cont;
        });
        content = info.script(content, attrList);
      }
      let i = pulledTags.script.push(compress(`<script${attrs}>${content}</script>`, 3));
      return `<@script:${i}>`;
    }else if(tag === 'style'){
      if(info.style){
        let attrList = {};
        attrs.replace(/[\s\t\n\r\v ]+([\w_$-]+)=(["']|)((?:(?<!\\)\\["']|.)*?)\2/gs, (_, attr, q, cont) => {
          attrList[attr] = cont;
        });
        content = info.style(content, attrList);
      }
      let i = pulledTags.style.push(compress(`<style${attrs}>${content}</style>`, 3));
      return `<@style:${i}>`;
    }
    return str;
  });

  data = data.replace(/\<(link|meta|js|css)((?:[\s\t\n\r\v ]+[\w_$-]+=(?:"(?:(?<!\\)\\"|.)*?"|'(?:(?<!\\)\\'|.)*?'))*|)\/?\>/gsi, (str, tag, attrs) => {
    tag = tag.toLowerCase();
    if(tag === 'link'){
      if(info.link){
        let attrList = {};
        attrs.replace(/[\s\t\n\r\v ]+([\w_$-]+)=(["']|)((?:(?<!\\)\\["']|.)*?)\2/gs, (_, attr, q, cont) => {
          attrList[attr] = cont;
        });
        content = info.link(content, attrList);
      }
      let i = pulledTags.link.push(compress(`<link${attrs}>`, 1));
      return `<@link:${i}>`;
    }else if(tag === 'meta'){
      if(info.meta){
        let attrList = {};
        attrs.replace(/[\s\t\n\r\v ]+([\w_$-]+)=(["']|)((?:(?<!\\)\\["']|.)*?)\2/gs, (_, attr, q, cont) => {
          attrList[attr] = cont;
        });
        content = info.meta(content, attrList);
      }
      let i = pulledTags.meta.push(compress(`<meta${attrs}>`, 1));
      return `<@meta:${i}>`;
    }

    if(tag === 'js'){
      let attrList = {};
      let qAttrList = {};
      attrs.replace(/[\s\t\n\r\v ]+([\w_$-]+)=(["']|)((?:(?<!\\)\\["']|.)*?)\2/gs, (_, attr, q, cont) => {
        attrList[attr] = cont;
        qAttrList[attr] = q+cont+q;
      });
      if(attrList['href'] && !attrList['src']){
        attrList['src'] = attrList['href'];
        qAttrList['src'] = qAttrList['href'];
        delete attrList['href'];
        delete qAttrList['href'];
      }
      if(info.script){
        content = info.script(content, attrList);
      }
      attrs = Object.keys(qAttrList).map(attr => ` ${attr}=${qAttrList[attr]}`).join(' ');
      let i = pulledTags.script.push(compress(`<script${attrs}></script>`, 1));
      return `<@script:${i}>`;
    }else if(tag === 'css'){
      let attrList = {};
      let qAttrList = {};
      attrs.replace(/[\s\t\n\r\v ]+([\w_$-]+)=(["']|)((?:(?<!\\)\\["']|.)*?)\2/gs, (_, attr, q, cont) => {
        attrList[attr] = cont;
        qAttrList[attr] = q+cont+q;
      });
      if(attrList['src'] && !attrList['href']){
        attrList['href'] = attrList['src'];
        qAttrList['href'] = qAttrList['src'];
        delete attrList['src'];
        delete qAttrList['src'];
      }
      if(attrList['href']){
        attrList['rel'] = 'stylesheet';
        qAttrList['rel'] = '"stylesheet"';
        if(info.link){
          content = info.link(content, attrList);
        }
      }else{
        if(info.style){
          content = info.style(content, attrList);
        }
      }
      attrs = Object.keys(qAttrList).map(attr => ` ${attr}=${qAttrList[attr]}`).join(' ');
      if(attrList['href']){
        let i = pulledTags.link.push(compress(`<link${attrs}>`, 1));
        return `<@link:${i}>`;
      }
      let i = pulledTags.style.push(compress(`<style${attrs}></style>`, 1));
      return `<@style:${i}>`;
    }

    return str;
  });
  debugTime('comp: extract');

  // slow 1.5ms
  debugTime('comp: markdown');
  // compile markdown
  data = compileMarkdown(data);
  debugTime('comp: markdown');


  debugTime('comp: include');
  // add in any scripts that need to be included
  let include = Object.keys(includeScripts).map(path => {
    if(path.endsWith('.js')){
      let i = pulledTags.script.push(compress(`<script src="https://cdn.jsdelivr.net/gh/AspieSoft/inputmd@${__ModuleVersion}/scripts/${path.replace(/[^\w_\-$\/\\@]/).replace(/\.js$/, '.min.js')}"></script>`, 1));
      return `<@script:${i}>`;
    }else if(path.endsWith('.css')){
      let i = pulledTags.link.push(compress(`<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/AspieSoft/inputmd@${__ModuleVersion}/styles/${path.replace(/[^\w_\-$\/\\@]/).replace(/\.css$/, '.min.css')}">`, 1));
      return `<@link:${i}>`;
    }
    return '';
  }).join('\n');
  if(data.match(/<\/html>$/)){
    data = data.replace(/<\/html>$/, include+'\n</html>');
  }else{
    data += include;
  }
  debugTime('comp: include');

  return {
    html: compress(data, 5),
    tags: pulledTags
  };
}


function compileMarkdown(data){

  const debugTime = debugSpeed.new({minSpeed: 2.5});

  debugTime('md: form');
  function form_getValue(values, i = 0){
    let val = values[i];
    if(Array.isArray(val)){
      val = val[0];
    }
    if(typeof val === 'object'){
      val = val.value;
    }
    return val;
  }

  data = data.replace(/<form(\s+.*?|)>(.*?)<\/form>/gsi, (_, attrs, body) => {
    return `<form${attrs}>`+body.replace(/\[(\w+)(\*|)(\s+\w+|)(?:\s*((?:\s*\{(?:\s*(?:[\w_-]+:|)"(?:\\[\\"]|.)*?"\*?\s*|\s*(?:[\w_-]+:|)'(?:\\[\\']|.)*?'\*?\s*)*?\}\s*|\s*(?:[\w_-]+:|)"(?:\\[\\"]|.)*?"\*?\s*|\s*(?:[\w_-]+:|)'(?:\\[\\']|.)*?'\*?\s*)*))\](?:\{(.*?)\}|)/gs, (_, type, required, name, values, attrs) => {
      if(!attrs){attrs = '';}
      else{attrs = ' '+attrs;}
      if(name.trim() === ''){name = undefined;}
      else{name = name.trim();}
      let inputName = ` name="${name}"` || '';

      values = values.split(/(\{(?:\s*(?:[\w_-]+:|)"(?:\\[\\"]|.)*?"\*?\s*|\s*(?:[\w_-]+:|)'(?:\\[\\']|.)*?'\*?\s*)*?\}|\s*(?:[\w_-]+:|)"(?:\\[\\"]|.)*?"\*?\s*|\s*(?:[\w_-]+:|)'(?:\\[\\']|.)*?'\*?\s*)/g).filter(v => v !== '').map(value => {
        value = value.trim();
        if(value.startsWith('{') && value.endsWith('}')){
          return value.split(/(\s*(?:[\w_-]+:|)"(?:\\[\\"]|.)*?"\*?\s*|\s*(?:[\w_-]+:|)'(?:\\[\\']|.)*?'\*?\s*)/g).filter(v => v !== '' && v !== '{' && v !== '}').map((val, i) => {
            val = val.trim();
            let key = undefined;
            val = val.replace(/^([\w_-]+):/, (_, k) => {
              key = k;
              return '';
            });
            if(i === 0){
              return val.replace(/^(["'])((?:\\[\\"']|.)*?)\1\*?$/, '$2');
            }
            let def = val.endsWith('*');
            val = val.replace(/^(["'])((?:\\[\\"']|.)*?)\1\*?$/, '$2');
            return {
              key: key || val.replace(/\s/g, ''),
              value: val,
              default: def
            };
          });
        }
        let key = undefined;
        value = value.replace(/^([\w_-]+):/, (_, k) => {
          key = k;
          return '';
        });
        let def = value.endsWith('*');
        value = value.replace(/^(["'])((?:\\[\\"']|.)*?)\1\*?$/, '$2');
        return {
          key: key || value.replace(/\s/g, ''),
          value: value,
          default: def
        };
      });

      if(type === 'hidden' || type === 'hide' || type === 'value'){
        return `<input type="hidden"${inputName} value="${(form_getValue(values) || '').replace(/([\\"])/g, '\\$1')}"${required ? ' required' : ''}${attrs}>`;
      }else if(type === 'submit' || type === 'button'){
        return `<input type="${type}"${inputName} value="${(form_getValue(values) || name || type).replace(/([\\"])/g, '\\$1')}"${required ? ' required' : ''}${attrs}>`;
      }else if(type === 'label'){
        let lFor = '';
        if(name){lFor = ` for="${name}"`;}
        return `<label${lFor}${attrs}>${form_getValue(values) || name || ''}</label>`;
      }else if(type === 'select'){
        values = values.map(value => {
          if(Array.isArray(value)){
            let group = value.shift();
            value = value.map(val => `<option value="${val.key.replace(/([\\"])/g, '\\$1')}"${val.default ? ' selected' : ''}${attrs}>${val.value}</option>`).join('\n');
            return `
            <optgroup label="${group.replace(/([\\"])/g, '\\$1')}">
              ${value}
            </optgroup>
            `;
          }
          return `<option value="${value.key.replace(/([\\"])/g, '\\$1')}"${value.default ? ' selected' : ''}${attrs}>${value.value}</option>`;
        }).join('\n');
        return `
        <select${inputName}"${attrs}${required ? ' required' : ''}${attrs}>
          ${values}
        </select>
        `;
      }else if(type === 'check' || type === 'checkbox' || type === 'accept'){
        let trueValues = ['true', 'selected', 'checked'];
        let val0 = form_getValue(values);
        let val1 = form_getValue(values, 1);
        let label = undefined;
        let checked = false;
        if(val0 && trueValues.includes(val0.toLowerCase())){
          label = val1;
          checked = true;
        }else if(val1 && trueValues.includes(val1.toLowerCase())){
          label = val0;
          checked = true;
        }else if(val0){
          label = val0;
        }
        if(!label && name && name !== ''){
          label = name.replace(/[_-](\w)/g, (_, l) => ' '+l.toUpperCase());
        }
        let labelHTML = '';
        if(label){
          let lFor = '';
          if(name){lFor = ` for="${name}"`;}
          labelHTML = ` <label${lFor}${attrs}>${label}</label>`;
        }
        let acceptClass = '';
        if(type === 'accept'){acceptClass = ' class="accept"';}
        return `<input type="checkbox"${inputName}${acceptClass} value="${(label || '').replace(/([\\"])/g, '\\$1')}"${checked ? ' checked' : ''}${attrs}>${labelHTML}`;
      }else if(type === 'radio'){
        return values.map(value => {
          if(Array.isArray(value)){
            return value.map(val => `<input type="radio"${inputName} id="${val.key.replace(/([\\"])/g, '\\$1')}" value="${val.key.replace(/([\\"])/g, '\\$1')}"${value.default ? ' checked' : ''}><label for="${val.key.replace(/([\\"])/g, '\\$1')}">${val.value}</label>`).join('\n');
          }
          return `<input type="radio"${inputName} id="${value.key.replace(/([\\"])/g, '\\$1')}" value="${value.key.replace(/([\\"])/g, '\\$1')}"${value.default ? ' checked' : ''}${required ? ' required' : ''}${attrs}><label for="${value.key.replace(/([\\"])/g, '\\$1')}"${attrs}>${value.value}</label>`;
        }).join('\n');
      }else if(type === 'textarea' || type === 'textbox' || type === 'list'){
        let listClass = '';
        if(type === 'list'){listClass = ' class="list"';}
        return `<textarea${inputName}${listClass} placeholder="${(form_getValue(values) || '').replace(/([\\"])/g, '\\$1')}"${required ? ' required' : ''}${attrs}>${(form_getValue(values, 1) || '').replace(/<\/textarea>/g, '&lt;/textarea&gt;')}</textarea>`;
      }

      return `<input type="${type.replace(/([\\"])/g, '\\$1')}" placeholder="${(form_getValue(values) || '').replace(/([\\"])/g, '\\$1')}" value="${(form_getValue(values, 1) || '').replace(/([\\"])/g, '\\$1')}"${required ? ' required' : ''}${attrs}>`;
    })+'</form>';
  });
  debugTime('md: form');


  debugTime('md: fonts');
  data = data.replace(/\*\*\*([^*]+)\*\*\*/gs, '<strong><em>$1</em></strong>');
	data = data.replace(/\*\*([^*]+)\*\*/gs, '<strong>$1</strong>');
	data = data.replace(/\*([^*]+)\*/gs, '<em>$1</em>');

  data = data.replace(/__([^_]+)__/gs, '<u>$1</u>');
	data = data.replace(/~~([^~]+)~~/gs, '<s>$1</s>');
  debugTime('md: fonts');

  debugTime('md: headers');
	data = data.replace(/^\s*######\s*(.+)$/gm, '<h6>$1</h6>');
	data = data.replace(/^\s*#####\s*(.+)$/gm, '<h5>$1</h5>');
	data = data.replace(/^\s*####\s*(.+)$/gm, '<h4>$1</h4>');
	data = data.replace(/^\s*###\s*(.+)$/gm, '<h3>$1</h3>');
	data = data.replace(/^\s*##\s*(.+)$/gm, '<h2>$1</h2>');
	data = data.replace(/^\s*#\s*(.+)$/gm, '<h1>$1</h1>');
  debugTime('md: headers');

  debugTime('md: basic');
  data = data.replace(/^\s*>\s*(.+)$/gm, '<blockquote>$1</blockquote>');
	data = data.replace(/^([-*_]){3,}$/gm, '<hr>');
  debugTime('md: basic');

  debugTime('md: code');
  data = data.replace(/(?:```([\w_$-])[\r\n]+(.*?)```)/gs, (_, lang, body) => `<pre class="highlight"><code lang="${lang}">${escapeHtml(body)}</code></pre>`);
  data = data.replace(/(?:```(.*?)```)/gs, (_, body) => `<pre class="highlight"><code>${escapeHtml(body)}</code></pre>`);
	data = data.replace(/(?:`(.*?)`)/gs, (_, body) => `<code>${escapeHtml(body)}</code>`);
  debugTime('md: code');

  debugTime('md: embed');
  data = data.replace(/\!\[(.*?)\]\((.*?)\)(?:\{(.*?)\}|)/gs, (_, type, src, attrs) => {
    type = type.toLowerCase();
    src = src.split('\n').map(s => s.replace(/([\\"])/g, '\\$1'));
    if(!attrs || attrs.trim() === ''){attrs = '';}
    else if(!attrs.startsWith(' ')){attrs = ' '+attrs;}

    if(['img', 'image', 'png', 'jpg', 'jpeg', 'svg', 'gif', 'ico', 'webp'].includes(type)){
      if(src.length === 1){
        return `<img src="${src[0]}"${attrs}>`;
      }
      return `
      <picture${attrs}>
        ${src.map(s => {
          let st = undefined;
          if(!s.match(/\.\w+$/)){st = type;}
          return `<source src="${s}" type="image/${st || s.replace(/^.*\.(\w+)$/, '$1')}">`
        }).join('\n')}
        <img src="${src[src.length-1]}"${attrs}>
      </picture>
      `;
    }else if(['vid', 'video', 'mp4', 'wav'].includes(type)){
      return `
      <video${attrs}>
        ${src.map(s => {
          let st = undefined;
          if(!s.match(/\.\w+$/)){st = type;}
          return `<source src="${s}" type="video/${st || s.replace(/^.*\.(\w+)$/, '$1')}">`
        }).join('\n')}
      </video>
      `;
    }else if(['audio', 'sound', 'mp3', 'ogg'].includes(type)){
      return `
      <audio${attrs}>
        ${src.map(s => {
          let st = undefined;
          if(!s.match(/\.\w+$/)){st = type;}
          return `<source src="${s}" type="audio/${st || s.replace(/^.*\.(\w+)$/, '$1')}">`
      }).join('\n')}
      </audio>
      `;
    }else if(['iframe', 'embed', 'pdf'].includes(type)){
      if(src.length === 1){
        return `<iframe src="${src[0]}"${attrs}></iframe>`;
      }else{
        let src0 = src.shift();
        includeScripts['iframe_fallback.js'] = true;
        return `
        <iframe src="${src0}" srcFallback="0" srcFallbackList="${JSON.stringify(src)}"${attrs}></iframe>
        `;
      }
    }
  });
  debugTime('md: embed');

  debugTime('md: link');
  data = data.replace(/\[(.*?)\]\((.*?)\)(\{.*?\}|)/gs, (_, text, link, target) => {
    if(target && target !== ''){
      target = target.replace(/^\{(.*)\}$/, '$1');
      if(target === '' || target === '_b'){
        target = '_blank';
      }else if(target === '_s'){
        target = '_self';
      }else if(target === '_p'){
        target = '_parent';
      }else if(target === '_t'){
        target = '_top';
      }
      return `<a href="${link.replace(/([\\"])/g, '\\$1')}" target="${target.replace(/([\\"])/g, '\\$1')}">${escapeHtml(text)}</a>`
    }
    return `<a href="${link.replace(/([\\"])/g, '\\$1')}">${escapeHtml(text)}</a>`
  });
  data = data.replace(/([^"'`])((?!["'`])https?:\/\/(?:(?:[\w_-][\w_\-.]+)|)(?:(?:[\w.,@?^=%&:/~+#_-]*[\w.,@?^=%&:/~+#_-])|))/g, (_, q, link) => `${q}<a href="${link.replace(/([\\"])/g, '\\$1')}">${escapeHtml(link)}</a>`);
  debugTime('md: link');

  debugTime('md: list');
  function compileLists(str){
    str = str.replace(/^([\s\t ]*)([0-9]+)\.([\s\t ]*)(.*)$((?:[\r\n]\1[0-9]+\.\3(?:[\r\n]\1\3|.)*)*)/gm, (_, sp1, char, sp2, item, items) => {
      let dir = '';
      let char2 = items.match(new RegExp(`^${escapeRegex(sp1)}([0-9]+)\.${escapeRegex(sp2)}`, 'm'));
      if(char2 && char2[1] < char){
        dir = ' reversed';
      }

      items = items.split(new RegExp(`^${escapeRegex(sp1)}[0-9]+\.${escapeRegex(sp2)}`, 'gm'));
      items[0] = item;

      items = items.map(item => `<li>${item}</li>`).join('\n');
      return `
        <ol${dir}>
          ${compileLists(items)}
        </ol>
        `;
    });

    str = str.replace(/^([\s\t ]*)([-*+])([\s\t ]*)(.*)$((?:[\r\n]\1\2\3(?:[\r\n]\1\3|.)*)*)/gm, (_, sp1, char, sp2, item, items) => {
      if(!items){items = '';}
      items = items.split(new RegExp(`^${escapeRegex(sp1+char+sp2)}`, 'gm'));
      items[0] = item;
      items = items.map(item => `<li>${item}</li>`).join('\n');
      return `
      <ul>
        ${compileLists(items)}
      </ul>
      `;
    });

    return str;
  }
  data = compileLists(data);
  debugTime('md: list');


  // todo: add support for markdown tables
  // https://www.markdownguide.org/extended-syntax/

  //todo: also add checklist, definition list, forms, inputs, and more to markdown syntax

  debugTime('md: table');
  data = data.replace(/(?:^{(.*)}$[\r\n]|)^[\t ]*(\|(?:.*?\|)+)[\t ]*$((?:[\r\n]^[\t ]*(?:\|(?:.*?\|)+)[\t ]*$)+)/gm, (_, attrs, row1, rows) => {
    if(!attrs){attrs = '';}
    else{attrs = ' '+attrs;}
    
    rows = rows.split('\n');
    rows[0] = row1;
    rows = rows.map(row => row.split(/[\s\t ]*\|[\s\t ]*/g).filter(i => i.trim() !== ''));
    if(rows[1][0].match(/^-+$/)){
      rows.splice(1, 1);
    }

    let rowSize = 0;
    rows = rows.map((row, i) => {
      if(i === 0){
        rowSize = row.length;
        return '<tr>'+row.map(col => `<th>${col.replace(/^-+$/, '<hr>')}</th>`).join('\n')+'</tr>';
      }
      let altRow = '';
      if(row.length === 0){
        altRow = ' class="blank"';
      }else if(row.length < rowSize){
        altRow = ' class="small"';
      }else if(row.length > rowSize){
        altRow = ' class="big"';
      }
      return `<tr${altRow}>`+row.map(col => `<td>${col.replace(/^-+$/, '<hr>')}</td>`).join('\n')+'</tr></tr>';
    }).join('\n');

    return `<table${attrs}>${rows}</table>`;
  });
  debugTime('md: table');


  debugTime('md: paragraph');
  data = data.replace(/(?:^{(.*)}$[\r\n]|)(^[\w*_~].*$(?:[\r\n]^[\w*_~].*$)*)/gm, (_, attrs, body) => {
    if(!attrs){attrs = '';}
    else{attrs = ' '+attrs;}
    return `<p${attrs}>${body}</p>`;
  });
  debugTime('md: paragraph');

  return data;
}


function insertInputs({html, tags}, opts, skipTemplate){

  const debugTime = debugSpeed.new();

  html = html.decomp();

  debugTime('ren: inputs');
  html = html.replace(/\{\{\{(.*?)\}\}\}|\{\{(.*?)\}\}/g, (origStr, html, text) => {
    let str = '';
    let esc = true;
    let attr = undefined;
    let quote = undefined;

    if(html && html !== ''){
      str = html.toString();
      esc = false;
    }else if(text && text !== ''){
      str = text.toString();
    }

    if(str.startsWith('#')){
      let file = getFile(str.replace('#', ''), opts, true, esc);
      if(!file){return origStr;}
      if(esc){
        return escapeHtml(file);
      }
      return file;
    }

    if(opts[str] === undefined || opts[str] === null){
      return origStr;
    }

    str = str.replace(/^([\w_$-]+)=(["']|)(.*?)\2$/, (_, a, q, s) => {
      attr = a;
      if(!q || q === ''){
        quote = '"';
      }else{
        quote = q;
      }
      return s;
    });

    str = opts[str];

    if(typeof str === 'function'){
      str = str(opts);
    }

    try{
      str = JSON.parse(str);
    }catch(e){}

    if(esc){
      str = escapeHtml(str);
    }

    if(attr){
      return `${attr}=${quote}${str.replace(/([\\"'])/g, '\\$1')}${quote}`;
    }

    return str;
  });
  debugTime('ren: inputs');

  debugTime('ren: extracted');
  html = html.replace(/\{\{\{?-(script|style|link|meta)\}\}\}?/gs, (str, tag) => {
    if(['script', 'style', 'link', 'meta'].includes(tag.toLowerCase())){
      if(!tags[tag]){return str;}
      let result = [];
      for(let i = 0; i < tags[tag].length; i++){
        result.push(tags[tag][i].decomp());
      }
      tags[tag] = undefined;
      return result.join('\n');
    }
    return str;
  });

  html = html.replace(/\<@(script|style|link|meta):([0-9]+)\>/g, (_, tag, i) => {
    i = Number(i)-1;
    if(tags[tag] && tags[tag][i]){
      if(opts.nonce){
        if(typeof opts.nonce === 'object' && opts.nonce[tag]){
          return tags[tag][i].decomp().replace(/\>$/, ` nonce="${opts.nonce[tag]}">`);
        }else if(tag === 'script'){
          return tags[tag][i].decomp().replace(/\>$/, ` nonce="${opts.nonce}">`);
        }
      }
      return tags[tag][i].decomp();
    }
    return '';
  });
  debugTime('ren: extracted');

  html = html.replace(/\{\{\{?.*?\}\}\}?/g, '');

  if(info.template && !skipTemplate && !opts.noTemplate && !opts.noLayout){
    return getFile(info.template, {body: html, ...opts}, true);
  }
  return html;
}


function escapeHtml(str){if(!str && str !== 0 && str !== false){return null;} return str.toString().replace(/&(?!(amp|gt|lt|sol|bsol|lbrace|rbrace);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/{/g, '&lbrace;').replace(/}/g, '&rbrace;');}
function unescapeHtml(str){if(!str && str !== 0 && str !== false){return null;} return str.toString().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&lbrace;/g, '{').replace(/&rbrace;/g, '}');}
function escapeRegex(str){return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');}


module.exports = (function(){
  const exports = function(pathOrOpts, opts){
    if(express !== undefined){
      if(typeof pathOrOpts === 'string'){
        info.dir = pathOrOpts;
      }else{
        opts = pathOrOpts;
      }
      if(typeof opts === 'object'){
        info.ext = opts.ext || opts.type || info.ext;
        info.dir = opts.dir || opts.path || info.dir;
        info.template = opts.template || opts.layout || opts.temp;
        info.beforeCompile = opts.beforeCompile || opts.beforeComp;
        info.before = opts.before;
        info.after = opts.after;
        info.cache = timeToMS(opts.cache) || info.cache;
        info.cacheInterval = timeToMS(opts.cacheInterval) || timeToMS(opts.cacheSpeed) || info.cacheInterval;
        info.script = opts.script || opts.js;
        info.style = opts.style || opts.css;
        info.link = opts.link;
        info.meta = opts.meta;
      }
      if(!inDev){startCache();}
      return engine;
    }else if(typeof pathOrOpts === 'object'){
      info.ext = pathOrOpts.ext || pathOrOpts.type || info.ext;
      info.dir = pathOrOpts.dir || pathOrOpts.path || info.dir;
      info.template = pathOrOpts.template || pathOrOpts.layout || pathOrOpts.temp;
      info.beforeCompile = pathOrOpts.beforeCompile || pathOrOpts.beforeComp;
      info.before = pathOrOpts.before;
      info.after = pathOrOpts.after;
      info.cache = timeToMS(pathOrOpts.cache) || info.cache;
      info.cacheInterval = timeToMS(opts.cacheInterval) || timeToMS(opts.cacheSpeed) || info.cacheInterval;
      info.script = pathOrOpts.script || pathOrOpts.js;
      info.style = pathOrOpts.style || pathOrOpts.css;
      info.link = pathOrOpts.link;
      info.meta = pathOrOpts.meta;
      if(!inDev){startCache();}
      return render;
    }
    if(!inDev){startCache();}
    return render(pathOrOpts, opts);
  };

  exports.engine = engine;
  exports.render = render;
  exports.get = getFile;

  exports.escapeHtml = escapeHtml;
  exports.unescapeHtml = unescapeHtml;
  exports.escapeRegex = escapeRegex;

  exports.cacheDev = startCache;
  exports.logSpeed = function(){info.logSpeed = true;};

  exports.beforeCompile = function(cb){info.beforeCompile = cb;};
  exports.before = function(cb){info.before = cb;};
  exports.after = function(cb){info.after = cb;};

  return exports;
})();
