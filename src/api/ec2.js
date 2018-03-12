import { Router } from 'express';
import { getInstances, cloneInstance, targetImportedAndCloned, update, getRegions, updateAwsConfig, getImportedAndCloned, getInstanceFromIP, destroy } from './ec2/index';
import { create } from './ec2/lib/workspace';
import jwtAuthenticate from '../middleware/jwt-authenticate';
import progress from '../middleware/progress';
import config from '../config.json';

const router = Router({mergeParams:true});

export default keyv => {
  router.use(jwtAuthenticate({ secret: config.auth.secret }));

  router.use(progress(keyv));

  router.get('/:accessKeyId/regions', (req, res) => {
    getRegions(req.params.accessKeyId, (err, regions) => {
      if (err) {
        return res.status(500).send(err);
      }

      res.status(200).json({regions});
    });
  });

  router.post('/:accessKeyId/awsconfig', (req, res) => {
    updateAwsConfig(req.params.accessKeyId, req.body.secretAccessKey, req.body.region, err => {
      if (err) {
        return res.status(500).send(err);
      }

      res.status(200).json({message: `AWS config for ${req.params.accessKeyId} updated`});
    });
  });

  router.post('/:accessKeyId', (req, res) => {
    const opts = {
      accessKeyId: req.params.accessKeyId,
      secretAccessKey: req.body.secretAccessKey,
      region: req.body.region
    };

    create(opts, err => {
      if (err) {
        return res.status(500).send(err);
      }

      res.status(200).json({message: `Workspace for ${req.params.accessKeyId} created`});
    });
  });

  router.put('/:accessKeyId', (req, res) => {
    const opts = {
      accessKeyId: req.params.accessKeyId,
      secretAccessKey: req.body.secretAccessKey,
      region: req.body.region,
      keypair_name: req.body.keypair_name,
      keyFile: req.files.keyFile,
      InstanceId: req.body.InstanceId
    };

    update(opts, err => {
      if (err) {
        return res.status(500).send(err);
      }

      res.status(200).json({message: `Workspace for ${req.params.accessKeyId} updated`});
    });
  });

  router.get('/:accessKeyId/instances', (req, res) => {
    getInstances(keyv, req.headers['x-dd-progress'], req.params.accessKeyId, (err, runningInstances) => {
      keyv.delete(req.headers['x-dd-progress']);
      if (err) {
        return res.status(500).json({'message': err});
      }
      res.json({instances: runningInstances});
    });
  });

  router.get('/:accessKeyId/:InstanceId/clone', (req, res) => {
    req.connection.setTimeout( 1000 * 60 * 6 );

    const opts = {
      accessKeyId: req.params.accessKeyId,
      InstanceId: req.params.InstanceId
    };

    cloneInstance(keyv, req.headers['x-dd-progress'], opts, err => {
      keyv.delete(req.headers['x-dd-progress']);
      if (err) {
        return res.status(500).send(err);
      }

      res.status(200).json({message: `Target imported and cloned`});
    });
  });

  router.get('/:accessKeyId/instance', (req, res) => {
    getInstanceFromIP(req.params.accessKeyId, req.query.ip, (err, instance) => {
      if (err) {
        return res.status(500).send(err);
      }

      res.status(200).json({instance});
    });
  });

  router.get('/:accessKeyId/importedandcloned', (req, res) => {
    getImportedAndCloned(keyv, req.headers['x-dd-progress'], req.params.accessKeyId, (err, importedAndCloned) => {
      keyv.delete(req.headers['x-dd-progress']);
      if (err) {
        return res.status(500).json({'message': err});
      }
      res.json(importedAndCloned);
    });
  });

  router.delete('/:accessKeyId', (req, res) => {
    destroy(keyv, req.headers['x-dd-progress'], req.params.accessKeyId, err => {
      keyv.delete(req.headers['x-dd-progress']);
      if (err) {
        return res.status(500).json({'message': err});
      }
      res.json({'message': 'Forgot target and destroyed cloned'});
    });
  });

  router.get('/:accessKeyId/:InstanceId/verify', (req, res) => {
    targetImportedAndCloned(req.params.accessKeyId, (err, {imported, cloned}) => {
      if (err) {
        return res.status(400).send(err);
      }

      if (!imported) {
        return res.status(400).json({message: `Target NOT imported`});
      }

      if (!cloned) {
        return res.status(400).json({message: `Target NOT cloned`});
      }

      res.status(200).json({message: `Target imported and cloned`});
    });
  });

  return router;
};