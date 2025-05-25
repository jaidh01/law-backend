import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import articleRoutes from './routes/articleRoutes.js';
import subscribeRoutes from './routes/subscribeRoutes.js'; // Import the subscribe routes

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Compression middleware - helps with slower mobile connections
app.use(compression());

// Improved CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, tools)
    if (!origin) return callback(null, true);
    
    // Allow your domain + subdomains format properly
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://law-livid-theta.vercel.app',  // Remove trailing slash
      'https://law-frontend.vercel.app',     // Add your frontend domain explicitly
      'https://law-backend-44pr.onrender.com'// Add backend domain for self-calls
    ];
    
    // Check for network IPs dynamically
    const localIpRegexes = [
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
      /^http:\/\/172\.\d+\.\d+\.\d+:\d+$/
    ];
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check if origin matches any local IP regex
    for (const regex of localIpRegexes) {
      if (regex.test(origin)) {
        return callback(null, true);
      }
    }
    
    // Check for Vercel preview domains
    if (/^https:\/\/law.*\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours cache for preflight requests
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s
})
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/articles', articleRoutes);
app.use('/api/subscribe', subscribeRoutes); // Add the subscription routes

// Preflight handling for browsers
app.options('*', cors());

// Health check endpoint useful for testing API connectivity
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running' });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'CORS is working properly',
    origin: req.headers.origin || 'No origin header'
  });
});

// Default route
app.get('/', (req, res) => {
  res.send('LiveLaw API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.message);
  res.status(500).json({ 
    success: false, 
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access via http://localhost:${PORT} or http://YOUR_LOCAL_IP:${PORT}`);
});
