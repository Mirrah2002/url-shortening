export const createUrlSchema = {
  summary: 'Create short URL',
  description: 'Creates a short URL for the provided target URL, with an optional custom code.',
  body: {
    type: 'object',
    required: ['originalUrl'],
    additionalProperties: false,
    properties: {
      originalUrl: {
        type: 'string',
        minLength: 4,
        maxLength: 2048,
      },
      customCode: {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        pattern: '^[a-zA-Z0-9_-]+$',
      },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            originalUrl: { type: 'string' },
            shortCode: { type: 'string' },
            shortUrl: { type: 'string' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
          },
        },
      },
    },
  },
};

export const shortCodeParamSchema = {
  params: {
    type: 'object',
    required: ['shortCode'],
    properties: {
      shortCode: {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        pattern: '^[a-zA-Z0-9_-]+$',
      },
    },
  },
};

export const listUrlsQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      page: {
        type: 'integer',
        minimum: 1,
        default: 1,
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20,
      },
    },
  },
};

