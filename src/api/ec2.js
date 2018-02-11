import { Router } from 'express';
import { getInstances, cloneInstance, targetImportedAndCloned, update } from './ec2/index';
import { create } from './ec2/lib/workspace';

const router = Router({mergeParams:true});

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
  getInstances(req.params.accessKeyId, (err, runningInstances) => {
    if (err) {
      return res.status(500).json({'message': err});
    }
    res.json(runningInstances);
  });
});

router.get('/:accessKeyId/:InstanceId/clone', (req, res) => {
  req.connection.setTimeout( 1000 * 60 * 6 );

  const opts = {
    accessKeyId: req.params.accessKeyId,
    InstanceId: req.params.InstanceId
  };

  cloneInstance(opts, err => {
    if (err) {
      return res.status(500).send(err);
    }

    res.status(200).json({message: `Target imported and cloned`});
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

export default router;