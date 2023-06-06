const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();
require('dotenv').config();
const session = require('express-session');
const sessionSecret = process.env.SECRET_KEY;

app.use(express.static('public'));

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Konfigurerer Express session
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false
}));

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
let usersCollection;
let quotesCollection;

// Kobler til MongoDB-databasen
client.connect().then(() => {
  const database = client.db('quotes');
  quotesCollection = database.collection('quotes');
  usersCollection = database.collection('users');
  console.log('Database connection successful');
}).catch(err => {
  console.log('Error connecting to the database:', err);
});

// Middleware for å sjekke om bruker er autentisert
function requireAuth(req, res, next) {
  // Sjekker om bruker er autentisert
  if (req.session.isLoggedIn) {
    // Sjekker om det forespurte brukernavnet samsvarer med det autentiserte brukernavnet
    if (req.params.username === req.session.username) {
      // Bruker er autentisert og får tilgang til siden
      next();
    } else {
      // Hvis brukeren prøver å få tilgang til en annen brukers side
      res.sendStatus(403); // Returnerer forbudt status
    }
  } else {
    // Bruker er ikke autentisert
    res.redirect('/login'); // Omdirigerer til innloggingssiden
  }
}

// Middleware for å dele tilgang til isLoggedIn og username-variabler i alle views
app.use((req, res, next) => {
  res.locals.isLoggedIn = req.session.isLoggedIn;
  res.locals.username = req.session.username;
  next();
});

// Registreringsrute
app.get('/signup', (req, res) => {
  res.render('signup', { feedback: '' });
});

app.post('/signup', (req, res) => {
  const { username, password, confirmPassword } = req.body;

  // Sjekker om brukeren allerede eksisterer i databasen
  usersCollection.findOne({ username }).then(existingUser => {
    if (existingUser) {
      res.render('signup', { feedback: 'Brukernavn er allerede i bruk' });
    } else if (password !== confirmPassword) {
      res.render('signup', { feedback: 'Passordene samsvarer ikke' });
    } else {
      // Oppretter brukeren i databasen
      usersCollection.insertOne({ username, password }).then(() => {
        res.render('signup', { feedback: 'Registrering fullført' });
      });
    }
  });
});

// Innloggingsrute
app.get('/login', (req, res) => {
  res.render('login', { feedback: '' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Sjekker om brukeren eksisterer i databasen
  usersCollection.findOne({ username }).then(user => {
    if (user && user.password === password) {
      // Bruker autentisert, setter sesjonsvariabler og omdirigerer til deres hjemmeside
      req.session.isLoggedIn = true;
      req.session.username = username;
      res.redirect(`/home/${username}`);
    } else {
      res.render('login', { feedback: 'Ugyldig brukernavn eller passord' });
    }
  });
});

// Hjemmeside-rute
app.get('/home/:username', requireAuth, (req, res) => {
  const username = req.params.username;

  // Henter quotene for den innloggede brukeren
  quotesCollection.find({ author: username }).toArray()
    .then(quotes => {
      res.render('home', { username, quotes });
    });
});

// Rute for å legge til en quote
app.post('/addquote', (req, res) => {
  const username = req.session.username;
  const quote = req.body.quote;

  // Oppretter et nytt quote-dokument
  const newQuote = {
    author: username,
    content: quote
  };

  // Legger til den nye quoten i quotes-samlingen
  quotesCollection.insertOne(newQuote)
    .then(() => {
      res.redirect(`/home/${username}`);
    });
});

// Oppdatere quotes
app.post('/updatequote/:quoteId', (req, res) => {
  const quoteId = req.params.quoteId;
  const username = req.session.username;
  const updatedQuote = req.body.updatedQuote;

  // Oppdaterer quoten i quotes-samlingen
  quotesCollection.updateOne(
    { _id: new ObjectId(quoteId), author: username },
    { $set: { content: updatedQuote } }
  )
    .then(() => {
      res.redirect(`/home/${username}`);
    })
    .catch(err => {
      console.log('Error updating quote:', err);
      res.redirect(`/home/${username}`);
    });
});

// Rute for å slette en quote
app.post('/deletequote/:quoteId', (req, res) => {
  const quoteId = req.params.quoteId;
  const username = req.session.username;

  // Sletter quoten fra quotes-samlingen
  quotesCollection.deleteOne({ _id: new ObjectId(quoteId), author: username })
    .then(() => {
      res.redirect(`/home/${username}`);
    })
    .catch(err => {
      console.log('Error deleting quote:', err);
      res.redirect(`/home/${username}`);
    });
});

// Rute for å vise quotene til en spesifikk forfatter
app.get('/author/:author', (req, res) => {
  const author = req.params.author;

  // Henter quotene til den angitte forfatteren fra quotes-samlingen
  quotesCollection.find({ author }).toArray()
    .then(quotes => {
      res.render('author', { quotes, author });
    });
});

// Utlogging-rute
app.get('/logout', (req, res) => {
  // Tømmer sesjonen og logger ut brukeren
  req.session.destroy();
  res.redirect('/login');
});

// Hjemmeside-rute
app.get('/', (req, res) => {
  // Henter en tilfeldig quote fra quotes-samlingen
  quotesCollection.aggregate([{ $sample: { size: 1 } }]).toArray().then(quotes => {
    const quote = quotes[0];
    res.render('index', { quote });
  });
});

// Lytter på port 3000
const port = 3000;

app.listen(port, () => console.log('Lytter på port', port));
