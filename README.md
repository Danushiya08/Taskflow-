# TaskFlow

TaskFlow is a web-based AI-assisted project and team management system developed using the MERN stack. It helps teams manage projects, tasks, documents, budgets, reports, risks, notifications, and real-time communication in one centralized platform.

## Features

- Role-based access control for Admin, Project Manager, Team Member, and Client
- Project and task management
- Kanban-style workflow
- Budget and expense tracking
- Report generation
- Risk management
- Document upload, sharing, and versioning
- Real-time notifications using Socket.IO
- Daily smart alerts for deadlines and overdue tasks
- Rule-based AI project assistant and analytics
- In-platform video calling using WebRTC
- User-friendly dashboards for each role

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Shadcn UI
- Socket.IO Client
- Recharts

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- Socket.IO
- JWT Authentication
- Node-cron

## Installation

### Clone the repository

```bash
git clone https://github.com/Danushiya08/Taskflow-.git
cd Taskflow
```

### Install frontend dependencies

```bash
cd frontend
npm install
npm run dev
```
### Install backend dependencies

```bash
cd backend
npm install
npm run dev
```
## Environment Variables

Create a `.env` file in the backend folder:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

Create a `.env` file in the frontend folder:

```env
VITE_API_URL=your_backend_api_url
```

## Author

Danushiya Sarathbabu
