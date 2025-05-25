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
    
    // Create new subscriber
    const subscriber = new Subscriber({
      email,
      name,
      preferences
    });
    
    await subscriber.save();
    
    res.status(201).json({ 
      success: true,
      message: 'Subscribed successfully',
      subscriber: {
        email: subscriber.email,
        name: subscriber.name
      }
    });
  } catch (err) {
    console.error('Error adding subscriber:', err);
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

// Export router using ES modules
export default router;
