import async from 'async';
import {exec} from 'shelljs';
import jsonfile from 'jsonfile';
import {logger} from '../../lib/util';
import AWS from 'aws-sdk';
AWS.config.update({region: 'eu-west-1'});

export function getUser(creds, username, cb) {
  new AWS.IAM(creds)
    .getUser({
      UserName: username
    }, (err, data) => {
      if (err) {
        return cb(err);
      }
      cb(null, data);
    });
}

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

export function cloneInstance(opts, cb) {
  let target;

  const {creds, workspace, InstanceId, keyFile, accessKeyId, secretAccessKey, region, keypair_name} = opts;

  async.series([
    function(callback) {
      logger.debug('find instance');
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
      logger.debug('create workspace');
      exec(`mkdir -p ${workspace}`, code => {
        if (code !== 0) {
          return callback({'message': 'Cannot create workspace directory', code: 404});
        }
        callback(null);
      });
    },
    function(callback) {
      logger.debug('copy plugins');
      exec(`cp -r ./assets/.terraform ${workspace}`, code => {
        if (code !== 0) {
          return callback({'message': 'Cannot copy terraform plugins', code: 404});
        }
        callback(null);
      });
    },
    function(callback) {
      logger.debug('Move keyfile');
      keyFile.mv(`${workspace}/keyFile.pem`, function(err) {
        if (err) {
          return callback({'message': err, code: 404});
        }
        callback(null);
      });
    },
    function(callback) {
      logger.debug('set keyfile permission');
      exec(`chmod 400 ${workspace}/keyFile.pem`, code => {
        if (code !== 0) {
          return callback({'message': 'Cannot chmod pem file', code: 404});
        }
        callback(null);
      });
    },
    function(callback) {
      logger.debug('create variable file');
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

      jsonfile.writeFile(`${workspace}/sample.tfvars.json`, vars, {spaces: 2}, err => {
        if (err) {
          return callback({'message': err, code: 404});
        }
        callback(null);
      });
    },
    function(callback) {
      logger.debug('copy terraform base config file');
      exec(`cp ./assets/clone.tf.json ${workspace}`, code => {
        if (code !== 0) {
          return callback({'message': 'Cannot copy terraform config file', code: 404});
        }
        callback(null);
      });
    },
    function(callback) {
      logger.debug('copy agent installer script');
      exec(`cp ./assets/installAgent.sh ${workspace}`, code => {
        if (code !== 0) {
          return callback({'message': 'Cannot copy agent installer script', code: 404});
        }
        callback(null);
      });
    },
    function(callback) {
      logger.debug('terraform init');
      init(workspace, (err, data) => {
        if (err) {
          return callback({'message': err, code: 404});
        }
        callback(null, data);
      });
    },
    function(callback) {
      logger.debug('terraform show and import');
      exec(`cd ${workspace} &&
        terraform state show -var-file=sample.tfvars.json aws_instance.target`, (code, stdout) => {
          if (code !== 0) {
            return callback({'message': 'Error terraform state show', code: 404});
          }
          if (stdout.length === 0) {
            exec(`cd ${workspace} &&
            terraform import -var-file=sample.tfvars.json aws_instance.target ${InstanceId}`, code => {
              if (code !== 0) {
                return callback({'message': 'Error terraform import', code: 404});
              }
              callback(null);
            });
          } else {
            callback(null);
          }
        });
    },
    function(callback) {
      logger.debug('terraform apply');
      exec(`cd ${workspace} &&
        terraform apply -input=false -auto-approve -var-file=sample.tfvars.json`, code => {
        // if terraform command time out, no response is returned by express, why?
          if (code !== 0) {
            return callback({'message': 'Error terraform apply', code: 404});
          }
          callback(null);
        });
    },
  ], function(err) {
    if (err) {
      return cb(err);
    }

    cb(null);
  });
}

export function init(workspace, cb) {
  exec(`cd ${workspace} &&
    terraform init -var-file=sample.tfvars.json`, code => {
      if (code !== 0) {
        return cb({'message': 'Error terraform init', code: 404});
      }
      cb(null);
    });
}

export function plan(workspace, cb) {
  init(workspace, err => {
    if (err) {
      return cb(err);
    }
    exec(`cd ${workspace} &&
      terraform plan -var-file=sample.tfvars.json`, code => {
        if (code !== 0) {
          return cb({'message': 'Error terraform destroy', code: 404});
        }
        cb(null);
      });
  });
}