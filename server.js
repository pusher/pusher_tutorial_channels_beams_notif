require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
//Imports
var passport = require("passport");
var session = require("express-session");
var GitHubStrategy = require("passport-github2").Strategy;

const ChannelsNotifications = require('pusher');
const PushNotifications = require('@pusher/push-notifications-server');

const app = express();
const port = process.env.PORT || 3000;
const environment = process.env.ENVIRONMENT || 'production';

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');

//Auth config
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL
const SESSION_SECRET = process.env.SESSION_SECRET

//Auth middleware
passport.serializeUser(function(user, done) {
  done(null, user)
})

passport.deserializeUser(function(obj, done) {
  done(null, obj)
})

passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: GITHUB_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      
      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));

//Auth routes
var sess = { secret: SESSION_SECRET, resave: false, saveUninitialized: false, cookie: {} };
if (environment === 'production') {
  app.set('trust proxy', 1) // trust first proxy
  sess.cookie.secure = true // serve secure cookies
}
app.use(session(sess));
app.use(passport.initialize());
app.use(passport.session());

app.get("/login", (req, res) => {
  res.send("<a href='/auth/github'>Sign in With GitHub</a>")
})

app.get('/logout', function(req, res){
   req.session.destroy(function (err) {
    res.redirect('/login'); 
  })
});


app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }),
  function(req, res){
  });

app.get("/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/login" }),
  function(req, res) {
  res.redirect('/');
  });


//Render 
app.get('/', ensureAuthenticated, function(req, res){
    res.render('index', {
      user: req.user.username,
      key,
      cluster,
      channelsauthEndpoint,
      instanceId,
      beamsauthEndpoint
    })
});

/* INITIAL app.get('/', function(req, res){
    res.render('index', {
    })
});*/


//Channels config

let appId = process.env.APP_ID
let key = process.env.APP_KEY
let secret = process.env.CHANNELS_SECRET_KEY
let cluster = process.env.CLUSTER
let channelsauthEndpoint='/pusher/channels-auth'

const channelsclientConfig = {
    appId,
    key,
    secret,
    cluster,
}

const channelsClient = new ChannelsNotifications(channelsclientConfig);

//Beams config
let instanceId = process.env.INSTANCE_ID
let secretKey = process.env.BEAMS_SECRET_KEY
let beamsauthEndpoint='/pusher/beams-auth'


const beamsclientConfig = {
    instanceId,
    secretKey,
}

const beamsClient = new PushNotifications(beamsclientConfig);


//Channels Auth
app.post('/pusher/channels-auth', ensureAuthenticated, function(req, res) {
  // Do your normal auth checks here. Return forbidden if session token is invalid 🔒
  const userId = req.user.username; // Get user id from auth system based on session token
  const channelName = req.body.channel_name;
  const socketId = req.body.socket_id;
  var isUserChannel=false;
  if (channelName.startsWith('private-userchannel')){
    isUserChannel=true;
  } 
  if (isUserChannel && channelName !== 'private-userchannel-'+userId) {
    res.status(401).send('Inconsistent request'); 
  } else {
    const channelsToken = channelsClient.authenticate(socketId, channelName);
    res.send(channelsToken);
}
});


//Beams Auth
app.get('/pusher/beams-auth', ensureAuthenticated, function(req, res) {
  // Do your normal auth checks here. Return forbidden if session token is invalid 🔒
  const userId = req.user.username; // Get user id from auth system based on session token
  const userIDInQueryParam = req.query['user_id'];
  if (userId != userIDInQueryParam) {
    res.status(401).send('Inconsistent request');
  } else {
    const beamsToken = beamsClient.generateToken(userId);
    res.status(200).send(JSON.stringify(beamsToken));
  }
});

//Trigger notification
app.use(express.json());
app.post('/trigger', ensureAuthenticated, function(req, res) {
  const userId = req.user.username;
  var priorityNotification=false;
  if (req.body.highPriority===true){
    priorityNotification=true;
  }
  const data=JSON.stringify(req.body);
  //Only post to channel related to authenticated user
  const channelName = 'private-userchannel-'+userId;
  const beamsUser = userId;

channelsClient
  .trigger(channelName, "notification", data, { info: "subscription_count" })
  .then(response => {
    if (response.status !== 200) {
      throw Error("unexpected status")
    }
    // Parse the response body as JSON
    return response.json()
  })
  .then(body => {
    const channelsInfo = body.channels
    if(channelsInfo[channelName].subscription_count===0 && priorityNotification){
      beamsClient.publishToUsers([userId], {
        web: {
            notification: {
                title: req.body.notificationTitle,
                body: req.body.notificationText,
                deep_link: req.body.origin
            }
        }
    })
    .catch((error) => {
        console.log('Error:', error);
        res.status(500).send()
    });
    }
    
     res.status(200).send(); 
  })
  .catch(error => {
    console.log('Error:', error)
    res.status(500).send()
  })

});


app.listen(port, () =>
  console.log(`Channels and Beams notifications app listening on port ${port}`),
);

//Auth function
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.redirect("/login")
}
