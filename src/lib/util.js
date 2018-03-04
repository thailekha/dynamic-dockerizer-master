import {exec} from 'shelljs';

const VERBOSE = 2;
const DEBUG = VERBOSE >= 2;
const INFO = VERBOSE >= 1;

/**	Creates a callback that proxies node callback style arguments to an Express Response object.
 *	@param {express.Response} res	Express HTTP Response
 *	@param {number} [status=200]	Status code to send on success
 *
 *	@example
 *		list(req, res) {
 *			collection.find({}, toRes(res));
 *		}
 */
export function toRes(res, status=200) {
  return (err, thing) => {
    if (err) {
      return res.status(500).send(err);
    }

    if (thing && typeof thing.toObject==='function') {
      thing = thing.toObject();
    }
    res.status(status).json(thing);
  };
}

export const logger = {
  overview: function(msg, extraCondition = true) {
    if (extraCondition) {
      console.log(`===> OVERVIEW: ${msg}`); // eslint-disable-line
    }
  },
  info: function(msg, extraCondition = true) {
    if (INFO && extraCondition) {
      console.log(`===> INFO: ${msg}`); // eslint-disable-line
    }
  },
  debug: function(msg, extraCondition = true) {
    if (DEBUG && extraCondition) {
      console.log(`===> DEBUG: ${msg}`); // eslint-disable-line
    }
  }
};

export function shell(command, cb) {
  exec(command, {silent:true}, (code, stdout, stderr) => {
    logger.info(command);
    logger.debug(`stdout: ${stdout}`);
    logger.debug(`stderr: ${stderr}`);

    if (code !== 0) {
      return cb({command, exitCode: code, stderr});
    }

    cb(null, stdout);
  });
}

export function workspaceDir(accessKeyId) {
  return `/dd-master/${accessKeyId}`;
}

export function optsAllPropertiesExist(opts) {
  return Object.keys(opts).reduce((allExist, key) => opts[key] && allExist, true);
}

export function creds(req, apiVersion) {
  return {
    accessKeyId: req.body.accessKeyId,
    secretAccessKey: req.body.secretAccessKey,
    apiVersion: apiVersion
  };
}

export function setkeyv(keyv, progressKey, value, cb) {
  if (keyv && progressKey) {
    return keyv
      .set(progressKey, value)
      .then(() => cb(null));
  }
  cb(null);
}