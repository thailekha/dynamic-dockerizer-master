import { Router } from 'express';
import { getInstances, cloneInstance, targetImportedAndCloned, update, getRegions, updateAwsConfig, getImportedAndCloned, getInstanceFromIP, destroy } from './ec2/index';
import { create } from './ec2/lib/workspace';
import jwtAuthenticate from '../middleware/jwt-authenticate';
import progress from '../middleware/progress';
import config from '../config.json';
import statusCodes from 'http-status-codes';
import { buildCheckFunction } from 'express-validator/check';
import { validRequest, stringsValidators } from '../lib/util';

const router = Router({mergeParams:true});

export default keyv => {
  router.use(jwtAuthenticate({ secret: config.auth.secret }));

  router.use(progress(keyv));

  router.get('/:accessKeyId/regions',(req, res, next) => {
    // no need to validate param here. if it's empty it won't match this route anyway
    getRegions(req.params.accessKeyId, (err, regions) => {
      if (err) {
        return next(err);
      }

      res.json({regions});
    });
  });

  router.post('/:accessKeyId/awsconfig',
    stringsValidators(['secretAccessKey','region'], buildCheckFunction(['body'])),
    (req, res, next) => {
      if (!validRequest(req,next)) {
        return;
      }

      updateAwsConfig(req.params.accessKeyId, req.body.secretAccessKey, req.body.region, err => {
        if (err) {
          return next(err);
        }

        res.json({message: `AWS config for ${req.params.accessKeyId} updated`});
      });
    });

  router.post('/:accessKeyId',
    stringsValidators(['secretAccessKey','region'], buildCheckFunction(['body'])),
    (req, res, next) => {
      if (!validRequest(req,next)) {
        return;
      }

      create(req.params.accessKeyId, req.body.secretAccessKey, req.body.region, err => {
        if (err) {
          return next(err);
        }

        res.json({message: `Workspace for ${req.params.accessKeyId} created`});
      });
    });

  router.put('/:accessKeyId',
    stringsValidators(['secretAccessKey','region','keypair_name','InstanceId'], buildCheckFunction(['body'])),
    (req, res, next) => {
      if (!validRequest(req,next)) {
        return;
      }

      if (!req.files) {
        return next({
          message: 'No files were uploaded.',
          code: statusCodes.BAD_REQUEST
        });
      }

      update(req.body.InstanceId, req.params.accessKeyId, req.body.secretAccessKey, req.body.region, req.body.keypair_name, req.files.keyFile, err => {
        if (err) {
          return next(err);
        }

        res.json({message: `Workspace for ${req.params.accessKeyId} updated`});
      });
    });

  router.get('/:accessKeyId/instances', (req, res, next) => {
    getInstances(keyv, req.headers['x-dd-progress'], req.params.accessKeyId, (err, runningInstances) => {
      keyv.delete(req.headers['x-dd-progress']);
      if (err) {
        return next(err);
      }
      res.json({instances: runningInstances});
    });
  });

  router.get('/:accessKeyId/:InstanceId/clone', (req, res, next) => {
    req.connection.setTimeout( 1000 * 60 * 6 );

    cloneInstance(keyv, req.headers['x-dd-progress'], req.params.accessKeyId, req.params.InstanceId, err => {
      keyv.delete(req.headers['x-dd-progress']);
      if (err) {
        return next(err);
      }

      res.json({message: `Target imported and cloned`});
    });
  });

  router.get('/:accessKeyId/instance',
    stringsValidators(['ip'], buildCheckFunction(['query'])),
    (req, res, next) => {
      if (!validRequest(req,next)) {
        return;
      }

      getInstanceFromIP(req.params.accessKeyId, req.query.ip, (err, instance) => {
        if (err) {
          return next(err);
        }

        res.json({instance});
      });
    });

  router.get('/:accessKeyId/importedandcloned', (req, res, next) => {
    getImportedAndCloned(keyv, req.headers['x-dd-progress'], req.params.accessKeyId, (err, importedAndCloned) => {
      keyv.delete(req.headers['x-dd-progress']);
      if (err) {
        return next(err);
      }
      res.json(importedAndCloned);
    });
  });

  router.delete('/:accessKeyId', (req, res, next) => {
    destroy(keyv, req.headers['x-dd-progress'], req.params.accessKeyId, err => {
      keyv.delete(req.headers['x-dd-progress']);
      if (err) {
        return next(err);
      }
      res.json({'message': 'Forgot target and destroyed cloned'});
    });
  });

  router.get('/:accessKeyId/:InstanceId/verify', (req, res, next) => {
    targetImportedAndCloned(req.params.accessKeyId, (err, {imported, cloned}) => {
      if (err) {
        return next(err);
      }

      if (!imported) {
        return next({
          code: statusCodes.BAD_REQUEST,
          message: `Target NOT imported`
        });
      }

      if (!cloned) {
        return next({
          code: statusCodes.BAD_REQUEST,
          message: `Target NOT cloned`
        });
      }

      res.json({message: `Target imported and cloned`});
    });
  });

  return router;
};