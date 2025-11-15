# Hackathon Portal

A comprehensive platform for managing hackathons, teams, ideas, and participants. Built with React, Node.js, Express, and MongoDB.

## 🚀 Features

### Core Functionality
- **Hackathon Management**: Create, edit, and manage hackathons with rounds, descriptions, and team size constraints
- **Team Registration**: Register teams for hackathons with team members and ideas
- **Idea Management**: Submit and manage ideas for hackathons (public/private)
- **User Management**: Multi-tier role system with organization-level and hackathon-specific roles
- **Real-time Updates**: WebSocket integration for live updates on hackathons, teams, and user roles
- **Internationalization**: Full support for multiple languages (English, Hindi, Telugu) with comprehensive translations
- **Submissions & Rounds**: Submit entries for hackathon rounds with file uploads and links
- **Scoring System**: Judges can score submissions (0-100) and provide feedback
- **Standings**: Public leaderboard with optional score hiding for participants
- **Announcements**: Hackathon-specific announcements with markdown support
- **File Uploads**: Cloudinary integration for submission files (PPT, PDF, ZIP, etc.)
- **Modal-based UI**: Professional modals for confirmations, errors, and information display
- **Team Chat**: Real-time messaging for teams with AI assistant support
- **Automated Reminders**: Smart deadline reminders for at-risk teams

### Role System
- **Organization-Level Roles**:
  - `admin`: Full platform access
  - `hackathon_creator`: Can create hackathons
  - `user`: Regular user access
- **Hackathon-Specific Roles**:
  - `organizer`: Manages a specific hackathon
  - `judge`: Judges submissions for a hackathon
  - `mentor`: Mentors participants in a hackathon
  - `participant`: Participates in a hackathon

### Team Management
- Team size constraints (minimum and maximum members) with real-time validation
- Team registration with idea selection
- Team member management with user search
- Team withdrawal functionality
- Real-time team updates
- Team editing capabilities
- View all registered teams for a hackathon

### Submissions & Scoring
- Submit entries for active rounds with links and file uploads
- File upload support via Cloudinary (max 50MB)
- Score submissions (0-100) with validation
- Provide feedback on submissions
- View standings/leaderboard
- Hide scores from participants (organizer option)
- Role-based submission access (participants submit, judges/organizers view all)
- Update submissions before round deadline

### Announcements
- Hackathon-specific announcements
- Markdown support for rich text formatting
- Create, edit, and delete announcements (organizers/admins)
- Real-time announcement updates
- AI-powered formatting and enhancement

### Team Chat & Messaging
- Real-time team chat with WebSocket support
- Team members, mentors, and organizers can communicate
- AI assistant responds when explicitly mentioned (@AI, @assistant)
- Meeting summary generation from chat history
- AI messages are visually distinct in the chat interface

### AI-Powered Features 🤖

#### 1. Intelligent Mentor Assignment
- Automatically assigns teams to mentors based on team composition, ideas, and mentor availability
- Ensures balanced workload distribution
- Optimal mentor-team matching

#### 2. Hackathon Description Formatting
- AI-powered formatting of hackathon descriptions
- Transforms plain text into beautifully formatted Markdown
- Available in hackathon creation/editing form

#### 3. Round Structure Suggestions
- AI suggests round names, descriptions, and dates
- Intelligent round field filling based on hackathon context
- Supports multiple rounds with sequential date suggestions

#### 4. Announcement Formatting & Enhancement
- Auto-format announcements with proper Markdown structure
- Enhance plain text into professionally formatted announcements
- Add structure, headers, and formatting automatically

#### 5. Idea Evaluation & Analysis
- Comprehensive AI evaluation with scores across multiple criteria:
  - Innovation (0-100)
  - Feasibility (0-100)
  - Market Potential (0-100)
  - Clarity (0-100)
  - Impact (0-100)
- Find similar ideas to avoid duplicates
- Get improvement suggestions for idea enhancement
- Available to all users for all ideas

#### 6. Submission Evaluation & Feedback
- AI-powered evaluation with scores across:
  - Technical Implementation (0-100)
  - Innovation (0-100)
  - Problem Solving (0-100)
  - Presentation (0-100)
  - Completeness (0-100)
- Auto-generate detailed feedback with strengths and improvement areas
- Compare multiple submissions within a round for insights
- Available to judges and organizers

#### 7. Chat Assistant
- AI assistant in team chats (responds when mentioned: @AI, @assistant)
- Answers questions about deadlines, submissions, hackathon rules
- Provides context-aware responses based on team and hackathon data
- Meeting summary generation from chat history

#### 8. Smart Deadline Reminders
- AI-powered risk analysis for teams
- Predicts teams at risk of missing deadlines
- Automated midnight cron job checks active rounds
- Sends personalized reminder messages to at-risk teams
- Risk factors include: time remaining, submission status, team activity, historical performance
- Available to organizers and admins in Round Details page

#### 9. Automatic Round Status Management
- Cron job automatically updates round active status based on dates
- Deactivates rounds that have passed their end date
- Activates rounds that have reached their start date
- Runs daily at midnight (UTC)

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose
- **Socket.io** for real-time communication
- **JWT** for authentication
- **Google OAuth** for login
- **i18n** for internationalization
- **Cloudinary** for file storage and management
- **Multer** with Cloudinary storage for file uploads
- **OpenAI API** for AI-powered features
- **node-cron** for scheduled tasks (reminders, round status updates)
- **Vitest** for testing with comprehensive coverage

### Frontend
- **React 19** with Vite
- **Material-UI (MUI)** for components and theming
- **React Router** for navigation
- **Socket.io Client** for real-time updates
- **Axios** for API calls
- **React i18next** for internationalization
- **Markdown Editor** (@uiw/react-md-editor) for rich text editing
- **React Hot Toast** for notifications
- **Vitest** with React Testing Library for testing

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or cloud instance)
- Google OAuth credentials (for Google login)
- Cloudinary account (for file uploads) - See `CLOUDINARY_ENV.md` for setup

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Hackathon-Portal
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
MONGO_URI=mongodb://localhost:27017/hackathon-portal
JWT_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
PORT=5000

# Cloudinary Configuration (for file uploads)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# AI Configuration (OpenAI)
OPENAI_API_KEY=your-openai-api-key
AI_ENABLED=true
AI_MODEL=gpt-4o-mini
```

Start the backend server:

```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

Start the frontend development server:

```bash
npm run dev
```

The frontend will run on `http://localhost:5173`


## 📁 Project Structure

```
Hackathon-Portal/
├── backend/
│   ├── config/
│   │   ├── db.js              # Database connection
│   │   └── i18n.js            # Internationalization config
│   ├── controllers/           # Route controllers
│   │   ├── authController.js
│   │   ├── hackathonController.js
│   │   ├── ideaController.js
│   │   ├── registrationController.js
│   │   └── userController.js
│   ├── middleware/            # Express middleware
│   │   ├── auth.js            # JWT authentication
│   │   ├── hackathonRoleCheck.js
│   │   ├── i18nMiddleware.js
│   │   └── roleCheck.js
│   ├── models/                # Mongoose models
│   │   ├── Hackathon.js
│   │   ├── Team.js
│   │   ├── Idea.js
│   │   ├── User.js
│   │   ├── HackathonRole.js
│   │   └── Organization.js
│   ├── routes/                # API routes
│   ├── services/              # Business logic & AI services
│   │   ├── announcementFormattingService.js
│   │   ├── chatAssistantService.js
│   │   ├── hackathonFormattingService.js
│   │   ├── ideaEvaluationService.js
│   │   ├── mentorAssignmentService.js
│   │   ├── reminderCronService.js
│   │   ├── roundSuggestionService.js
│   │   ├── smartReminderService.js
│   │   └── submissionEvaluationService.js
│   ├── socket.js              # Socket.io setup
│   ├── server.js              # Express server (includes cron jobs)
│   └── app.js                 # Express app configuration
│
├── frontend/
│   ├── src/
│   │   ├── api/               # API client functions
│   │   │   ├── apiConfig.js
│   │   │   ├── announcements.js
│   │   │   ├── auth.js
│   │   │   ├── hackathons.js
│   │   │   ├── ideas.js
│   │   │   ├── messages.js
│   │   │   ├── registrations.js
│   │   │   ├── reminders.js
│   │   │   ├── submissions.js
│   │   │   └── users.js
│   │   ├── components/        # React components
│   │   │   ├── announcements/
│   │   │   ├── auth/
│   │   │   ├── chat/          # ChatWindow component
│   │   │   ├── common/        # InfoModal, ConfirmDialog, ScoreFeedbackDialog, MarkdownViewer
│   │   │   ├── dashboard/
│   │   │   ├── hackathons/
│   │   │   ├── ideas/
│   │   │   ├── members/
│   │   │   └── teams/
│   │   ├── context/            # React context providers
│   │   │   ├── AuthContext.js
│   │   │   └── SettingsContext.js
│   │   ├── i18n/              # Translation files (en, hi, te)
│   │   ├── pages/             # Page components
│   │   │   ├── HackathonPage.jsx
│   │   │   ├── HackathonDetailsPage.jsx
│   │   │   ├── RoundDetailsPage.jsx
│   │   │   ├── MyTeamsPage.jsx
│   │   │   ├── IdeaSubmissionPage.jsx
│   │   │   ├── PublicIdeasPage.jsx
│   │   │   ├── AdminMembersPage.jsx
│   │   │   ├── UserManagementPage.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   └── LoginPage.jsx
│   │   ├── routes/             # Route configuration
│   │   ├── services/          # Services (Socket.io client)
│   │   └── main.jsx           # Application entry point
│   └── public/
│
└── README.md
```

## 🔑 Key Features

### Authentication
- Google OAuth integration
- JWT-based session management
- Protected routes and API endpoints

### Hackathon Management
- Create hackathons with markdown descriptions
- Define team size constraints (min/max)
- Add multiple rounds with dates and hide scores option
- Activate/deactivate hackathons
- Real-time updates via WebSocket
- Beautiful UI with cards, icons, and gradients

### Team Registration
- Register teams with team name, idea, and members
- Team size validation with real-time feedback
- Edit team details
- Withdraw from hackathons
- View all teams for a hackathon
- Efficient member search with Trie data structure

### User Roles & Permissions
- Organization-level roles (admin, hackathon_creator, user)
- Hackathon-specific roles (organizer, judge, mentor, participant)
- Role-based access control
- Admin can assign roles to users
- Real-time role updates
- Users can have different roles in different hackathons

### Submissions & Scoring
- Submit entries with links and file uploads (Cloudinary)
- Score validation (0-100) with real-time feedback
- Judges can score and provide feedback
- Organizers can provide feedback
- Standings/leaderboard with optional score hiding
- Role-based submission access

### UI/UX Features
- Modal-based UI for confirmations and information
- Professional error/success/info modals
- Score/feedback dialog with validation
- Responsive design with Material-UI
- Dark mode support
- Full internationalization (English, Hindi, Telugu)
- Real-time form validation with visual feedback

### Real-time Features
- Live updates for hackathon changes
- Real-time team updates
- Instant role change notifications
- Hackathon role assignment/removal updates
- WebSocket-based synchronization
- Automatic UI updates without page refresh

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test              # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:coverage # Run with coverage report
```

### Frontend Tests

```bash
cd frontend
npm test              # Run tests
npm run test:watch    # Run tests in watch mode
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth login

### Hackathons
- `GET /api/hackathons` - Get all hackathons
- `POST /api/hackathons` - Create hackathon (hackathon_creator/admin)
- `GET /api/hackathons/:id` - Get hackathon details
- `PUT /api/hackathons/:id` - Update hackathon (organizer/admin)
- `DELETE /api/hackathons/:id` - Delete hackathon (organizer/admin)
- `GET /api/hackathons/:id/members` - Get hackathon members
- `POST /api/hackathons/:id/roles` - Assign hackathon role
- `DELETE /api/hackathons/:id/roles/:roleId` - Remove hackathon role

### Teams
- `POST /api/register/:hackathonId/register` - Register team
- `GET /api/register/:hackathonId/my` - Get my team
- `GET /api/register/:hackathonId/teams/public` - Get all teams (public)
- `PUT /api/register/:hackathonId/teams/:teamId` - Update team
- `DELETE /api/register/:hackathonId/teams/:teamId` - Withdraw team
- `GET /api/register/my-teams` - Get all my teams

### Ideas
- `GET /api/ideas` - Get public ideas
- `GET /api/ideas/my` - Get my ideas
- `POST /api/ideas` - Create idea
- `PUT /api/ideas/:id` - Update idea
- `DELETE /api/ideas/:id` - Delete idea
- `POST /api/ideas/:id/evaluate` - Evaluate idea with AI
- `GET /api/ideas/:id/similar` - Find similar ideas
- `GET /api/ideas/:id/improvements` - Get improvement suggestions

### Submissions
- `POST /api/submissions/:roundId` - Submit/update submission (with file upload)
- `GET /api/submissions/:roundId/my` - Get my submission
- `GET /api/submissions/:roundId/all` - Get all submissions (organizer/judge/admin)
- `GET /api/submissions/:roundId/standings` - Get standings/leaderboard
- `PUT /api/submissions/:submissionId` - Update submission score/feedback
- `POST /api/submissions/:submissionId/evaluate` - Evaluate submission with AI
- `POST /api/submissions/:submissionId/generate-feedback` - Generate AI feedback
- `GET /api/submissions/:roundId/compare` - Compare submissions in a round

### Announcements
- `GET /api/hackathons/:hackathonId/announcements` - Get hackathon announcements
- `POST /api/hackathons/:hackathonId/announcements` - Create announcement (organizer/admin, supports `useAIFormatting` flag)
- `PUT /api/hackathons/:hackathonId/announcements/:id` - Update announcement
- `DELETE /api/hackathons/:hackathonId/announcements/:id` - Delete announcement
- `POST /api/hackathons/:hackathonId/announcements/format` - Format announcement with AI
- `POST /api/hackathons/:hackathonId/announcements/enhance` - Get enhancement suggestions

### Hackathons (AI Features)
- `POST /api/hackathons/format` - Format hackathon description with AI
- `POST /api/hackathons/suggest-round` - Suggest round structure with AI
- `POST /api/hackathons/suggest-rounds` - Suggest multiple rounds with AI

### Team Messages
- `GET /api/teams/:teamId/messages` - Get team messages
- `POST /api/teams/:teamId/messages` - Send message (AI responds when mentioned)
- `POST /api/teams/:teamId/messages/summary` - Generate meeting summary from chat

### Reminders
- `GET /api/reminders/team/:teamId/round/:roundId` - Analyze team risk
- `GET /api/reminders/round/:roundId/at-risk` - Get all at-risk teams for a round
- `POST /api/reminders/team/:teamId/round/:roundId/send` - Send reminder to team

### Users
- `GET /api/users` - Get all users (admin)
- `GET /api/users/with-roles` - Get users with hackathon roles (admin)
- `PUT /api/users/:id/role` - Update user role (admin)

## 🌐 Internationalization

The application supports multiple languages:
- English (en)
- Hindi (hi)
- Telugu (te)

Translation files are located in:
- Backend: `backend/locales/`
- Frontend: `frontend/src/i18n/`

## 🔒 Security

- JWT token-based authentication
- Role-based access control (RBAC)
- Protected API endpoints
- Input validation and sanitization
- CORS configuration

## 🚀 Deployment

### Backend Deployment
1. Set environment variables in your hosting platform
2. Ensure MongoDB connection string is configured
3. Deploy to Node.js hosting (Heroku, Railway, etc.)

### Frontend Deployment
1. Update `VITE_API_URL` to point to your backend
2. Build the application: `npm run build`
3. Deploy the `dist` folder to a static hosting service (Vercel, Netlify, etc.)

## 📝 Scripts

### Backend
- `npm run dev` - Start development server with nodemon (includes cron jobs)
- `npm test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:coverage` - Generate test coverage

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests
- `npm run lint` - Run ESLint

## ⚙️ Scheduled Tasks

The backend includes automated cron jobs that run daily:

- **Round Status Updates**: Automatically activates/deactivates rounds based on start/end dates
- **Smart Reminders**: Analyzes teams at risk and sends personalized reminder messages
- **Schedule**: Runs daily at 00:00 UTC (configurable in `reminderCronService.js`)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## 🤖 AI Configuration

The platform includes comprehensive AI-powered features using OpenAI. To enable AI features:

1. **Get OpenAI API Key**: Sign up at [OpenAI](https://platform.openai.com/) and get your API key
2. **Configure Environment Variables**:
   ```env
   OPENAI_API_KEY=your-openai-api-key
   AI_ENABLED=true
   AI_MODEL=gpt-4o-mini  # or gpt-4 for more complex tasks
   ```
3. **Disable AI** (if needed): Set `AI_ENABLED=false` to disable all AI features gracefully

### AI Features Overview
- All AI features are **opt-in** - users choose when to use them
- AI responses are **suggestions** - users can always override or ignore
- Cost-effective by default (uses `gpt-4o-mini`)
- Graceful fallback if AI is unavailable or disabled
- Comprehensive error handling and logging

### Scheduled Tasks (Cron Jobs)
- **Midnight Reminder Check**: Runs daily at 00:00 UTC
  - Updates round active status based on dates
  - Sends reminders to at-risk teams
  - Automatically manages round lifecycle

## 🔮 Future Enhancements & Suggestions

### High Priority
- **Email Notifications**: Send email notifications for important events (round start/end, score updates, announcements)
- **Advanced Analytics**: Dashboard with statistics, participation metrics, and performance analytics
- **Export Functionality**: Export submissions, standings, and reports to PDF/Excel
- **Notification System**: In-app notification center with read/unread status
- **Advanced Search**: Full-text search across hackathons, ideas, teams, and users
- **File Preview**: Preview uploaded files (PDFs, images) without downloading

### Medium Priority
- **Video Conferencing Integration**: Integrate with Zoom/Google Meet for virtual hackathons
- **Calendar Integration**: Sync hackathon dates with Google Calendar/Outlook
- **Mobile App**: React Native mobile app for iOS and Android
- **QR Code Generation**: Generate QR codes for hackathon registration and check-ins
- **Bulk Operations**: Bulk import/export of users, teams, and submissions
- **Advanced Filtering**: Filter hackathons by date, status, category, etc.
- **Team Collaboration Tools**: Shared documents, task management within teams
- **Smart Team Member Suggestions**: AI-powered teammate recommendations based on skills and interests

### Low Priority
- **Gamification**: Badges, achievements, and leaderboards
- **Social Features**: Comments, likes, and sharing on ideas and submissions
- **Video Submissions**: Support for video file uploads and streaming
- **Content Moderation**: AI-powered content moderation for messages and submissions
- **Multi-Organization Support**: Support for multiple organizations on the same platform
- **Custom Themes**: Allow organizers to customize hackathon pages with custom themes
- **Integration APIs**: RESTful APIs for third-party integrations
- **Advanced Reporting**: Custom report builder with charts and graphs

### Technical Improvements
- **Performance Optimization**: Implement caching, lazy loading, and code splitting
- **Accessibility**: Improve WCAG compliance and screen reader support
- **Progressive Web App (PWA)**: Offline support and installable web app
- **GraphQL API**: Add GraphQL endpoint alongside REST API
- **Microservices Architecture**: Split backend into microservices for scalability
- **Docker Support**: Containerize the application for easy deployment
- **CI/CD Pipeline**: Automated testing and deployment pipelines
- **Monitoring & Logging**: Implement comprehensive logging and monitoring (e.g., Sentry, DataDog)

## 📄 License

ISC

## 👥 Authors

Hackathon Portal Development Team

---

## 📚 Additional Documentation

For detailed component documentation and frontend-specific details, refer to the component files and inline comments in the codebase.
