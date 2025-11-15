const http = require('http');
const app = require('./app');
const { initializeSocket } = require('./socket');
const { initializeReminderCronJobs } = require('./services/reminderCronService');
const dotenv = require('dotenv')
dotenv.config();

if (process.env.NODE_ENV !== "test") {
  const port = process.env.PORT || 5000;
  const httpServer = http.createServer(app);
  
  // Initialize Socket.io
  initializeSocket(httpServer);
  
  // Initialize cron jobs for reminders
  initializeReminderCronJobs();
  
  httpServer.listen(port, () => console.log(`Server running on port ${port}`));
}
