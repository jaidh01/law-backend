import express from 'express';
import supabase from '../utils/supabase.js';
import { asyncHandler, successResponse } from '../utils/routeHelpers.js';

const router = express.Router();

// Basic health check endpoint
router.get('/', (req, res) => {
  res.status(200).json(successResponse(
    { timestamp: new Date().toISOString() },
    'API is running'
  ));
});

// Extended health check that tests database connectivity
router.get('/db', asyncHandler(async (req, res) => {
  // Test Supabase connection
  const { data, error } = await supabase
    .from('articles')
    .select('id')
    .limit(1);
  
  if (error) throw error;
  
  res.status(200).json(successResponse({
    database: 'connected',
    timestamp: new Date().toISOString()
  }));
}));

// CORS test endpoint
router.get('/cors', (req, res) => {
  res.status(200).json(successResponse({
    origin: req.headers.origin || 'No origin header',
    timestamp: new Date().toISOString()
  }, 'CORS is working properly'));
});

export default router;