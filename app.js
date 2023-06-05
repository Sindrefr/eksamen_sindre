const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
require('dotenv').config()
const session = require('express-session');


app.use(express.static('public'));

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));



const uri = 'mongodb+srv://admin:eUOYaRaihHV7MwQA@cluster0.f0vgbuk.mongodb.net/quotes?retryWrites=true&w=majority';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
let usersCollection;
let quotesCollection;

// Konfigurerer MongoDB Atlas connection string
client.connect().then(() => {
    const database = client.db('quotes');
    quotesCollection = database.collection('quotes');
    usersCollection = database.collection('users');
    console.log('Database connection successful');
  }).catch(err => {
    console.log('Error connecting to the database:', err);
  });


  const requireAuth = (req, res, next) => {
  if (req.session.isLoggedIn) {
    // User is authenticated, proceed to the next middleware
    next();
  } else {
    // User is not authenticated, redirect to the login page
    res.redirect('/login');
  }
};

app.use((req, res, next) => {
  res.locals.isLoggedIn = req.session.isLoggedIn;
  res.locals.username = req.session.username;
  next();
});


app.get('/signup', (req, res) => {
    res.render('signup', { feedback: '' });
  });
  
  app.post('/signup', (req, res) => {
    const { username, password, confirmPassword } = req.body;
  
    // Sjekk om brukeren allerede eksisterer i databasen
    usersCollection.findOne({ username }).then(existingUser => {
      if (existingUser) {
        res.render('signup', { feedback: 'Brukernavn er allerede i bruk' });
      } else if (password !== confirmPassword) {
        res.render('signup', { feedback: 'Passordene samsvarer ikke' });
      } else {
        // Opprett brukeren i databasen
        usersCollection.insertOne({ username, password }).then(() => {
          res.render('signup', { feedback: 'Registrering fullført' });
        }).catch(err => {
          console.log('Error creating user:', err);
          res.render('signup', { feedback: 'ERROR' });
        });
      }
    })
  });

  app.get('/login', (req, res) => {
    res.render('login', { feedback: '' });
  });
  
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
  
    // Check if the user exists in the database
    usersCollection.findOne({ username }).then(user => {
      if (user && user.password === password) {
        // User authenticated, set session variables and redirect to their home page
        req.session.isLoggedIn = true;
        req.session.username = username;
        res.redirect(`/home/${username}`);
      } else {
        res.render('login', { feedback: 'Invalid username or password' });
      }
    }).catch(err => {
      console.log('Error checking user:', err);
      res.render('login', { feedback: 'Error during login' });
    });
  });
  
  
// Home page route
app.get('/home/:username', requireAuth, (req, res) => {
  const username = req.params.username;

  // Retrieve the quotes for the logged-in user
  quotesCollection.find({ author: username }).toArray()
    .then(quotes => {
      res.render('home', { username, quotes });
    })
    .catch(err => {
      console.log('Error retrieving quotes:', err);
      res.render('home', { username, quotes: [] });
    });
});


app.post('/addquote', requireAuth, (req, res) => {
  const username = req.session.username;
  const quote = req.body.quote;

  // Create a new quote document
  const newQuote = {
    author: username,
    content: quote
  };

  // Insert the new quote into the quotes collection
  quotesCollection.insertOne(newQuote)
    .then(() => {
      res.redirect(`/home/${username}`);
    })
    .catch(err => {
      console.log('Error adding quote:', err);
      res.redirect(`/home/${username}`);
    });
});

app.get('/author/:author', (req, res) => {
  const author = req.params.author;
  
  // Retrieve quotes by the specified author from the quotes collection
  quotesCollection.find({ author }).toArray()
    .then(quotes => {
      res.render('author', { quotes, author });
    })
    .catch(err => {
      console.log('Error retrieving quotes by author:', err);
      res.redirect('/');
    });
});





// Logout route
app.get('/logout', (req, res) => {
  // Clear the session and log out the user
  req.session.destroy();
  res.redirect('/login');
});



app.get('/', (req, res) => {
  // Retrieve a random quote from the quotes collection
  quotesCollection.aggregate([{ $sample: { size: 1 } }]).toArray().then(quotes => {
    const quote = quotes[0];
    res.render('index', { quote, isLoggedIn: req.session.isLoggedIn, username: req.session.username });
  }).catch(err => {
    console.log('Error retrieving quote:', err);
    res.render('index', { quote: null, isLoggedIn: req.session.isLoggedIn, username: req.session.username });
  });
});



  app.listen(3000, () => console.log('Listening on port 3000'));