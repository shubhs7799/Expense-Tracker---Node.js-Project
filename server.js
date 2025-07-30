const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const app = express();

const routes = require('./routes/authRoutes');

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static frontend files (✅ Move this ABOVE / route)
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/v1', routes);

// Optional health check route
app.get('/', (req, res) => {
  res.redirect('/login.html'); // ✅ Redirect to login page instead
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
