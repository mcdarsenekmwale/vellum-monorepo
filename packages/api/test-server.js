const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Hello from Prisma Compute!' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Test app listening on port ${port}`);
});
