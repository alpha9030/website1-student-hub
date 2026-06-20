# 🎓 Student Hub (Academic Workspace)

[![Live Demo](https://img.shields.io/badge/Demo-Live%20on%20Render-brightgreen?style=for-the-badge&logo=render)](https://studenthub-pr.onrender.com)
[![Database](https://img.shields.io/badge/Database-Supabase%20%26%20Postgres-blue?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Backend](https://img.shields.io/badge/Backend-Flask-lightgrey?style=for-the-badge&logo=flask)](https://flask.palletsprojects.com)

Welcome to **Student Hub**, a premium, interactive academic workspace designed to streamline curriculum tracking, dashboard organization, and AI-powered learning. 

Whether you are a Computer Science student tracking databases, or a BCA student learning Java, Student Hub provides a customized path with checklists, visual progress meters, and an offline/online AI chatbot tutor named **Aura**.

---

## 🌟 Key Features

* **📌 Dynamic Curriculum Path**: Select your department (CSE, IT, ECE, EEE, ME, CE, BCA) and year standing, and the dashboard dynamically builds a custom learning path with essential topics.
* **📈 Interactive Checklist & Progress Bar**: Tick off objectives (e.g., mastering recursion, SQL joins) and watch your progress update in real-time.
* **🤖 Aura AI Tutor**: An integrated chatbot with multiple customizable modes (Offline/Online) to answer academic questions, write mock tests, and explain code blocks.
* **✉️ Safe OTP Email Verification**: Powered by SMTP, sending real 6-digit access tokens during registration to verify student logins securely.
* **☁️ Supabase Cloud Integration**: Fast, serverless PostgreSQL integration that stores signups, syllabus progress, and AI settings in real-time.
* **🛡️ Security Stamped**: Local database credentials (`config.json`) are automatically ignored via `.gitignore` to prevent secret leaks on GitHub.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5 (Semantic Structure), Vanilla CSS3 (Custom Properties, Glassmorphism, Theme Switcher), Javascript (ES6 DOM Manipulation)
* **Backend**: Python Flask (REST APIs, CORS Handlers, Routing)
* **Database**: Supabase / PostgreSQL REST API (PostgREST) with automatic local SQLite fallback
* **Verification**: SMTP (Secure Gmail TLS) for simulated or real OTP mailers

---

## 📄 License
This workspace is protected by Academic and Software Copyright. All rights reserved.
