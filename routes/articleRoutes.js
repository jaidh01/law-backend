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

// Get articles by category
router.get('/category/:categorySlug', async (req, res) => {
  try {
    const { categorySlug } = req.params;
    
    // Convert category slug to proper format
    const categoryName = categorySlug
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
      $or: [
        { category: new RegExp(categoryName, 'i') },
        { category: new RegExp(singularCategory, 'i') },
        { category: new RegExp(pluralCategory, 'i') },
        { tags: { $regex: new RegExp(categoryName, 'i') } }
      ]
    }).sort({ published_date: -1 });
    
    console.log(`Found ${articles.length} articles for category '${categoryName}'`);
    
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