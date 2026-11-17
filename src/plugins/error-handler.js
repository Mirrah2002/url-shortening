import fp from 'fastify-plugin';
import { AppError } from '../errors/app.error.js';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

async function errorHandlerPlugin(fastify) {
  // Custom 404 handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(StatusCodes.NOT_FOUND).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
        details: null,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Central error handler
  fastify.setErrorHandler((error, request, reply) => {
    const timestamp = new Date().toISOString();

    // Fastify schema validation error
    if (error.validation) {
      return reply.status(StatusCodes.BAD_REQUEST).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.validation.map((v) => ({
            field: v.instancePath || v.params?.missingProperty || 'unknown',
            message: v.message,
          })),
        },
        timestamp,
      });
    }

    // Known Application domain error
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error(error);
      } else {
        request.log.warn({ errorCode: error.errorCode, message: error.message }, 'Application operational error');
      }

      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.errorCode,
          message: error.message,
          details: error.details,
        },
        timestamp,
      });
    }

    // Prisma specific errors
    if (error.code === 'P2002') {
      return reply.status(StatusCodes.CONFLICT).send({
        success: false,
        error: {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A resource with this identifier already exists',
          details: error.meta,
        },
        timestamp,
      });
    }

    if (error.code === 'P2025') {
      return reply.status(StatusCodes.NOT_FOUND).send({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Requested record does not exist',
          details: null,
        },
        timestamp,
      });
    }

    // Fastify Rate Limit error (if caught here)
    if (error.statusCode === StatusCodes.TOO_MANY_REQUESTS) {
      return reply.status(StatusCodes.TOO_MANY_REQUESTS).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message,
          details: null,
        },
        timestamp,
      });
    }

    // Unhandled / Internal Server Error
    request.log.error(error, 'Unhandled internal server error');

    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
      ? error.statusCode
      : StatusCodes.INTERNAL_SERVER_ERROR;

    return reply.status(statusCode).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: statusCode === 500 ? 'An unexpected error occurred' : error.message,
        details: null,
      },
      timestamp,
    });
  });
}

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
});

