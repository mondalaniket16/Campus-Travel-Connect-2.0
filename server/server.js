require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');
const listingRoutes = require('./routes/listings');
const joinRequestRoutes = require('./routes/joinRequests');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const ratingRoutes = require('./routes/ratings');

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  "http://localhost:5500",
  "http://localhost:3000",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => corsOptions.origin(origin, callback),
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/join-requests', joinRequestRoutes);

// Inject Socket.io into message routes
messageRoutes.setSocketIO(io);
app.use('/api/messages', messageRoutes);

app.use('/api/notifications', notificationRoutes);
app.use('/api/ratings', ratingRoutes);

// Simple issues endpoint
const Issue = require('./models/Issue');
const { auth } = require('./middleware/auth');
app.post('/api/issues', auth, async (req, res) => {
  try {
    const { type, description } = req.body;
    const issue = await Issue.create({ userId: req.userId, type, description });
    res.status(201).json({ issue, message: 'Issue reported' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to report issue' });
  }
});

// Socket.io for real-time features
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user_online', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    io.emit('users_online', Array.from(onlineUsers.keys()));
  });

  socket.on('join_conversation', (conversationId) => {
    socket.join(conversationId);
  });

  socket.on('leave_conversation', (conversationId) => {
    socket.leave(conversationId);
  });

  socket.on('send_message', (data) => {
    io.to(data.conversationId).emit('new_message', data);
  });

  socket.on('typing', (data) => {
    socket.to(data.conversationId).emit('user_typing', data);
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('users_online', Array.from(onlineUsers.keys()));
    }
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation error', details: err.message });
  }
  
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }

  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     🚀 Campus Travel Connect Server                       ║
║     Running on port ${PORT}                                 ║
║     Environment: ${process.env.NODE_ENV || 'development'}             ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, io };
