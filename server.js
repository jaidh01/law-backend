import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import articleRoutes from './routes/articleRoutes.js';
import healthRoutes from './routes/healthRoutes.js';

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Compression middleware - helps with slower mobile connections
app.use(compression());

// Improved CORS configuration with better origin handling
app.use(cors({
  origin: function (origin, callback) {
    // For requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // List of allowed origins as strings
    const allowedOrigins = [
      'https://legalnest.live',
      'https://www.legalnest.live',
      'http://localhost:5173',
      'https://law-livid-theta.vercel.app',
      'https://law-27h.pages.dev',
      'https://law-backend-lcvl.onrender.com',
      // Add Render URL when available
      'https://legalnest-api.onrender.com',
      // Add your Render deploy subdomain when available
      // 'https://law-backend-44pr.onrender.com'
    ];
    
    // Check if origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check against regex patterns
    const regexPatterns = [
      /^https:\/\/law.*\.vercel\.app$/,
      /^https:\/\/.*\.onrender\.com$/,
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
      /^http:\/\/172\.\d+\.\d+\.\d+:\d+$/
    ];
    
    // Test origin against regex patterns
    for (const pattern of regexPatterns) {
      if (pattern.test(origin)) {
        return callback(null, true);
      }
    }
    
    // Log blocked origins for debugging
    console.log(`CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Parse JSON and URL-encoded bodies
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// CORS preflight options handling
app.options('*', cors());

// Routes
app.use('/api/articles', articleRoutes);
app.use('/api/health', healthRoutes);

// Default route
app.get('/', (req, res) => {
  res.send('LegalNest API is running');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  // Get the local IP address using ESM import
  import('os').then(({ networkInterfaces }) => {
    const nets = networkInterfaces();
    let localIp = 'localhost';
    
    // Find a suitable IPv4 address
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // Skip internal and non-IPv4 addresses
        if (net.family === 'IPv4' && !net.internal) {
          localIp = net.address;
          break;
        }
      }
    }
    
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Access via http://localhost:${PORT} or http://${localIp}:${PORT}`);
  });
});
