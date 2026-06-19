const Queue = require('bull');
const logger = require('../utils/logger');
const { redisClient } = require('./redis');

let contentAnalysisQueue, archivalQueue, suggestionQueue, bulkImportQueue;

if (process.env.NODE_ENV === 'test') {
  contentAnalysisQueue = { add: jest.fn(), process: jest.fn(), on: jest.fn(), close: jest.fn() };
  archivalQueue = { add: jest.fn(), process: jest.fn(), on: jest.fn(), close: jest.fn() };
  suggestionQueue = { add: jest.fn(), process: jest.fn(), on: jest.fn(), close: jest.fn() };
  bulkImportQueue = { add: jest.fn(), process: jest.fn(), on: jest.fn(), close: jest.fn() };
} else {
  // Create queues for different processing tasks
  contentAnalysisQueue = new Queue('content-analysis', {
    createClient: () => redisClient,
  });
  archivalQueue = new Queue('archival', {
    createClient: () => redisClient,
  });
  suggestionQueue = new Queue('suggestion', {
    createClient: () => redisClient,
  });
  bulkImportQueue = new Queue('bulk-import', {
    createClient: () => redisClient,
  });
}

// Bulk import job processor
bulkImportQueue.process(async (job) => {
  const { items, userId, type } = job.data;
  const db = require('../config/db');
  const { getUserEntitlements } = require('../services/entitlementService');
  const entitlements = await getUserEntitlements(userId);

  const tableName = type === 'tab' ? 'tabs' : 'bookmarks';

  for (const item of items) {
    const { url, title, favicon, content, folder } = item;

    let result;
    if (type === 'tab') {
      result = await db.query(
        `INSERT INTO ${tableName} (url, title, favicon, content, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [url, title, favicon, content, userId]
      );
    } else {
      result = await db.query(
        `INSERT INTO ${tableName} (url, title, favicon, folder, content, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [url, title, favicon, folder, content, userId]
      );
    }

    const newItem = result.rows[0];

    if (content && entitlements?.features?.ml) {
      await contentAnalysisQueue.add({
        itemId: newItem.id,
        itemType: type,
        url,
        content
      });
    }
  }
});


// Content analysis job processor
contentAnalysisQueue.process(async (job) => {
  const { itemId, itemType, url, content } = job.data;
  
  logger.info('Processing content analysis job', { 
    jobId: job.id, 
    itemId, 
    itemType 
  });
  
  try {
    const mlServiceClient = require('../utils/mlServiceClient');
    const db = require('../config/db');
    
    // Analyze content using ML service with error handling
    const analysis = await mlServiceClient.analyzeContent(content, url);
    
    if (!analysis) {
      logger.warn('ML Service unavailable, skipping analysis', { 
        itemId, 
        itemType 
      });
      // Don't fail the job, just skip analysis
      return { status: 'skipped', reason: 'ML service unavailable' };
    }
    
    // Update database with analysis results
    const tableName = itemType === 'tab' ? 'tabs' : 'bookmarks';
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (analysis.summary) {
      updateFields.push(`summary = $${paramIndex++}`);
      updateValues.push(analysis.summary);
    }
    
    if (analysis.category) {
      updateFields.push(`category = $${paramIndex++}`);
      updateValues.push(analysis.category);
    }
    
    if (analysis.entities) {
      updateFields.push(`entities = $${paramIndex++}`);
      updateValues.push(JSON.stringify(analysis.entities));
    }
    
    if (analysis.keywords && Array.isArray(analysis.keywords)) {
      updateFields.push(`tags = $${paramIndex++}`);
      updateValues.push(analysis.keywords);
    }
    
    if (analysis.embedding && Array.isArray(analysis.embedding)) {
      updateFields.push(`embedding = $${paramIndex++}`);
      updateValues.push(`[${analysis.embedding.join(',')}]`);
    }
    
    if (updateFields.length > 0) {
      updateValues.push(itemId);
      await db.query(
        `UPDATE ${tableName} SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        updateValues
      );
    }
    
    logger.info('Content analysis completed successfully', { 
      itemId, 
      itemType,
      fieldsUpdated: updateFields.length 
    });
    
    return { status: 'completed', analysis };
  } catch (error) {
    logger.error('Content analysis job failed', { 
      jobId: job.id,
      itemId, 
      itemType,
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
});

// Archival job processor
archivalQueue.process(async (job) => {
  const { url, userId } = job.data;
  
  logger.info('Processing archival job', { 
    jobId: job.id, 
    url 
  });
  
  try {
    const archiveService = require('../services/archiveService');
    const result = await archiveService.archivePage(url, userId);
    
    logger.info('Archival completed successfully', { 
      jobId: job.id,
      url,
      archiveId: result.id 
    });
    
    return result;
  } catch (error) {
    logger.error('Archival job failed', { 
      jobId: job.id,
      url,
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
});

// Suggestion generation job processor
suggestionQueue.process(async (job) => {
  logger.info('Processing suggestion generation job', { 
    jobId: job.id 
  });
  
  try {
    const suggestionService = require('../services/suggestionService');
    const { userId } = job.data || {};
    
    const result = await suggestionService.generateSuggestions(userId);
    
    logger.info('Suggestion generation completed successfully', { 
      jobId: job.id,
      suggestionsGenerated: result?.count || 0 
    });
    
    return result;
  } catch (error) {
    logger.error('Suggestion generation job failed', { 
      jobId: job.id,
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
});

// Add error event listeners for queues
if (process.env.NODE_ENV !== 'test') {
  [contentAnalysisQueue, archivalQueue, suggestionQueue, bulkImportQueue].forEach(queue => {
    queue.on('failed', (job, err) => {
      logger.error('Queue job failed', {
        queueName: queue.name,
        jobId: job.id,
        data: job.data,
        error: err.message,
        attemptsMade: job.attemptsMade,
      });
    });
    
    queue.on('stalled', (job) => {
      logger.warn('Queue job stalled', {
        queueName: queue.name,
        jobId: job.id,
        data: job.data,
      });
    });
    
    queue.on('error', (error) => {
      logger.error('Queue error', {
        queueName: queue.name,
        error: error.message,
      });
    });
  });
}

module.exports = {
  contentAnalysisQueue,
  archivalQueue,
  suggestionQueue,
  bulkImportQueue
};
