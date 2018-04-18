import { Router } from 'express';
import config from '../config.json';
import jwtAuthenticate from '../middleware/jwt-authenticate';
import shortid from 'shortid';

const router = Router({mergeParams:true});

export default keyv => {
  router.use(jwtAuthenticate({ secret: config.auth.secret }));

  /**
    * @swagger
    * /status/{progresskey}:
    *   get:
    *     tags:
    *       - Progress
    *     summary: 'Check progress of a running task given a progress key identifying the task'
    *     description:
    *     operationId: checkProgress
    *     produces:
    *       - application/json
    *     responses:
    *       '200':
    *         description: 'Ok'
    *         schema:
    *             type: object
    *             properties:
    *                 status:
    *                     example: 80
    */
  router.get('/status/:progresskey', (req, res, next) => {
    keyv
      .get(req.params.progresskey)
      .then(progress => {
        if (typeof progress === 'undefined') {
          return next({'message': 'Cannot find progress key'});
        }
        res.json({status: progress});
      });
  });

  /**
    * @swagger
    * /status/generate:
    *   get:
    *     tags:
    *       - Progress
    *     summary: 'Generate a progress key'
    *     description:
    *     operationId: checkProgress
    *     produces:
    *       - application/json
    *     responses:
    *       '200':
    *         description: 'Ok'
    *         schema:
    *             type: object
    *             properties:
    *                 key:
    *                     type: string
    */
  router.get('/generate', (req, res) => {
    console.log('Generating');
    res.json({key: shortid.generate()});
  });

  return router;
};