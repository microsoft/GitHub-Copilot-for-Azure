const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(port);
