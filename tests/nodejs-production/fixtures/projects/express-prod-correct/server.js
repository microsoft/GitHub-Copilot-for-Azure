const express = require('express');
const session = require('express-session');

const app = express();
const port = process.env.PORT || 3000;

// Production best practice: Trust proxy for Azure load balancers
app.set('trust proxy', 1);

app.use(express.json());

// Production best practice: Secure cookie configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

// Production best practice: Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Production best practice: Bind to 0.0.0.0 for container compatibility
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
