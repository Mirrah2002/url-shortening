import {
  createUrl,
  getUrlDetails,
  getUrlAnalytics,
  deleteUrl,
  listUrls,
} from './url.controller.js';
import {
  createUrlSchema,
  shortCodeParamSchema,
  listUrlsQuerySchema,
} from './url.schema.js';

export default async function urlRoutes(fastify) {
  // Create short URL
  fastify.post('/', {
    schema: createUrlSchema,
  }, createUrl);

  // List shortened URLs with pagination
  fastify.get('/', {
    schema: listUrlsQuerySchema,
  }, listUrls);

  // Get URL metadata and click count
  fastify.get('/:shortCode', {
    schema: shortCodeParamSchema,
  }, getUrlDetails);

  // Get detailed click analytics
  fastify.get('/:shortCode/analytics', {
    schema: shortCodeParamSchema,
  }, getUrlAnalytics);

  // Delete short URL and clear cache
  fastify.delete('/:shortCode', {
    schema: shortCodeParamSchema,
  }, deleteUrl);
}
