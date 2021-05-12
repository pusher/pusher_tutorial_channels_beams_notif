//Tutorials skeleton
require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
//Imports

const app = express();
const port = process.env.PORT || 3000;
const environment = process.env.ENV || 'production';

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');

//Auth config


//Auth middleware


//Auth routes


//Render 
app.get('/', function(req, res){
    res.render('index', {
    })
});


//Channels config


//Beams config


//Channels Auth


//Beams Auth


//Trigger notification


app.listen(port, () =>
  console.log(`Channels and Beams notifications app listening on port ${port}`),
);

//Auth function

