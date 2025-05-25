import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Define Article schema for backend
const ArticleSchema = new mongoose.Schema({
  title: String,
  slug: String,
  author: String,
  published_date: Date,
  content: String,
  excerpt: String,
  category: String,
  subcategory: String,
  tags: [String],
  source: String,
  image: String,
  imageCaption: String,
  pdf_url: String
}, { timestamps: true });

// Create slug from title if not provided
ArticleSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
  }
  
  // Generate excerpt from content if not provided
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.substring(0, 150) + '...';
  }
  
  next();
});

const Article = mongoose.model('Article', ArticleSchema);

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

// Get all articles
router.get('/', async (req, res) => {
  try {
    const articles = await Article.find().sort({ published_date: -1 });
    res.json(articles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get featured articles
router.get('/featured', async (req, res) => {
  try {
    // Get the limit parameter from the query string, default to 5
    const limit = parseInt(req.query.limit) || 5;
    
    const articles = await Article.find()
      .sort({ published_date: -1 })
      .limit(limit);
    res.json(articles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get articles by category only
router.get('/category/:categorySlug', async (req, res) => {
  try {
    const { categorySlug } = req.params;

    const categoryName = categorySlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const singularCategory = categoryName.endsWith('s') 
      ? categoryName.slice(0, -1) 
      : categoryName;
    const pluralCategory = !categoryName.endsWith('s') 
      ? categoryName + 's' 
      : categoryName;

    const articles = await Article.find({
      $or: [
        { category: new RegExp(categoryName, 'i') },
        { category: new RegExp(singularCategory, 'i') },
        { category: new RegExp(pluralCategory, 'i') }
      ]
    }).sort({ published_date: -1 });

    res.json(articles);
  } catch (err) {
    console.error('Error fetching articles by category:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get articles by category and subcategory
router.get('/category/:categorySlug/subcategory/:subcategorySlug', async (req, res) => {
  try {
    const { categorySlug, subcategorySlug } = req.params;
    
    // Convert category slug to proper format
    const categoryName = categorySlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
      
    // Convert subcategory slug to proper format  
    const subcategoryName = subcategorySlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Create singular and plural versions for better matching
    const singularCategory = categoryName.endsWith('s') 
      ? categoryName.slice(0, -1) 
      : categoryName;
    const pluralCategory = !categoryName.endsWith('s') 
      ? categoryName + 's' 
      : categoryName;
    
    const articles = await Article.find({
      $and: [
        { 
          $or: [
            { category: new RegExp(categoryName, 'i') },
            { category: new RegExp(singularCategory, 'i') },
            { category: new RegExp(pluralCategory, 'i') }
          ]
        },
        {
          $or: [
            { subcategory: new RegExp(subcategoryName, 'i') },
            { tags: { $regex: new RegExp(subcategoryName, 'i') } }
          ]
        }
      ]
    }).sort({ published_date: -1 });
    
    res.json(articles);
  } catch (err) {
    console.error('Error fetching articles by category and subcategory:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get related articles
router.get('/related/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { excludeSlug } = req.query;
    
    const articles = await Article.find({
      category: new RegExp(category, 'i'),
      slug: { $ne: excludeSlug }
    }).sort({ published_date: -1 }).limit(3);
    
    res.json(articles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Enhance the existing tag route
router.get('/tag/:tagName', async (req, res) => {
  try {
    const { tagName } = req.params;
    const decodedTagName = decodeURIComponent(tagName);
    
    // First, try to find articles where the tag exists in the tags array
    let articles = await Article.find({ 
      tags: { $regex: new RegExp(decodedTagName, 'i') }
    }).sort({ published_date: -1 });
    
    // If no articles found, try to match with category or subcategory
    if (articles.length === 0) {
      articles = await Article.find({
        $or: [
          { category: { $regex: new RegExp(decodedTagName, 'i') } },
          { subcategory: { $regex: new RegExp(decodedTagName, 'i') } }
        ]
      }).sort({ published_date: -1 });
    }
    
    res.json(articles);
  } catch (err) {
    console.error('Error fetching articles by tag:', err);
    res.status(500).json({ message: err.message });
  }
});

// Add new subscriber
// Modify the subscriber save section in the /subscribe route

// Find this section in your existing subscribe route
router.post('/subscribe', async (req, res) => {
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
router.get('/subscribers', async (req, res) => {
  try {
    const subscribers = await Subscriber.find({ isActive: true })
                                       .sort({ subscribedAt: -1 });
    res.json(subscribers);
  } catch (err) {
    console.error('Error fetching subscribers:', err);
    res.status(500).json({ message: err.message });
  }
});

// Test route for subscriber creation
router.get('/test/create-subscriber', async (req, res) => {
  try {
    const testEmail = `test${Date.now()}@example.com`;
    
    console.log('Creating test subscriber with email:', testEmail);
    
    const subscriber = new Subscriber({
      email: testEmail,
      name: 'Test User',
      preferences: {
        categories: ['Test Category'],
        frequency: 'weekly'
      }
    });
    
    console.log('Test subscriber object before save:', subscriber);
    
    const savedSubscriber = await subscriber.save();
    console.log('Test subscriber saved successfully:', savedSubscriber);
    
    // Check if document was saved correctly
    const checkSubscriber = await Subscriber.findOne({ email: testEmail });
    console.log('Verification check result:', checkSubscriber);
    
    res.status(200).json({
      success: true,
      message: 'Test subscriber created',
      subscriber: savedSubscriber,
      verificationCheck: checkSubscriber ? 'Document found in DB' : 'Document NOT found in DB'
    });
  } catch (err) {
    console.error('Error in test subscriber creation:', err);
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Route to count subscribers
router.get('/subscribers/count', async (req, res) => {
  try {
    const count = await Subscriber.countDocuments({ isActive: true });
    const totalCount = await Subscriber.countDocuments();
    
    console.log('Active subscribers count:', count);
    console.log('Total subscribers count:', totalCount);
    
    // Add a sample subscriber directly to verify collection access
    const testEmail = `count-test-${Date.now()}@example.com`;
    const testSubscriber = new Subscriber({
      email: testEmail,
      name: 'Count Test User'
    });
    
    await testSubscriber.save();
    console.log('Count test subscriber saved:', testEmail);
    
    // Check total count again
    const newTotalCount = await Subscriber.countDocuments();
    
    res.json({ 
      activeCount: count, 
      totalCount: totalCount,
      newTotalCount: newTotalCount,
      testEmail: testEmail
    });
  } catch (err) {
    console.error('Error counting subscribers:', err);
    res.status(500).json({ message: err.message });
  }
});

// Route to list all subscribers regardless of isActive status
router.get('/subscribers/all', async (req, res) => {
  try {
    const allSubscribers = await Subscriber.find();
    console.log('All subscribers query result:', allSubscribers);
    
    res.json({
      count: allSubscribers.length,
      subscribers: allSubscribers
    });
  } catch (err) {
    console.error('Error listing all subscribers:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get article by slug
router.get('/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug });
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }
    res.json(article);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Test MongoDB connection
router.get('/test/db-status', async (req, res) => {
  try {
    // Check MongoDB connection state
    const connectionState = mongoose.connection.readyState;
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };
    
    // Try to list collections to test access
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Try to get subscriber collection stats if it exists
    let subscriberStats = null;
    if (collectionNames.includes('subscribers')) {
      subscriberStats = await mongoose.connection.db.collection('subscribers').stats();
    }
    
    res.json({
      connection: {
        state: connectionState,
        stateDescription: stateMap[connectionState],
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      collections: collectionNames,
      subscriberCollection: subscriberStats,
      models: Object.keys(mongoose.models),
      subscriberModelName: Subscriber.collection.name
    });
  } catch (err) {
    console.error('Error testing DB connection:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

// Export router using ES modules
export default router;
