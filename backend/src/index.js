require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const logger = require('./utils/logger');
const tabRoutes = require('./routes/tabs');
const bookmarkRoutes = require('./routes/bookmarks');
const searchRoutes = require('./routes/search');
const suggestionsRoutes = require('./routes/suggestions');
const archiveRoutes = require('./routes/archive');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const billingRoutes = require('./routes/billing');
const { initializeDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const automationEngine = require('./services/automationEngine');
const rateLimit = require('express-rate-limit');
const { errorHandler, notFoundHandler, handleUncaughtException, handleUnhandledRejection } = require('./middleware/errorHandler');

// Handle uncaught exceptions and unhandled rejections outside the Jest import path.
if (process.env.NODE_ENV !== 'test') {
  handleUncaughtException();
  handleUnhandledRejection();
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customSiteTitle: 'Tab & Bookmark Manager API',
  customCss: '.swagger-ui .topbar { display: none }',
}));

// Routes
app.use('/api/tabs', tabRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/billing', billingRoutes);

// Health check
app.get('/health', async (req, res) => {
  const mlServiceClient = require('./utils/mlServiceClient');
  const mlStatus = mlServiceClient.getMLServiceStatus();
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      api: 'healthy',
      mlService: mlStatus.healthy ? 'healthy' : 'unhealthy',
      mlServiceLastCheck: mlStatus.lastCheck,
    }
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Initialize services
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Start ML service health monitoring
    const mlServiceClient = require('./utils/mlServiceClient');
    mlServiceClient.startHealthChecks();
    logger.info('ML Service health monitoring started');

    // Start automation engine
    automationEngine.start();
    logger.info('Automation engine started');

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`Backend API server running on port ${PORT}`);
    });
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    automationEngine.stop();
    process.exit(0);
  });
}

module.exports = { app, startServer };
