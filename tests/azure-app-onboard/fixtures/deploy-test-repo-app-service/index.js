'use strict';

const { createApp } = require('./src/app');
const { setup } = require('./src/db');

const PORT = process.env.PORT || 3000;

setup();

const app = createApp();

app.listen(PORT, () => {
  console.log(`Notes app running on http://localhost:${PORT}`);
});
