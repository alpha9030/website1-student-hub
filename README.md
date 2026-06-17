# Student Hub (Academic Workspace)

An interactive dashboard to track your curriculum, checklists, and chat with Aura, an AI tutor.

## 🚀 Live Demo
The application is live and accessible at: **[https://studenthub-pr.onrender.com](https://studenthub-pr.onrender.com)**

## 💻 Local Setup
1. Double-click start_backend.bat to launch the server.
2. Open your browser and navigate to the printed URL (default: https://studenhub.pr or http://127.0.0.1:5000).

## 🛠️ Cloud Deployment Reference
This project is configured for deployment on Render:
- **Runtime**: Python`n- **Build Command**: pip install -r requirements.txt`n- **Start Command**: gunicorn app:app`n
> **Note on Databases**: SQLite uses local files. On Render's free tier, the database resets when the service restarts. For persistent data, use Render's Persistent Disks or migrate to a PostgreSQL database.
