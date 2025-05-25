import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Define Subscriber schema
const SubscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  name: {
    type: String,
    trim: true
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  preferences: {
    categories: [String],
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    }
  }
}, { timestamps: true });

const Subscriber = mongoose.model('Subscriber', SubscriberSchema);

// Subscribe route
router.post('/', async (req, res) => {
  try {
    const { email, name, preferences } = req.body;
    
    // Check if email is provided
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }
    
    // Check if subscriber already exists
    const existingSubscriber = await Subscriber.findOne({ email });
    if (existingSubscriber) {
      // If subscriber exists but was inactive, reactivate them
      if (!existingSubscriber.isActive) {
        existingSubscriber.isActive = true;
        existingSubscriber.subscribedAt = Date.now();
        if (name) existingSubscriber.name = name;
        if (preferences) existingSubscriber.preferences = {
          ...existingSubscriber.preferences,
          ...preferences
        };
        
        await existingSubscriber.save();
        return res.status(200).json({
          success: true,
          message: 'Subscription reactivated successfully',
          subscriber: {
            email: existingSubscriber.email,
            name: existingSubscriber.name
          }
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Already subscribed',
        subscriber: {
          email: existingSubscriber.email,
          name: existingSubscriber.name
        }
      });
    }
    
    // Create new subscriber with added debugging
    console.log('Creating new subscriber with email:', email);
    const subscriber = new Subscriber({
      email,
      name,
      preferences
    });
    
    console.log('Subscriber object before save:', subscriber);
    
    try {
      const savedSubscriber = await subscriber.save();
      console.log('Subscriber saved successfully:', savedSubscriber);
      
      // Verify the subscriber was actually saved
      const verifySubscriber = await Subscriber.findOne({ email });
      console.log('Verification query result:', verifySubscriber);
      
      res.status(201).json({ 
        success: true,
        message: 'Subscribed successfully',
        subscriber: {
          email: subscriber.email,
          name: subscriber.name
        }
      });
    } catch (saveErr) {
      console.error('Error during subscriber.save():', saveErr);
      res.status(500).json({ 
        success: false,
        message: saveErr.message 
      });
    }
  } catch (err) {
    console.error('Error in subscribe route:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

// Unsubscribe route
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }
    
    const subscriber = await Subscriber.findOne({ email });
    
    if (!subscriber) {
      return res.status(404).json({ 
        success: false,
        message: 'Subscriber not found' 
      });
    }
    
    // Set as inactive instead of deleting
    subscriber.isActive = false;
    await subscriber.save();
    
    res.status(200).json({ 
      success: true,
      message: 'Unsubscribed successfully' 
    });
  } catch (err) {
    console.error('Error unsubscribing:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

// Get all subscribers (Admin route - you should add authentication)
router.get('/all', async (req, res) => {
  try {
    const subscribers = await Subscriber.find({ isActive: true })
                                       .sort({ subscribedAt: -1 });
    res.json(subscribers);
  } catch (err) {
    console.error('Error fetching subscribers:', err);
    res.status(500).json({ message: err.message });
  }
});

// Route to count subscribers
router.get('/count', async (req, res) => {
  try {
    const count = await Subscriber.countDocuments({ isActive: true });
    res.json({ count });
  } catch (err) {
    console.error('Error counting subscribers:', err);
    res.status(500).json({ message: err.message });
  }
});

// Test route for subscriber database access
router.get('/test', async (req, res) => {
  try {
    const testEmail = `test${Date.now()}@example.com`;
    
    const subscriber = new Subscriber({
      email: testEmail,
      name: 'Test User'
    });
    
    const savedSubscriber = await subscriber.save();
    
    // Check if document was saved correctly
    const checkSubscriber = await Subscriber.findOne({ email: testEmail });
    
    res.status(200).json({
      success: true,
      message: 'Test subscriber created',
      subscriber: savedSubscriber,
      verificationCheck: checkSubscriber ? true : false
    });
  } catch (err) {
    console.error('Error in test subscriber creation:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

export default router;