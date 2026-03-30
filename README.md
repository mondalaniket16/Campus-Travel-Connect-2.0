# Campus Travel Connect 🚀

A modern web platform to help VIT Chennai students find travel partners and organize group journeys.

![Campus Travel Connect](https://img.shields.io/badge/VIT-Chennai-00e5ff?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?style=for-the-badge)

## ✨ Features

### 🚕 Travel Match Board
- Find travel partners for short trips (cab, bus, auto)
- Filter by destination, time, transport type, and gender preference
- Post your own trip and let others find you

### 🚆 Route Group Finder
- Create or join long-distance travel groups
- **Join Request System** - Request to join groups, get approved by creators
- View group members, pending requests
- Real-time member management

### 📊 Enhanced Dashboard
- **My Listings** - View and manage your posted trips
- **My Groups** - Manage groups you created
- **Join Requests** - Accept/reject requests to join your groups
- **My Requests** - Track your sent join requests

### 💬 Messaging
- Direct messaging between users
- Real-time chat with message history

### 👤 User Profiles
- Profile photo upload
- Bio and contact information
- View other users' profiles

---

## 🛠️ Tech Stack

### Frontend
- HTML5, CSS3 (Glassmorphism UI)
- Vanilla JavaScript
- Firebase SDK (Auth, Firestore, Storage)

### Backend (New)
- Node.js + Express.js
- MongoDB Atlas (Database)
- JWT Authentication
- Socket.io (Real-time features)

### Deployment
- **Frontend**: Vercel
- **Backend**: Render
- **Database**: MongoDB Atlas

---

## 📁 Project Structure

```
Campus-Travel-Connect/
├── index.html              # Main frontend
├── script.js               # Frontend logic
├── style.css               # Styles (beautified)
├── firebase-config.js      # Firebase configuration
├── vercel.json             # Vercel deployment config
├── generate-project.js     # Project generator script
├── create-dirs.bat         # Directory setup (Windows)
├── setup.bat               # Full setup script
│
├── server/                 # Backend (run generate-project.js first)
│   ├── config/
│   │   └── db.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Group.js
│   │   ├── JoinRequest.js
│   │   ├── Message.js
│   │   └── ...
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── groups.js
│   │   ├── joinRequests.js
│   │   └── ...
│   ├── middleware/
│   │   ├── auth.js
│   │   └── upload.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
└── client/                 # Frontend for separate deployment
    ├── index.html
    ├── config.js
    └── vercel.json
```

---

## 🚀 Quick Start

### Option 1: Firebase Only (Current)
The app works with Firebase out of the box. Just open `index.html` in a browser.

### Option 2: Full Backend Setup

1. **Generate project files:**
   ```bash
   node generate-project.js
   ```

2. **Setup MongoDB Atlas:**
   - Create account at [mongodb.com/atlas](https://mongodb.com/atlas)
   - Create a free cluster
   - Get connection string

3. **Configure server:**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your MongoDB URI and JWT secret
   npm install
   npm run dev
   ```

4. **Run frontend:**
   - Open `index.html` in browser, or
   - Use Live Server extension in VS Code

---

## 🌐 Deployment Guide

### Deploy Backend to Render

1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Create New → Web Service
4. Connect your GitHub repo
5. Configure:
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Environment Variables:**
     - `MONGODB_URI`: Your MongoDB Atlas connection string
     - `JWT_SECRET`: A random secure string
     - `CLIENT_URL`: Your Vercel frontend URL
     - `NODE_ENV`: `production`

### Deploy Frontend to Vercel

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repo
4. Configure:
   - **Root Directory:** `.` (or `client` if using separate folder)
   - **Framework Preset:** Other
5. Update `config.js` with your Render backend URL

### MongoDB Atlas Setup

1. Create free cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create database user
3. Whitelist IP addresses (0.0.0.0/0 for Render)
4. Get connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/campus-travel-connect
   ```

---

## 🔧 Environment Variables

### Server (.env)
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ctc
JWT_SECRET=your-super-secret-key
PORT=5000
CLIENT_URL=https://your-app.vercel.app
NODE_ENV=production
```

---

## 📱 Features Overview

| Feature | Status |
|---------|--------|
| Email/Password Auth | ✅ Working |
| Google OAuth | ✅ Working |
| Travel Match Board | ✅ Working |
| Group Creation | ✅ Working |
| Join Request System | ✅ New |
| Accept/Reject Requests | ✅ New |
| My Groups Dashboard | ✅ New |
| Member Management | ✅ New |
| Direct Messaging | ✅ Working |
| Profile Management | ✅ Working |
| Photo Upload | ✅ Working |
| Ratings & Reviews | ✅ Working |
| Issue Reporting | ✅ Working |
| Theme Selection | ✅ Working |

---

## 🎨 UI Improvements

- ✨ Glassmorphism design with blur effects
- 🌊 Animated background particles
- 💫 Smooth page transitions
- 🎯 Enhanced button hover effects
- 📱 Fully responsive design
- 🎨 Three theme options (Ocean, Dark, Light)
- 📜 Custom scrollbars
- ✅ Loading skeletons
- 🔔 Toast notifications

---

## 📝 API Endpoints (Backend)

### Authentication
- `POST /api/auth/signup` - Register
- `POST /api/auth/login` - Login
- `POST /api/auth/google` - Google OAuth
- `GET /api/auth/me` - Current user

### Groups
- `GET /api/groups` - List groups
- `GET /api/groups/my` - My created groups
- `POST /api/groups` - Create group
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group

### Join Requests
- `POST /api/join-requests` - Send request
- `GET /api/join-requests/sent` - My sent requests
- `GET /api/join-requests/received` - Received requests
- `PUT /api/join-requests/:id/accept` - Accept
- `PUT /api/join-requests/:id/reject` - Reject

### Messages
- `GET /api/messages/conversations` - List chats
- `POST /api/messages` - Send message

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---

## 📄 License

MIT License - feel free to use this project for your campus!

---

Made with ❤️ for VIT Chennai students
