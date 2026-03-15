# All-in-One Video Downloader (SaveStream)

A modern, powerful Video Downloader Website built with React, Vite, Node.js, and yt-dlp.

## Features

- **Modern UI** with Glassmorphism, Dark and Light mode
- **1000+ Supported Sites** (YouTube, TikTok, Instagram, Facebook, Reddit, etc.)
- **Multiple Qualities** (360p, 720p, 1080p, and up to 4K)
- **Audio Extraction** (Download MP3)
- **Real-time Metadata Fetching**
- **Rate limiting and security built-in**

## Folder Structure

```text
.
├── backend/
│   ├── package.json     # Node js backend dependencies
│   ├── server.js        # Express server, Rate limiter, API routes
│   └── .env             # Environment variables 
└── frontend/
    ├── package.json     # React + Vite dependencies
    ├── vite.config.js   # Vite configuration
    ├── index.html       # Entry HTML
    └── src/
        ├── App.jsx      # Main React application
        ├── index.css    # Modern Vanilla CSS with dark/light theme
        └── main.jsx     # React entry point
```

## Local Development Setup

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **Python 3** (Required by `yt-dlp` under the hood on some systems, though `yt-dlp-exec` manages the binary)

### 2. Backend Setup
1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file (optional, defaults to port 5000):
   ```env
   PORT=5000
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

### 3. Frontend Setup
1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`. Make sure the backend server is running on `http://localhost:5000`.

---

## Deployment Instructions

### Deploying the Backend on Render
1. Push your `backend` code to a GitHub repository.
2. Log in to your [Render Dashboard](https://dashboard.render.com).
3. Click on **New +** and select **Web Service**.
4. Connect the GitHub repository containing your backend code.
5. In the settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Render will automatically provision the environment. Note down the deployed URL (e.g., `https://savestream-downloader-production-43ee.up.railway.app`).

*Note on Server Resources:* Video downloading paths stream data. Keep an eye on bandwidth limits of the free tier.

### Deploying the Frontend on Vercel
1. Update your `frontend/src/App.jsx` to point to the new Render backend URL instead of localhost:
   Change the `API_BASE` placeholder to your published Render URL.
   ```javascript
   const API_BASE = 'https://savestream-downloader-production-43ee.up.railway.app/api';
   ```
2. Push your `frontend` code to a GitHub repository.
3. Log in to [Vercel](https://vercel.com) and click **Add New** -> **Project**.
4. Import your repository and select the `frontend` directory as the root.
5. Vercel will auto-detect **Vite** as the framework.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Click **Deploy**. Vercel will build and host your modern UI.

## Environment Variables Support
If you prefer, you can use `.env` files for the frontend instead of hardcoding `API_BASE`:
1. Create `.env.production` in `frontend` directory with:
   `VITE_API_BASE=https://savestream-downloader-production-43ee.up.railway.app/api`
2. Update `App.jsx` to use:
   `const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';`

Deployment test update
