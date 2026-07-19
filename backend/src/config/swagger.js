const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tab & Bookmark Manager API',
      version: '1.0.0',
      description: 'An intelligent tab and bookmark management system with AI-powered content analysis, smart suggestions, and automated archival capabilities.',
      contact: {
        name: 'API Support',
        url: 'https://github.com/ivi374forivi/tab-bookmark-manager',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT or API key',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
        },
      },
      schemas: {
        Tab: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'The tab ID',
            },
            url: {
              type: 'string',
              description: 'The tab URL',
            },
            title: {
              type: 'string',
              description: 'The tab title',
            },
            favicon: {
              type: 'string',
              description: 'The tab favicon URL',
            },
            content: {
              type: 'string',
              description: 'Extracted page content',
            },
            summary: {
              type: 'string',
              description: 'AI-generated summary',
            },
            category: {
              type: 'string',
              description: 'Content category',
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Tags',
            },
            entities: {
              type: 'object',
              description: 'Named entities',
            },
            embedding: {
              type: 'array',
              items: {
                type: 'number',
              },
              description: 'Semantic embedding vector',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Update timestamp',
            },
            last_accessed: {
              type: 'string',
              format: 'date-time',
              description: 'Last accessed timestamp',
            },
            access_count: {
              type: 'integer',
              description: 'Access count',
            },
            is_archived: {
              type: 'boolean',
              description: 'Archive status',
            },
            user_id: {
              type: 'integer',
              description: 'User ID',
            },
          },
        },
        Bookmark: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'The bookmark ID',
            },
            url: {
              type: 'string',
              description: 'The bookmark URL',
            },
            title: {
              type: 'string',
              description: 'The bookmark title',
            },
            favicon: {
              type: 'string',
              description: 'The bookmark favicon URL',
            },
            folder: {
              type: 'string',
              description: 'The bookmark folder',
            },
            content: {
              type: 'string',
              description: 'Extracted page content',
            },
            summary: {
              type: 'string',
              description: 'AI-generated summary',
            },
            category: {
              type: 'string',
              description: 'Content category',
            },
            tags: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Tags',
            },
            entities: {
              type: 'object',
              description: 'Named entities',
            },
            embedding: {
              type: 'array',
              items: {
                type: 'number',
              },
              description: 'Semantic embedding vector',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Update timestamp',
            },
            is_archived: {
              type: 'boolean',
              description: 'Archive status',
            },
            user_id: {
              type: 'integer',
              description: 'User ID',
            },
          },
        },
        Suggestion: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'The suggestion ID',
            },
            type: {
              type: 'string',
              enum: ['duplicate', 'stale', 'related'],
              description: 'Suggestion type',
            },
            item_ids: {
              type: 'array',
              items: {
                type: 'integer',
              },
              description: 'Related item IDs',
            },
            reason: {
              type: 'string',
              description: 'Reason for suggestion',
            },
            confidence: {
              type: 'number',
              description: 'Confidence score',
            },
            status: {
              type: 'string',
              enum: ['pending', 'accepted', 'rejected'],
              description: 'Suggestion status',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            user_id: {
              type: 'integer',
              description: 'User ID',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'The user ID',
            },
            username: {
              type: 'string',
              description: 'Username',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address',
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Update timestamp',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Error message',
            },
            error: {
              type: 'string',
              description: 'Error details',
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Auth',
        description: 'Authentication endpoints',
      },
      {
        name: 'User',
        description: 'User profile management',
      },
      {
        name: 'Tabs',
        description: 'Tab management',
      },
      {
        name: 'Bookmarks',
        description: 'Bookmark management',
      },
      {
        name: 'Search',
        description: 'Search functionality',
      },
      {
        name: 'Suggestions',
        description: 'AI-powered suggestions',
      },
      {
        name: 'Archive',
        description: 'Web page archival',
      },
    ],
  },
  apis: ['./src/routes/*.js'], // Path to the API routes
};

const specs = swaggerJsdoc(options);

module.exports = specs;
