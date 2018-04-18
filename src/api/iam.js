import { Router } from 'express';
import { verifyIam } from './iam/index';
import { buildCheckFunction } from 'express-validator/check';
import { creds, validRequest, stringsValidators } from '../lib/util';
import config from '../config.json';
import jwt from 'jsonwebtoken';

const router = Router({mergeParams:true});

/**
  * @swagger
  * definition:
  *   authenticateIamParams:
  *     properties:
  *       accessKeyId: { type: string }
  *       secretAccessKey: { type: string }
  *       userName: { type: string }
  * /iam/authenticate:
  *   post:
  *     tags:
  *       - IAM
  *     summary: 'Authenticate with an IAM credential'
  *     description:
  *     operationId: authenticateIam
  *     produces:
  *       - application/json
  *     parameters:
  *       - schema: { $ref: '#/definitions/authenticateIamParams' }
  *         in: body
  *         name: 'IAM credential'
  *         type: object
  *         description: 'The IAM credential to be verified'
  *         required: true
  *     responses:
  *       '200': { description: 'Ok' }
  */
router.post('/authenticate',
  stringsValidators(['accessKeyId','secretAccessKey','userName'], buildCheckFunction(['body'])),
  (req, res, next) => {
    if (!validRequest(req,next)) {
      return;
    }

    const credentials = creds(req);

    verifyIam(credentials, req.body.userName, (err, data) => {
      if (err) {
        return next(err);
      }

      const token = jwt.sign(credentials, config.auth.secret, {
        expiresIn: '48h'
      });

      const {accessKeyId, secretAccessKey} = credentials;

      res.status(200).json({
        userName: data.User.UserName,
        accessKeyId,
        secretAccessKey,
        token
      });
    });
  });

export default router;