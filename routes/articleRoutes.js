import express from 'express';
import supabase from '../utils/supabase.js';

const router = express.Router();

// Function to create a slug from a title
function createSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

// Function to generate an excerpt from content
function createExcerpt(content, length = 150) {
  return content.substring(0, length) + '...';
}

// Get all articles
router.get('/', async (req, res) => {
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .order('published_date', { ascending: false });

    if (error) throw error;
    
    res.json(articles);
  } catch (err) {
    console.error('Error fetching articles:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get featured articles
router.get('/featured', async (req, res) => {
  try {
    // Get the limit parameter from the query string, default to 5
    const limit = parseInt(req.query.limit) || 5;
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .order('published_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    res.json(articles);
  } catch (err) {
    console.error('Error fetching featured articles:', err);
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
    
    // Using ILIKE for case-insensitive matching
    const { data: categoryArticles, error: categoryError } = await supabase
      .from('articles')
      .select('*')
      .or(`category.ilike.%${categoryName}%,category.ilike.%${singularCategory}%,category.ilike.%${pluralCategory}%`)
      .order('published_date', { ascending: false });

    if (categoryError) throw categoryError;
    
    // For tags, we need to use array contains functionality
    const { data: tagArticles, error: tagError } = await supabase
      .from('articles')
      .select('*')
      .contains('tags', [categoryName])
      .order('published_date', { ascending: false });

    if (tagError) throw tagError;
    
    // Combine and deduplicate results
    const combinedArticles = [...categoryArticles];
    
    tagArticles.forEach(tagArticle => {
      if (!combinedArticles.some(article => article.id === tagArticle.id)) {
        combinedArticles.push(tagArticle);
      }
    });
    
    res.json(combinedArticles);
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
    
    // First get articles with matching category
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .or(`category.ilike.%${categoryName}%,category.ilike.%${singularCategory}%,category.ilike.%${pluralCategory}%`)
      .ilike('subcategory', `%${subcategoryName}%`)
      .order('published_date', { ascending: false });

    if (error) throw error;
    
    // Also get articles with matching tags
    const { data: tagArticles, error: tagError } = await supabase
      .from('articles')
      .select('*')
      .or(`category.ilike.%${categoryName}%,category.ilike.%${singularCategory}%,category.ilike.%${pluralCategory}%`)
      .contains('tags', [subcategoryName])
      .order('published_date', { ascending: false });

    if (tagError) throw tagError;
    
    // Combine and deduplicate results
    const combinedArticles = [...articles];
    
    tagArticles.forEach(tagArticle => {
      if (!combinedArticles.some(article => article.id === tagArticle.id)) {
        combinedArticles.push(tagArticle);
      }
    });
    
    res.json(combinedArticles);
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
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .ilike('category', `%${category}%`)
      .not('slug', 'eq', excludeSlug)
      .order('published_date', { ascending: false })
      .limit(3);

    if (error) throw error;
    
    res.json(articles);
  } catch (err) {
    console.error('Error fetching related articles:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get articles by tag
router.get('/tag/:tagName', async (req, res) => {
  try {
    const { tagName } = req.params;
    const decodedTagName = decodeURIComponent(tagName);
    
    // First try to find articles with matching tags
    const { data: tagArticles, error: tagError } = await supabase
      .from('articles')
      .select('*')
      .contains('tags', [decodedTagName])
      .order('published_date', { ascending: false });

    if (tagError) throw tagError;
    
    // If no articles found, try category or subcategory
    if (tagArticles.length === 0) {
      const { data: articles, error } = await supabase
        .from('articles')
        .select('*')
        .or(`category.ilike.%${decodedTagName}%,subcategory.ilike.%${decodedTagName}%`)
        .order('published_date', { ascending: false });
        
      if (error) throw error;
      res.json(articles);
    } else {
      res.json(tagArticles);
    }
  } catch (err) {
    console.error('Error fetching articles by tag:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get article by slug
router.get('/:slug', async (req, res) => {
  try {
    const { data: article, error } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', req.params.slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ message: 'Article not found' });
      }
      throw error;
    }
    
    res.json(article);
  } catch (err) {
    console.error('Error fetching article by slug:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;