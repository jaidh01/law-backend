import { MongoClient } from 'mongodb';
import { supabaseAdmin } from '../utils/supabase.js';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Check required environment variables
if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI environment variable. Please add it to your .env file');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY environment variable. Please add it to your .env file');
  console.error('Migration will likely fail due to row level security restrictions.');
}

// MongoDB connection settings
const mongoUri = process.env.MONGODB_URI;
const mongoClient = new MongoClient(mongoUri);
const logFile = join(__dirname, 'migration-log.txt');

// Helper for logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}`;
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Function to convert MongoDB document to Supabase format
function convertDocumentToSupabaseFormat(doc) {
  // Handle potential nulls and undefined values
  const tags = Array.isArray(doc.tags) ? doc.tags : [];
  
  // Convert MongoDB ObjectId to string (if exists)
  const mongo_id = doc._id ? doc._id.toString() : null;
  
  return {
    title: doc.title || '',
    slug: doc.slug || `article-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    author: doc.author || 'Unknown',
    published_date: doc.published_date || new Date(),
    content: doc.content || '',
    excerpt: doc.excerpt || doc.content?.substring(0, 150) + '...' || '',
    category: doc.category || 'Uncategorized',
    subcategory: doc.subcategory || null,
    tags: tags,
    source: doc.source || null,
    image: doc.image || null,
    image_caption: doc.imageCaption || doc.image_caption || null,
    image_alt: doc.imageAlt || doc.image_alt || null,
    image_credit: doc.imageCredit || doc.image_credit || null,
    pdf_url: doc.pdf_url || null,
    author_bio: doc.author_bio || null,
    is_featured: doc.is_featured || false,
    mongo_id: mongo_id
  };
}

// Main migration function
async function migrateData() {
  try {
    log('Starting migration from MongoDB to Supabase');
    
    // Connect to MongoDB
    log('Connecting to MongoDB...');
    await mongoClient.connect();
    log('Connected to MongoDB');
    
    const database = mongoClient.db(); // Use default database from connection string
    
    // Get all collections
    const collections = await database.listCollections().toArray();
    log(`Found ${collections.length} collections in MongoDB`);
    
    // Check if articles collection exists
    const articlesCollection = collections.find(c => c.name === 'articles');
    
    if (!articlesCollection) {
      log('No articles collection found in MongoDB');
      return;
    }
    
    // Get all articles from MongoDB
    const collection = database.collection('articles');
    const articles = await collection.find({}).toArray();
    log(`Found ${articles.length} articles in MongoDB`);
    
    if (articles.length === 0) {
      log('No articles to migrate');
      return;
    }
    
    // Convert MongoDB documents to Supabase format
    const supabaseArticles = articles.map(convertDocumentToSupabaseFormat);
    log(`Converted ${supabaseArticles.length} articles to Supabase format`);
    
    // Insert data into Supabase in batches
    const batchSize = 10; // Smaller batch size to better track errors
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < supabaseArticles.length; i += batchSize) {
      const batch = supabaseArticles.slice(i, i + batchSize);
      log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(supabaseArticles.length / batchSize)}`);
      
      try {
        // Using supabaseAdmin to bypass RLS
        const { data, error } = await supabaseAdmin
          .from('articles')
          .upsert(batch, { 
            onConflict: 'slug',
            ignoreDuplicates: false
          });
          
        if (error) {
          log(`Error in batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          if (error.details) {
            log(`Error details: ${error.details}`);
          }
          errorCount += batch.length;
        } else {
          successCount += batch.length;
          log(`Successfully inserted/updated ${batch.length} articles`);
        }
        
        // Add a small delay between batches to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        log(`Exception in batch ${Math.floor(i / batchSize) + 1}: ${err.message}`);
        if (err.stack) {
          log(`Stack trace: ${err.stack}`);
        }
        errorCount += batch.length;
      }
    }
    
    log(`Migration completed: ${successCount} articles successfully processed, ${errorCount} errors`);
    
    // Check if there are subscribers to migrate
    const subscribersCollection = collections.find(c => c.name === 'subscribers');
    
    if (subscribersCollection) {
      await migrateSubscribers(database);
    }
    
  } catch (error) {
    log(`Migration error: ${error.message}`);
    if (error.stack) {
      log(error.stack);
    }
  } finally {
    // Close MongoDB connection
    await mongoClient.close();
    log('MongoDB connection closed');
  }
}

// Function to migrate subscribers
async function migrateSubscribers(database) {
  try {
    log('Starting migration of subscribers');
    
    const collection = database.collection('subscribers');
    const subscribers = await collection.find({}).toArray();
    log(`Found ${subscribers.length} subscribers in MongoDB`);
    
    if (subscribers.length === 0) {
      log('No subscribers to migrate');
      return;
    }
    
    // Convert to Supabase format
    const supabaseSubscribers = subscribers.map(doc => ({
      email: doc.email,
      subscribed_at: doc.subscribed_at || doc.created_at || new Date(),
      status: doc.status || 'active',
      mongo_id: doc._id ? doc._id.toString() : null
    }));
    
    // Insert in batches
    const batchSize = 20;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < supabaseSubscribers.length; i += batchSize) {
      const batch = supabaseSubscribers.slice(i, i + batchSize);
      log(`Processing subscribers batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(supabaseSubscribers.length / batchSize)}`);
      
      try {
        // Using supabaseAdmin to bypass RLS
        const { data, error } = await supabaseAdmin
          .from('subscribers')
          .upsert(batch, { 
            onConflict: 'email',
            ignoreDuplicates: true
          });
          
        if (error) {
          log(`Error in subscribers batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
          log(`Successfully inserted/updated ${batch.length} subscribers`);
        }
        
        // Add a small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        log(`Exception in subscribers batch ${Math.floor(i / batchSize) + 1}: ${err.message}`);
        errorCount += batch.length;
      }
    }
    
    log(`Subscribers migration completed: ${successCount} successfully processed, ${errorCount} errors`);
    
  } catch (error) {
    log(`Subscribers migration error: ${error.message}`);
  }
}

// Run the migration
migrateData().then(() => {
  console.log('Migration process completed. Check migration-log.txt for details.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});