import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { createError } from './error-handler';

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

export function validateRequest(schema: ValidationSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => `Body: ${detail.message}`));
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => `Query: ${detail.message}`));
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        errors.push(...error.details.map(detail => `Params: ${detail.message}`));
      }
    }

    if (errors.length > 0) {
      const error = createError(`Validation failed: ${errors.join(', ')}`, 400);
      return next(error);
    }

    next();
  };
}

// Common validation schemas
export const schemas = {
  // Cache operations
  setKey: {
    body: Joi.object({
      key: Joi.string().min(1).max(256).required(),
      value: Joi.any().required(), // Allow any JSON-serializable value
      ttl: Joi.number().integer().min(1).max(86400000).optional(), // Max 24 hours
    }),
  },

  getKey: {
    params: Joi.object({
      key: Joi.string().min(1).max(256).required(),
    }),
  },

  deleteKey: {
    params: Joi.object({
      key: Joi.string().min(1).max(256).required(),
    }),
  },

  existsKey: {
    params: Joi.object({
      key: Joi.string().min(1).max(256).required(),
    }),
  },

  incrementKey: {
    params: Joi.object({
      key: Joi.string().min(1).max(256).required(),
    }),
    body: Joi.object({
      amount: Joi.number().default(1),
    }),
  },

  updateTTL: {
    params: Joi.object({
      key: Joi.string().min(1).max(256).required(),
    }),
    body: Joi.object({
      ttl: Joi.number().integer().min(1).max(86400000).required(),
    }),
  },

  // Batch operations
  batchSet: {
    body: Joi.object({
      entries: Joi.array().items(
        Joi.object({
          key: Joi.string().min(1).max(256).required(),
          value: Joi.any().required(),
          ttl: Joi.number().integer().min(1).max(86400000).optional(),
        })
      ).min(1).max(100).required(), // Max 100 entries per batch
    }),
  },

  batchGet: {
    body: Joi.object({
      keys: Joi.array().items(
        Joi.string().min(1).max(256)
      ).min(1).max(100).required(),
    }),
  },

  batchDelete: {
    body: Joi.object({
      keys: Joi.array().items(
        Joi.string().min(1).max(256)
      ).min(1).max(100).required(),
    }),
  },

  // Pagination for keys listing
  listKeys: {
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(1000).default(100),
      offset: Joi.number().integer().min(0).default(0),
    }),
  },
};
