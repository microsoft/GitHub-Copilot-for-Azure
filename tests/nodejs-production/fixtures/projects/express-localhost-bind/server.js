const express = require('express');

const app = express();

app.set('trust proxy', 1);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// BAD: Binding to localhost instead of 0.0.0.0
app.listen(3000, 'localhost', () => {
  console.log('Server running on localhost:3000');
});
