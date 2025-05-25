import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import compression from 'compression'; // Add this package via npm
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import articleRoutes from './routes/articleRoutes.js';

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Compression middleware - helps with slower mobile connections
app.use(compression());

// CORS middleware with detailed configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, tools)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://law-livid-theta.vercel.app',
      /^https:\/\/law.*\.vercel\.app$/,
      // Allow requests from any device on the local network
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
      /^http:\/\/172\.\d+\.\d+\.\d+:\d+$/,
      // Add your production domain when ready
      
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s
})
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/articles', articleRoutes);

// Health check endpoint useful for testing API connectivity
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running' });
});

// Default route
app.get('/', (req, res) => {
  res.send('LiveLaw API is running');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access via http://localhost:${PORT} or http://YOUR_LOCAL_IP:${PORT}`);
});
