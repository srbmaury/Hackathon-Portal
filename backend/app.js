const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const i18n = require("./config/i18n.js");
const i18nMiddleware = require("./middleware/i18nMiddleware.js");
const app = express();
const dotenv = require('dotenv')
dotenv.config();

// Connect to MongoDB only if not testing
if (process.env.NODE_ENV !== "test") {
  connectDB();
}

// Remove COOP/COEP headers if present (prevent browser blocking postMessage)
app.use((req, res, next) => {
  res.removeHeader && res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader && res.removeHeader('Cross-Origin-Embedder-Policy');
  next();
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Initialize i18n
app.use(i18n.init);
app.use(i18nMiddleware);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/ideas', require('./routes/ideaRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/hackathons', require('./routes/hackathonRoutes')); // Includes nested /announcements routes
app.use('/api/register', require('./routes/registrationRoutes'));
app.use('/api/submissions', require('./routes/submissionRoutes'));
app.use('/api/teams', require('./routes/messageRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/demo-stage', require('./routes/demoStageRoutes'));

module.exports = app;
