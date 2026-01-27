const express = require('express');

const app = express();

// This app is missing trust proxy configuration!
// Behind Azure load balancers, you need: app.enable('trust proxy')

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(process.env.PORT || 3000);
