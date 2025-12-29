# Hackathon Portal - Frontend

This is the frontend application for the Hackathon Portal, built with React 19 and Vite.

## Tech Stack

- **React 19** with Vite
- **Material-UI (MUI)** for components and theming
- **React Router** for navigation
- **Socket.io Client** for real-time updates
- **Axios** for API calls
- **React i18next** for internationalization
- **Markdown Editor** (@uiw/react-md-editor) for rich text editing
- **React Hot Toast** for notifications
- **Vitest** with React Testing Library for testing

## Getting Started

See the main [README.md](../README.md) for complete setup instructions.

### Quick Start

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage
- `npm run lint` - Run ESLint

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable React components
│   ├── pages/            # Page components
│   ├── api/              # API client functions
│   ├── context/          # React context providers
│   ├── i18n/             # Internationalization files
│   ├── routes/           # Route configuration
│   └── services/         # Frontend services
├── public/               # Static assets
└── coverage/             # Test coverage reports
```

For more details, see the main [README.md](../README.md).
