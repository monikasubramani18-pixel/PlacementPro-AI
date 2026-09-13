# PlacementPro AI

An AI-powered placement preparation platform designed to help students track and improve their placement readiness.

## Live Demo

- Frontend: [PlacementPro AI](https://placement-pro-ai-sigma.vercel.app)
- Backend API: [Render Backend](https://placementpro-ai-6tj2.onrender.com)
- API Documentation: [FastAPI Swagger Docs](https://placementpro-ai-6tj2.onrender.com/docs)

## Features

- Student Registration and Login
- JWT Authentication
- Student Profile Management
- Resume Analysis
- Coding Practice
- Aptitude Practice
- Interview Preparation
- Project Tracking
- Placement Progress Dashboard
- Company Preparation
- Placement Readiness Score

## Technologies

### Frontend

- React
- JavaScript
- JSX
- Tailwind CSS
- Vite

### Backend

- Python
- FastAPI
- SQLAlchemy
- JWT Authentication
- bcrypt

### Database

- PostgreSQL
- Neon

### Deployment

- Vercel
- Render

## Placement Readiness

The dashboard combines the following areas to provide an overall placement readiness score:

- Resume performance
- Coding performance
- Aptitude performance
- Project completion

## Security

- Passwords are securely hashed using bcrypt.
- JWT-based authentication protects student-specific APIs.
- Environment variables are used for sensitive configuration.
- Database credentials are not stored in the frontend.

## Project Structure

```text
PlacementPro-AI/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
 