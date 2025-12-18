import { Router } from 'express';
import { CacheEngine } from '../../cache/engine';
import { validateRequest, schemas } from '../middleware/validation';

export default function createCacheRoutes(cache: CacheEngine): Router {
  const router = Router();

  // Core CRUD Operations

  // GET /api/get/:key
  router.get(
    '/get/:key',
    validateRequest(schemas.getKey),
    (req, res) => {
      const { key } = req.params;
      const value = cache.get(key);

      res.json({
        key,
        value,
        exists: value !== null,
      });
    }
  );

  // POST /api/set
  router.post(
    '/set',
    validateRequest(schemas.setKey),
    (req, res) => {
      const { key, value, ttl } = req.body;
      const success = cache.set(key, value, { ttl });

      res.json({
        success,
        key,
        ttl,
      });
    }
  );

  // DELETE /api/delete/:key
  router.delete(
    '/delete/:key',
    validateRequest(schemas.deleteKey),
    (req, res) => {
      const { key } = req.params;
      const deleted = cache.delete(key);

      res.json({
        success: deleted,
        key,
      });
    }
  );

  // GET /api/exists/:key
  router.get(
    '/exists/:key',
    validateRequest(schemas.existsKey),
    (req, res) => {
      const { key } = req.params;
      const exists = cache.exists(key);

      res.json({
        key,
        exists,
      });
    }
  );

  // Advanced Operations

  // POST /api/increment/:key
  router.post(
    '/increment/:key',
    validateRequest(schemas.incrementKey),
    (req, res) => {
      try {
        const { key } = req.params;
        const { amount = 1 } = req.body;
        const newValue = cache.increment(key, amount);

        res.json({
          key,
          value: newValue,
          amount,
        });
      } catch (error: any) {
        res.status(400).json({
          error: error.message,
          key: req.params.key,
        });
      }
    }
  );

  // POST /api/update-ttl/:key
  router.post(
    '/update-ttl/:key',
    validateRequest(schemas.updateTTL),
    (req, res) => {
      const { key } = req.params;
      const { ttl } = req.body;
      const updated = cache.updateTTL(key, ttl);

      res.json({
        success: updated,
        key,
        ttl,
      });
    }
  );

  // GET /api/keys
  router.get(
    '/keys',
    validateRequest(schemas.listKeys),
    (req, res) => {
      const { limit = 100, offset = 0 } = req.query;
      const allKeys = cache.keys();
      const keys = allKeys.slice(Number(offset), Number(offset) + Number(limit));

      res.json({
        keys,
        total: allKeys.length,
        limit: Number(limit),
        offset: Number(offset),
      });
    }
  );

  // Batch Operations

  // POST /api/batch/set
  router.post(
    '/batch/set',
    validateRequest(schemas.batchSet),
    (req, res) => {
      const { entries } = req.body;
      const success = cache.setMultiple(entries);

      res.json({
        success,
        count: entries.length,
      });
    }
  );

  // POST /api/batch/get
  router.post(
    '/batch/get',
    validateRequest(schemas.batchGet),
    (req, res) => {
      const { keys } = req.body;
      const result = cache.getMultiple(keys);

      res.json({
        result,
        requested: keys.length,
        found: Object.keys(result).length,
      });
    }
  );

  // POST /api/batch/delete
  router.post(
    '/batch/delete',
    validateRequest(schemas.batchDelete),
    (req, res) => {
      const { keys } = req.body;
      const deletedKeys = cache.deleteMultiple(keys);

      res.json({
        deleted: deletedKeys,
        requested: keys.length,
        deletedCount: deletedKeys.length,
      });
    }
  );

  return router;
}
