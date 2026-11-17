import {
  createUrlService,
  getUrlDetailsService,
  getUrlAnalyticsService,
  deleteUrlService,
  listUrlsService,
} from './url.service.js';
import { StatusCodes } from 'http-status-codes';

export async function createUrl(request, reply) {
  const { originalUrl, customCode } = request.body;

  const url = await createUrlService(request.server.prisma, request.server.redis, {
    originalUrl,
    customCode,
  });

  return reply.status(StatusCodes.CREATED).send({
    success: true,
    data: url,
  });
}

export async function getUrlDetails(request, reply) {
  const { shortCode } = request.params;

  const details = await getUrlDetailsService(request.server.prisma, shortCode);

  return reply.status(StatusCodes.OK).send({
    success: true,
    data: details,
  });
}

export async function getUrlAnalytics(request, reply) {
  const { shortCode } = request.params;

  const analytics = await getUrlAnalyticsService(request.server.prisma, shortCode);

  return reply.status(StatusCodes.OK).send({
    success: true,
    data: analytics,
  });
}

export async function deleteUrl(request, reply) {
  const { shortCode } = request.params;

  const result = await deleteUrlService(
    request.server.prisma,
    request.server.redis,
    shortCode
  );

  return reply.status(StatusCodes.OK).send({
    success: true,
    data: result,
  });
}

export async function listUrls(request, reply) {
  const result = await listUrlsService(request.server.prisma, request.query);

  return reply.status(StatusCodes.OK).send({
    success: true,
    data: result,
  });
}
