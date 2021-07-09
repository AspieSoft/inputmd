const {join} = require('path');
const imdl = require('./index');

const express = require('express');
const app = express();

app.engine('imdl', imdl(__dirname+'/views'));
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'imdl');


imdl.cacheDev();
imdl.logSpeed();


app.get('/', (req, res) => {
  res.render('index');
});

app.get('/embed', (req, res) => {
  res.render('embed');
});

app.get('/embed2', (req, res) => {
  res.render('embed2');
});

app.listen(3000);
