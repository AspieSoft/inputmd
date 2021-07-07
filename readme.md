# Input MD

![npm](https://img.shields.io/npm/v/inputmd)
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/inputmd)
![GitHub top language](https://img.shields.io/github/languages/top/aspiesoft/inputmd)
![NPM](https://img.shields.io/npm/l/inputmd)

![npm](https://img.shields.io/npm/dw/inputmd)
![npm](https://img.shields.io/npm/dm/inputmd)

[![paypal](https://img.shields.io/badge/buy%20me%20a%20coffee-paypal-blue)](https://buymeacoffee.aspiesoft.com/)

A simple and fast view engine that supports basic markdown syntax.

The goal of this module is to provide a minimal view engine, while including some of the basic functionalities you may need.
Basic markdown is compiled and cached from the actual file, to keep things fast.
Basic inputs are handled with a handlebars syntax without the complex functions of hbs.
You can import other files in a simple way and can also setup a default template.

Not every part of markdown is included, and some changes were made for better html compatibility.
Leaving a small amount of markdown so you can have more control over the style of your website.

## Installation

```shell script
npm install @aspiesoft/inputmd
```

## Setup

```js
const imdl = require('@aspiesoft/inputmd');

// express
const express = require('express');
const app = express();

app.engine('imdl', imdl(__dirname+'/views', {template: 'layout', cache: '2h'}));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'imdl');

```

## Usage

```js

// express
app.get('/', (req, res) => {
  res.render('index', {randomInput: 'My Var Input'});
});

// other
let htmlOutput = imdl('index', {
  randomInput: 'My Var Input',
  functionInput: function(options){
    // do stuff...
    options === this Object
    return 'something';
  }
});

```

```html

# Heading 1

***Bold Italic***

> Block Quote

<!-- To grab any js input -->
{{randomInput}}

<!-- If you pass a function, it will run and display its return value -->
{{functionInput}}

<!-- Import any other imdl file (or the extension you chose) using a # -->
{{{#common/header}}}


<!-- HTML vs escaped HTML -->

// using {{2}} will escape HTML entities
{{escapedHTML}}

// using {{{3}}} will keep HTML entities
{{{validHTML}}}


<!-- This is a comment -->

/*
  This is also a comment
*/

// This is an inline comment

For improved compatibility with HTML, the extra comments will not work if there are any non whitespace characters in front of them on the same line

and /*
  this is not a comment
*/

and // this is not a comment


List
 - item1
 - item2
   - subitem
 - item3

Ordered List
 1. item
 2. item
 3. item

Ordered List (reverse)
 3. item
 2. item
 1. item


<!-- Links -->

// basic markdown
[AspieSoft](https://www.aspiesoft.com)

// also will auto convert
https://www.aspiesoft.com

// will leave quoted links alone for HTML compatibility
<a href="https://www.aspiesoft.com">AspieSoft</a>


<!-- Embeds (a bit different than vanilla markdown) -->
![image](/my/image.png)

![video](/my/video.mp4)

![embed](https://www.youtube.com/embed/iframeVideo)

// you can also setup backup images
![img](
  /my/image.webp
  /my/image.png
  /my/image.jpg
)

// and you can pass inline attributes

![mp4](/my/video.mp4){autoplay class="video-style" style="..."}

```

There are also some shortcuts for common html entities

| shortcut | entity |
| -------- | ------ |
| &< | &lt; |
| &> | &gt; |
| &; | &amp; |
| && | &amp; |
| &* | &ast; |
| &/ | &sol; |
| &\ | &bsol; |
| &" | &quot; |
| &' | &apos; |
| &` | &grave; |
| &? | &quest; |
| &= | &equals; |
| |
| &+- | &plusmn; |
| &?= | &asymp; |
| &!= | &ne; |
| &<= | &le; |
| &>= | &ge; |
| &^/ | &radic; |
|  |
| &# | &#960; |
| &#pi | &#960; |
| &#s | &sect; |
| &#p | &para; |
| &#c | &copy; |
| &#r | &reg; |
| &#o | &deg; |
| &#d | &deg; |
| &#i | &infin; |
| |
| &$ | &cent; |
| &$c | &cent; |
| &$p | &pound; |
| &$e | &euro; |
| &$y | &yen; |
| &$r | &#8377; |
| &$u | &#20803; |
| &$w | &#8361; |
