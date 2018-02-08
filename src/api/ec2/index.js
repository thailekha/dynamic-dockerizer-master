import async from 'async';
import jsonfile from 'jsonfile';
import writeFile from 'write';
import {logger, shell, workspaceDir} from '../../lib/util';
import fileExists from 'file-exists';
import AWS from 'aws-sdk';
AWS.config.update({region: 'eu-west-1'});

export function filterRunningInstances(data) {
  return data
    .Reservations
    .reduce((instances, Reservation) =>
      instances.concat(Reservation.Instances), [])
    .filter(instance => instance.State.Code === 16)
    .map(i => ({
      InstanceId: i.InstanceId,
      ImageId: i.ImageId,
      InstanceType: i.InstanceType,
      SubnetId: i.SubnetId,
      VpcId: i.VpcId,
      //SecurityGroupsIds: `"${i.SecurityGroups.map(sg => sg.GroupId).join('","')}"`
      SecurityGroupsIds: i.SecurityGroups.map(sg => sg.GroupId)
    }));
}

export function getInstances(creds, cb) {
  new AWS.EC2(creds)
    .describeInstances((err, instances) => {
      if (err) {
        return cb(err);
      }

      cb(null, filterRunningInstances(instances));
    });
}

export function validWorkspace(accessKeyId, cb) {
  const workspace = workspaceDir(accessKeyId);
  async.every([//`${workspace}`,
    `${workspace}/clone.tf.json`,
    `${workspace}/installAgent.sh`,
    `${workspace}/keyFile.pem`,
    `${workspace}/sample.tfvars.json`,
    `${workspace}/shared_credentials`,
  ], function(filePath, callback) {
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

export function cloneInstance(opts, cb) {
  let target;

  const {creds, InstanceId, keyFile, accessKeyId, secretAccessKey, region, keypair_name} = opts;

  async.series([
    function(callback) {
      getInstances(creds, (err, runningInstances) => {
        if (err) {
          return callback({'message': err, code: 404});
        }

        const filteredInstances = runningInstances
          .filter(i => i.InstanceId === InstanceId);

        if (filteredInstances.length !== 1) {
          return callback({'message': 'Cannot find instance', code: 404});
        }

        target = filteredInstances[0];

        callback(null);
      });
    },
    function(callback) {
      shell(`mkdir -p ${workspaceDir(accessKeyId)}`, err => {
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
      keyFile.mv(`${workspaceDir(accessKeyId)}/keyFile.pem`, function(err) {
        if (err) {
          return callback({'message': err, code: 404});
        }
        callback(null);
      });
    },
    function(callback) {
      const backendConfig = `[default]\naws_access_key_id = ${accessKeyId}\naws_secret_access_key = ${secretAccessKey}`;
      writeFile(`${workspaceDir(accessKeyId)}/shared_credentials`, backendConfig, function(err) {
        if (err) {
          return callback({'message': err, code: 404});
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
          return callback({'message': err, code: 404});
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
    },
    function(callback) {
      logger.debug('Init');
      terraformInit(accessKeyId, (err, data) => {
        if (err) {
          return callback({'message': err, code: 404});
        }
        callback(null, data);
      });
    },
    function(callback) {
      logger.debug('Show target');
      terraformShow(accessKeyId, 'aws_instance.target',(err, stdout) => {
        if (err) {
          return callback(err);
        }
        if (stdout.length === 0) {
          logger.debug('Import target');
          terraformImportTarget(accessKeyId, InstanceId, err => {
            if (err) {
              return callback(err);
            }
            callback(null);
          });
        } else {
          callback(null);
        }
      });
    },
    function(callback) {
      shell(`chmod 400 ${workspaceDir(accessKeyId)}/keyFile.pem`, err => {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      logger.debug('Apply');
      terraformApply(accessKeyId, err => {
        // if terraform command time out, no response is returned by express, why?
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      shell(`chmod 664 ${workspaceDir(accessKeyId)}/keyFile.pem`, err => {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    }
  ], function(err) {
    if (err) {
      return cb(err);
    }

    cb(null);
  });
}

export function targetImportedAndCloned(accessKeyId, cb) {
  let importedAndCloned;

  async.series([
    function(callback) {
      validWorkspace(accessKeyId, (err, workspaceIsValid) => {
        if (err) {
          return callback(err);
        }

        if (!workspaceIsValid) {
          return callback('Request workspace is not valid');
        }

        callback(null);
      });
    },
    function(callback) {
      async.every(['aws_instance.target','aws_instance.cloned'], function(resource, asyncCallback) {
        terraformShow(accessKeyId, resource, (err, stdout) => {
          if (err) {
            return asyncCallback(err);
          }
          asyncCallback(null, stdout.length > 0);
        });
      }, function(err, result) {
        if (err) {
          return callback(err);
        }
        importedAndCloned = result;
        callback(null);
      });
    }
  ],
  function(err) {
    if (err) {
      return cb(err);
    }
    cb(null, importedAndCloned);
  });
}

function terraformContainerCmd(accessKeyId, cmd) {
  const fullCmd = `cd ${workspaceDir(accessKeyId)} && docker run --rm -v "$PWD:/request" --entrypoint /bin/ash hashicorp/terraform:light -c "cd request && ${cmd}"`;
  logger.debug(fullCmd);
  return fullCmd;
}

export function terraformInit(accessKeyId, cb) {
  //avoid using replaceAll for now because of endless loop
  shell(terraformContainerCmd(accessKeyId, 'terraform init -backend-config=\\"shared_credentials_file=shared_credentials\\" -var-file=sample.tfvars.json'), err => {
    if (err) {
      return cb(err);
    }
    cb(null);
  });
}

export function terraformShow(accessKeyId, resource, cb) {
  shell(terraformContainerCmd(accessKeyId, `terraform state show -var-file=sample.tfvars.json ${resource}`), (err, stdout) => {
    if (err) {
      return cb(err);
    }
    cb(null, stdout);
  });
}

export function terraformImportTarget(accessKeyId, InstanceId, cb) {
  shell(terraformContainerCmd(accessKeyId, `terraform import -var-file=sample.tfvars.json aws_instance.target ${InstanceId}`), err => {
    if (err) {
      return cb(err);
    }
    cb(null);
  });
}

export function terraformApply(accessKeyId, cb) {
  shell(terraformContainerCmd(accessKeyId, 'terraform apply -input=false -auto-approve -var-file=sample.tfvars.json'), err => {
    if (err) {
      return cb(err);
    }
    cb(null);
  });
}

export function plan(accessKeyId, cb) {
  terraformInit(accessKeyId, err => {
    if (err) {
      return cb(err);
    }
    shell(`cd ${workspaceDir(accessKeyId)} &&
      terraform plan -var-file=sample.tfvars.json`, err => {
      if (err) {
        return cb(err);
      }
      cb(null);
    });
  });
}