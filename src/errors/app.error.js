import { StatusCodes } from 'http-status-codes';

export class AppError extends Error {
  constructor(message, statusCode = StatusCodes.INTERNAL_SERVER_ERROR, errorCode = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', errorCode = 'NOT_FOUND', details = null) {
    super(message, StatusCodes.NOT_FOUND, errorCode, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', errorCode = 'BAD_REQUEST', details = null) {
    super(message, StatusCodes.BAD_REQUEST, errorCode, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', errorCode = 'CONFLICT', details = null) {
    super(message, StatusCodes.CONFLICT, errorCode, details);
  }
}

export class GoneError extends AppError {
  constructor(message = 'Resource no longer available', errorCode = 'GONE', details = null) {
    super(message, StatusCodes.GONE, errorCode, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', errorCode = 'INTERNAL_SERVER_ERROR', details = null) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, errorCode, details);
  }
}

