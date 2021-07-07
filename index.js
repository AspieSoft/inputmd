const fs = require('fs');
const {join, dirname} = require('path');

const cwscLib = require('@aspiesoft/cwsclib');

const express = requireOptional('express');


const __ModuleVersion = '0.0.1';


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
  cache: timeToMS('2h'),
  ext: 'imdl',
  dir: join(dirname(require.main.filename), 'views') || undefined
};

const cache = {};

const inDev = process.env.NODE_ENV !== 'production';


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
  }, 10000);
}
if(!inDev){
  startCache();
}


function requireOptional(path){
  try{
    return require(path);
  }catch(e){
    return undefined;
  }
}

function getCache(path){
  if(inDev || cache[path] === undefined){return undefined;}
  if(cache[path].data === false){
    return false;
  }
  return cache[path].data.decomp();
}

function setCache(path, data){
  if(inDev){return undefined;}
  if(data === false){
    cache[path] = {data: false, time: new Data().getTime()};
    return;
  }
  cache[path] = {data: cwscLib.compress(data, 5), time: new Data().getTime()};
}


function engine(path, opts, cb){
  if(!info.ext){info.ext = path.substr(path.lastIndexOf('.'));}
  if(!info.dir){info.dir = join(path, '..');}
  let cid = path.replace(info.dir, '');
  let data = getCache(cid);
  if(data === false){return undefined;}
  if(!data){
    if(!path.startsWith(info.dir)){path = join(info.dir, path);}
    if(!path.endsWith('.'+info.ext)){path += '.'+info.ext;}
    fs.readFile(path, (err, data) => {
      if(err){
        setCache(cid, false);
        return cb(err);
      }
      data = data.toString();
      if(info.beforeCompile){
        let d = info.beforeCompile(data, opts);
        if(d !== undefined){data = d;}
      }
      data = compile(data);
      setCache(cid, data);
      if(info.before){
        let d = info.before(data, opts);
        if(d !== undefined){data = d;}
      }
      data = insertInputs(data, opts);
      if(info.after){
        let d = info.after(data, opts);
        if(d !== undefined){data = d;}
      }
      return cb(null, data.toString());
    });
  }else{
    if(info.before){
      let d = info.before(data, opts);
      if(d !== undefined){data = d;}
    }
    data = insertInputs(data, opts);
    if(info.after){
      let d = info.after(data, opts);
      if(d !== undefined){data = d;}
    }
    return cb(null, data.toString());
  }
}

function render(path, opts, skipTemplate){
  if(!info.ext){info.ext = path.substr(path.lastIndexOf('.'));}
  if(!info.dir){info.dir = join(path, '..');}
  let cid = path.replace(info.dir, '');
  let data = getCache(cid);
  if(data === false){return undefined;}
  if(!data){
    if(!path.startsWith(info.dir)){path = join(info.dir, path);}
    if(!path.endsWith('.'+info.ext)){path += '.'+info.ext;}
    fs.readFile(path, (err, data) => {
      if(err){
        setCache(cid, false);
        return undefined;
      }
      data = data.toString();
      if(info.beforeCompile){
        let d = info.beforeCompile(data, opts);
        if(d !== undefined){data = d;}
      }
      data = compile(data);
      setCache(cid, data);
      if(info.before){
        let d = info.before(data, opts);
        if(d !== undefined){data = d;}
      }
      data = insertInputs(data, opts, skipTemplate);
      if(info.after){
        let d = info.after(data, opts);
        if(d !== undefined){data = d;}
      }
      return data.toString();
    });
  }else{
    if(info.before){
      let d = info.before(data, opts);
      if(d !== undefined){data = d;}
    }
    data = insertInputs(data, opts, skipTemplate);
    if(info.after){
      let d = info.after(data, opts);
      if(d !== undefined){data = d;}
    }
    return data.toString();
  }
}


function getFile(path, opts, skipTemplate){
  let cid = path.replace(info.dir, '');
  let data = getCache(cid);
  if(data === false){return undefined;}
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
      if(info.beforeCompile){
        let d = info.beforeCompile(data, opts);
        if(d !== undefined){data = d;}
      }
      data = compile(data);
      setCache(cid, data);
    }else{
      setCache(cid, false);
      return undefined;
    }
  }
  if(info.before){
    let d = info.before(data, opts);
    if(d !== undefined){data = d;}
  }
  data = insertInputs(data, opts, skipTemplate);
  if(info.after){
    let d = info.after(data, opts);
    if(d !== undefined){data = d;}
  }
  return data.toString();
}


function compile(data){
  // escape special entities
  data = data.replace(/&;|&(\+-|\?=|\^\/|!=|<=|>=|#[scropid]|\$[cpeyruw]|#pi|[<>&\\\/"'`?=$#*]);?/gsi, (_, char) => {
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

  // strip comments
  data = data.replace(/<!--.*?-->/gs, '');
  data = data.replace(/^[\s\t ]*\/\*([\r\n]|.)*?^[\s\t ]*\*\//gm, '');
  data = data.replace(/^[\s\t ]*\/\/.*$/gm, '');

  // extract scripts, styles, links, and metadata
  const pulledTags = {
    script: [],
    style: [],
    link: [],
    meta: []
  };
  let includeScripts = {};

  data.replace(/\<(script|style)((?:[\s\t\n\r\v ]+[\w_$-]+=(?:"((?<!\\)\\"|.)*?"|'((?<!\\)\\'|.)*?'))*|)\>(.+?)\<\/\1\>/gsi, (str, tag, attrs, content) => {
    if(tag.toLowerCase() === 'script'){
      if(info.script){
        let attrList = {};
        attrs.replace(/[\s\t\n\r\v ]+([\w_$-]+)=(["']|)((?:(?<!\\)\\["']|.)*?)\2/gs, (_, attr, q, cont) => {
          attrList[attr] = cont;
        });
        content = info.script(content, attrList);
      }
      let i = pulledTags.script.push(cwscLib.compress(`<script${attrs}>${content}</script>`, 3));
      return `<@script:${i}>`;
    }
    if(tag.toLowerCase() === 'style'){
      if(info.style){
        let attrList = {};
        attrs.replace(/[\s\t\n\r\v ]+([\w_$-]+)=(["']|)((?:(?<!\\)\\["']|.)*?)\2/gs, (_, attr, q, cont) => {
          attrList[attr] = cont;
        });
        content = info.style(content, attrList);
      }
      let i = pulledTags.style.push(cwscLib.compress(`<style${attrs}>${content}</style>`, 3));
      return `<@style:${i}>`;
    }
    return str;
  });

  data = data.replace(/\<(link|meta)((?:[\s\t\n\r\v ]+[\w_$-]+=(?:"((?<!\\)\\"|.)*?"|'((?<!\\)\\'|.)*?'))*|)\>/gsi, (str, tag, attrs) => {
    if(tag.toLowerCase() === 'link'){
      if(info.link){
        let attrList = {};
        attrs.replace(/[\s\t\n\r\v ]+([\w_$-]+)=(["']|)((?:(?<!\\)\\["']|.)*?)\2/gs, (_, attr, q, cont) => {
          attrList[attr] = cont;
        });
        content = info.link(content, attrList);
      }
      let i = pulledTags.link.push(cwscLib.compress(`<link${attrs}>`, 1));
      return `<@link:${i}>`;
    }
    if(tag.toLowerCase() === 'meta'){
      if(info.meta){
        let attrList = {};
        attrs.replace(/[\s\t\n\r\v ]+([\w_$-]+)=(["']|)((?:(?<!\\)\\["']|.)*?)\2/gs, (_, attr, q, cont) => {
          attrList[attr] = cont;
        });
        content = info.meta(content, attrList);
      }
      let i = pulledTags.meta.push(cwscLib.compress(`<meta${attrs}>`, 1));
      return `<@meta:${i}>`;
    }
    return str;
  });


  // compile markdown to html

  data = data.replace(/\*\*\*([^*]+)\*\*\*/gs, '<strong><em>$1</em></strong>');
	data = data.replace(/\*\*([^*]+)\*\*/gs, '<strong>$1</strong>');
	data = data.replace(/\*([^*]+)\*/gs, '<em>$1</em>');

  data = data.replace(/__([^_]+)__/gs, '<u>$1</u>');
	data = data.replace(/~~([^~]+)~~/gs, '<s>$1</s>');

	data = data.replace(/^\s*######\s*(.+)$/gm, '<h6>$1</h6>');
	data = data.replace(/^\s*#####\s*(.+)$/gm, '<h5>$1</h5>');
	data = data.replace(/^\s*####\s*(.+)$/gm, '<h4>$1</h4>');
	data = data.replace(/^\s*###\s*(.+)$/gm, '<h3>$1</h3>');
	data = data.replace(/^\s*##\s*(.+)$/gm, '<h2>$1</h2>');
	data = data.replace(/^\s*#\s*(.+)$/gm, '<h1>$1</h1>');

  data = data.replace(/^\s*>\s*(.+)$/gm, '<blockquote>$1</blockquote>');

	data = data.replace(/^([-*_]){3,}$/gm, '<hr>');

  data = data.replace(/(?:```([\w_$-])[\r\n]+(.*?)```)/gs, (_, lang, body) => `<pre class="highlight"><code lang="${lang}">${escapeHtml(body)}</code></pre>`);
  data = data.replace(/(?:```(.*?)```)/gs, (_, body) => `<pre class="highlight"><code>${escapeHtml(body)}</code></pre>`);
	data = data.replace(/(?:`(.*?)`)/gs, (_, body) => `<code>${escapeHtml(body)}</code>`);

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

  data = data.replace(/\[(.*?)\]\((.*?)\)/gs, (_, text, link) => `<a href="${link.replace(/([\\"])/g, '\\$1')}">${escapeHtml(text)}</a>`);
  data = data.replace(/([^"'`])((?!["'`])https?:\/\/(?:(?:[\w_-][\w_\-.]+)|)(?:(?:[\w.,@?^=%&:/~+#_-]*[\w.,@?^=%&:/~+#_-])|))/g, (_, q, link) => `${q}<a href="${link.replace(/([\\"])/g, '\\$1')}">${escapeHtml(link)}</a>`);

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


  // todo: add support for markdown tables
  // https://www.markdownguide.org/extended-syntax/

  //todo: also add checklist, definition list, forms, inputs, and more to markdown syntax


  // add in any scripts that need to be included
  let include = Object.keys(includeScripts).map(path => {
    if(path.endsWith('.js')){
      let i = pulledTags.script.push(cwscLib.compress(`<script src="https://cdn.jsdelivr.net/gh/AspieSoft/inputmd@${__ModuleVersion}/scripts/${path.replace(/[^\w_\-$\/\\@]/).replace(/\.js$/, '.min.js')}"></script>`, 1));
      return `<@script:${i}>`;
    }else if(path.endsWith('.css')){
      let i = pulledTags.link.push(cwscLib.compress(`<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/AspieSoft/inputmd@${__ModuleVersion}/styles/${path.replace(/[^\w_\-$\/\\@]/).replace(/\.css$/, '.min.css')}">`, 1));
      return `<@link:${i}>`;
    }
    return '';
  }).join('\n');

  if(data.match(/<\/html>$/)){
    data.replace(/<\/html>$/, include+'\n</html>');
  }else{
    data += include;
  }


  return {
    html: cwscLib.compress(data, 5),
    tags: pulledTags
  };
}

function insertInputs({html, tags}, opts, skipTemplate){
  html = html.decomp();

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
      let file = getFile(str.replace('#', ''), opts, true);
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

  html = html.replace(/\{\{\{?-(script|style|link|meta)\}\}\}?/gs, (str, tag) => {
    if(['script', 'style', 'link', 'meta'].includes(tag.toLowerCase())){
      let result = [];
      for(let i = 0; i < tags[tag].length; i++){
        result.push(tags[tag][i]);
      }
      tags[tag] = undefined;
      return result.join('\n');
    }
    return str;
  });

  html = html.replace(/\<@(script|style|link|meta):([0-9]+)\>/g, (tag, i) => {
    if(tags[tag] && tags[tag][Number(i)]){
      if(opts.nonce){
        if(typeof opts.nonce === 'object' && opts.nonce[tag]){
          return tags[tag][Number(i)].replace(/\>$/, ` nonce="${opts.nonce[tag]}">`);
        }else if(tag === 'script'){
          return tags[tag][Number(i)].replace(/\>$/, ` nonce="${opts.nonce}">`);
        }
      }
      return tags[tag][Number(i)];
    }
    return '';
  });

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
        info.script = opts.script || opts.js;
        info.style = opts.style || opts.css;
        info.link = opts.link;
        info.meta = opts.meta;
      }
      return engine;
    }else if(typeof pathOrOpts === 'object'){
      info.ext = pathOrOpts.ext || pathOrOpts.type || info.ext;
      info.dir = pathOrOpts.dir || pathOrOpts.path || info.dir;
      info.template = pathOrOpts.template || pathOrOpts.layout || pathOrOpts.temp;
      info.beforeCompile = pathOrOpts.beforeCompile || pathOrOpts.beforeComp;
      info.before = pathOrOpts.before;
      info.after = pathOrOpts.after;
      info.cache = timeToMS(pathOrOpts.cache) || info.cache;
      info.script = pathOrOpts.script || pathOrOpts.js;
      info.style = pathOrOpts.style || pathOrOpts.css;
      info.link = pathOrOpts.link;
      info.meta = pathOrOpts.meta;
      return render;
    }
    return render(pathOrOpts, opts);
  };

  exports.engine = engine;
  exports.render = render;
  exports.get = getFile;

  exports.escapeHtml = escapeHtml;
  exports.unescapeHtml = unescapeHtml;
  exports.escapeRegex = escapeRegex;

  exports.cacheDev = startCache;

  return exports;
})();
