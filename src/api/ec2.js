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

  /**
    * @swagger
    * /ec2/{accessKeyId}/regions:
    *   get:
    *     tags:
    *       - EC2
    *     summary: 'Retrieve all EC2 regions'
    *     description:
    *     operationId: getRegions
    *     produces:
    *       - application/json
    *     responses:
    *       '200':
    *         description: 'Ok'
    *         schema:
    *             type: object
    *             properties:
    *                 regions:
    *                     type: array
    *                     example: ["eu-west-3","eu-west-2","eu-west-1"]
    */
  router.get('/:accessKeyId/regions',(req, res, next) => {
    // no need to validate param here. if it's empty it won't match this route anyway
    getRegions(req.params.accessKeyId, (err, regions) => {
      if (err) {
        return next(err);
      }

      res.json({regions});
    });
  });

  /**
    * @swagger
    * /ec2/{accessKeyId}:
    *   post:
    *     tags:
    *       - EC2
    *     summary: 'Trigger setup for an authenticated IAM credential on the master server'
    *     description:
    *     operationId: createWorkspace
    *     produces:
    *       - application/json
    *     parameters:
    *       - name: IAM secret access key
    *         in: body
    *         required: true
    *         type: string
    *       - name: EC2 region
    *         in: body
    *         required: true
    *         type: string
    *     responses:
    *       '200':
    *         description: 'Ok'
    *         schema:
    *             type: object
    *             properties:
    *                 message:
    *                     type: string
    *                     example: Workspace for foo created
    */
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

  /**
    * @swagger
    * /ec2/{accessKeyId}/awsconfig:
    *   post:
    *     tags:
    *       - EC2
    *     summary: 'Update configuration of an authenticated IAM credential on the master server'
    *     description:
    *     operationId: updateAwsConfig
    *     produces:
    *       - application/json
    *     parameters:
    *       - name: IAM secret access key
    *         in: body
    *         required: true
    *         type: string
    *       - name: EC2 region
    *         in: body
    *         required: true
    *         type: string
    *     responses:
    *       '200':
    *         description: 'Ok'
    *         schema:
    *             type: object
    *             properties:
    *                 message:
    *                     type: string
    *                     example: AWS config for foo updated
    */
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

  /**
    * @swagger
    * /ec2/{accessKeyId}:
    *   put:
    *     tags:
    *       - EC2
    *     summary: 'Update settings for preparation before cloning an instance'
    *     description:
    *     operationId: updateWorkspace
    *     produces:
    *       - application/json
    *     parameters:
    *       - name: IAM secret access key
    *         in: body
    *         required: true
    *         type: string
    *       - name: EC2 region
    *         in: body
    *         required: true
    *         type: string
    *       - name: EC2 keypair name
    *         in: body
    *         required: true
    *         type: string
    *       - name: Instance ID
    *         in: body
    *         required: true
    *         type: string
    *       - name: Pem key file
    *         in: files
    *         required: true
    *         type: binary
    *     responses:
    *       '200':
    *         description: 'Ok'
    *         schema:
    *             type: object
    *             properties:
    *                 message:
    *                     type: string
    *                     example: Workspace for foo updated
    */
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

  /**
    * @swagger
    * /ec2/{accessKeyId}/instances:
    *   get:
    *     tags:
    *       - EC2
    *     summary: 'Fetch running EC2 instances (excluding the cloned ones)'
    *     description:
    *     operationId: getInstances
    *     produces:
    *       - application/json
    *     responses:
    *       '200':
    *         description: 'Ok'
    *         schema:
    *             type: object
    *             properties:
    *                 instances:
    *                     type: array
    */
  router.get('/:accessKeyId/instances', (req, res, next) => {
    getInstances(keyv, req.headers['x-dd-progress'], req.params.accessKeyId, (err, runningInstances) => {
      keyv.delete(req.headers['x-dd-progress']);
      if (err) {
        return next(err);
      }
      res.json({instances: runningInstances});
    });
  });

  /**
    * @swagger
    * /ec2/{accessKeyId}/{InstanceId}/clone:
    *   get:
    *     tags:
    *       - EC2
    *     summary: 'Clone an EC2 instance'
    *     description:
    *     operationId: cloneInstance
    *     produces:
    *       - application/json
    *     responses:
    *       '200':
    *         description: 'Ok'
    *         schema:
    *             type: object
    *             properties:
    *                 message:
    *                     type: string
    *                     example: Target imported and cloned
    */
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

  /**
    * @swagger
    * /ec2/{accessKeyId}/importedandcloned:
    *   get:
    *     tags:
    *       - EC2
    *     summary: 'Get imported EC2 instance and cloned EC2 instance that the master server keeps track of'
    *     description:
    *     operationId: getImportedAndCloned
    *     produces:
    *       - application/json
    *     responses:
    *       '200':
    *         description: 'Ok'
    *         schema:
    *             type: object
    *             properties:
    *                 imported:
    *                     type: object
    *                 cloned:
    *                     type: object
    */
  router.get('/:accessKeyId/importedandcloned', (req, res, next) => {
    getImportedAndCloned(keyv, req.headers['x-dd-progress'], req.params.accessKeyId, (err, importedAndCloned) => {
      keyv.delete(req.headers['x-dd-progress']);
      if (err) {
        return next(err);
      }
      res.json(importedAndCloned);
    });
  });

  /**
    * @swagger
    * /ec2/{accessKeyId}:
    *   delete:
    *     tags:
    *       - EC2
    *     summary: 'Destroy the clone that the master server keeps track of'
    *     description:
    *     operationId: destroy
    *     produces:
    *       - application/json
    *     responses:
    *       '200':
    *         description: 'Ok'
    *         schema:
    *             type: object
    *             properties:
    *                 message:
    *                     type: string
    *                     example: Forgot target and destroyed cloned
    */
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