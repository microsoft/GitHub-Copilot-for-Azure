const express = require('express');

const app = express();

app.set('trust proxy', 1);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

// MISSING: Health check endpoint

app.listen(process.env.PORT || 3000);
