# 🚀 CitySafe - Quick Run Guide

To run the application on port **5173**, follow these steps carefully.

⚠️ **IMPORTANT:** Close all other terminal tabs that might be running `npm run dev` before starting. If something is already using port 5173, the app will move to a different port.

---

## 1. Backend Setup & Run
Open a terminal and run:

```bash
# Navigate to the backend directory
cd /Users/dj/Desktop/CitySafe/CitySafe-youssefs-design-and-prod/backend

# Install dependencies & config
npm install
cp .env.example .env

# Start the server (Backend uses port 4000)
npm run dev
```

---

## 2. Frontend Setup & Run (Port 5173)
Open a **NEW** terminal tab and run:

```bash
# Navigate to the frontend directory
cd /Users/dj/Desktop/CitySafe/CitySafe-youssefs-design-and-prod/frontend

# Install dependencies & config
npm install
cp .env.example .env

# Start the frontend and FORCE port 5173
npm run dev -- --port 5173
```
*App will be at: **`http://localhost:5173`***

---

## 🏗 Optional: Build & Local Preview
This uses a different port (**4173**) for the production version:

```bash
# In the frontend directory
npm run build
npm run preview -- --port 4173
```

---

## 🔑 Default Login Credentials
| Role | Username | Password |
| :--- | :--- | :--- |
| **User** | `user_demo` | `demo1234` |
| **Admin** | `admin_01` | `admin1234` |
