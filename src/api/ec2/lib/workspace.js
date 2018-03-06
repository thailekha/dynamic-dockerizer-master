import async from 'async';
import {logger, shell, workspaceDir, optsAllPropertiesExist} from '../../../lib/util';
import jsonfile from 'jsonfile';
import writeFile from 'write';
import fileExists from 'file-exists';

export function writeAwsSdkConfig(accessKeyId, secretAccessKey, region, cb) {
  const vars = {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
    region: region
  };

  jsonfile.writeFile(`${workspaceDir(accessKeyId)}/aws_ec2_config.json`, vars, {spaces: 2}, err => {
    if (err) {
      return cb(err);
    }
    cb(null);
  });
}

export function create(opts, cb) {
  const {accessKeyId, secretAccessKey, region} = opts;

  async.series([
    function(callback) {
      shell(`mkdir -p ${workspaceDir(accessKeyId)}`, err => {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      writeAwsSdkConfig(accessKeyId, secretAccessKey, region, err => {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      shell(`cp -r ./assets/.terraform ${workspaceDir(accessKeyId)}`, err => {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      const backendConfig = `[default]\naws_access_key_id = ${accessKeyId}\naws_secret_access_key = ${secretAccessKey}`;
      writeFile(`${workspaceDir(accessKeyId)}/shared_credentials`, backendConfig, function(err) {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      shell(`cp ./assets/clone.tf.json ${workspaceDir(accessKeyId)}`, err => {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      shell(`cp ./assets/installAgent.sh ${workspaceDir(accessKeyId)}`, err => {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    }
  ],function(err) {
    if (err) {
      return cb(err);
    }
    cb(null);
  });
}

export function updateVars(opts, cb) {
  const validOpts = optsAllPropertiesExist(opts);

  if (!validOpts) {
    return cb('Error updating variables file: invalid opts');
  }

  const {target, accessKeyId, secretAccessKey, region, keypair_name, keyFile} = opts;

  async.series([
    function(callback) {
      validWithoutVars(accessKeyId, (err, basicValid) => {
        if (err) {
          return callback(err);
        }

        if (!basicValid) {
          return callback('Workspace does not exist, please create it first');
        }

        callback(null);
      });
    },
    function(callback) {
      writeAwsSdkConfig(accessKeyId, secretAccessKey, region, err => {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      keyFile.mv(`${workspaceDir(accessKeyId)}/keyFile.pem`, function(err) {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      const vars = {
        access_key: accessKeyId,
        secret_key: secretAccessKey,
        region: region,
        keypair_name: keypair_name,
        key_file: 'keyFile.pem',
        target_id: target.ImageId,
        target_type: target.InstanceType,
        subnet_id: target.SubnetId,
        vpc_id: target.VpcId,
        vpc_security_group_ids: target.SecurityGroupsIds
      };

      jsonfile.writeFile(`${workspaceDir(accessKeyId)}/sample.tfvars.json`, vars, {spaces: 2}, err => {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    }
  ],
  function(err) {
    if (err) {
      return cb(err);
    }
    cb(null);
  });
}

function valid(accessKeyId, files, cb) {
  async.every(files, function(filePath, callback) {
    fileExists(filePath, (err, exists) => {
      if (err) {
        callback(err);
      }

      if (!exists) {
        logger.debug(`${filePath} not exists`);
      }

      callback(null, exists);
    });
  }, function(err, allFilesExist) {
    if (err) {
      cb(err);
    }

    cb(null, allFilesExist);
  });
}

export function validWithoutVars(accessKeyId, cb) {
  const workspace = workspaceDir(accessKeyId);
  valid(accessKeyId, [//`${workspace}`,
    `${workspace}/aws_ec2_config.json`,
    `${workspace}/clone.tf.json`,
    `${workspace}/installAgent.sh`,
    `${workspace}/shared_credentials`,
  ], (err, allFilesExist) => {
    if (err) {
      return cb(err);
    }

    cb(null, allFilesExist);
  });
}

export function validWithVars(accessKeyId, cb) {
  const workspace = workspaceDir(accessKeyId);
  valid(accessKeyId, [//`${workspace}`,
    `${workspace}/aws_ec2_config.json`,
    `${workspace}/clone.tf.json`,
    `${workspace}/installAgent.sh`,
    `${workspace}/keyFile.pem`,
    `${workspace}/sample.tfvars.json`,
    `${workspace}/shared_credentials`,
  ], (err, allFilesExist) => {
    if (err) {
      return cb(err);
    }

    cb(null, allFilesExist);
  });
}

export function readVars(accessKeyId, cb) {
  jsonfile.readFile(`${workspaceDir(accessKeyId)}/sample.tfvars.json`, function(err, obj) {
    if (err) {
      return cb(err);
    }

    cb(null, obj);
  });
}