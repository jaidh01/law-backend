import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import articleRoutes from './routes/articleRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(compression());

// Fixed & dynamic CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://law-livid-theta.vercel.app',
      /^https:\/\/law.*\.vercel\.app$/,
      'https://law-backend-44pr.onrender.com'
    ];

    if (!origin) return callback(null, true); // allow non-browser clients

    if (
      allowedOrigins.includes(origin) ||
      /^https:\/\/law.*\.vercel\.app$/.test(origin) // allow preview domains
    ) {
      return callback(null, true);
    }

    console.log('❌ Blocked by CORS:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB Connected'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/articles', articleRoutes);


// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Access via http://localhost:${PORT} or your Render URL`);
});
