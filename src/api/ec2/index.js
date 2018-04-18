import async from 'async';
import {logger, shell, workspaceDir, setkeyv} from '../../lib/util';
import * as ws from './lib/workspace';
import * as terraform from './lib/terraform';
import statusCodes from 'http-status-codes';

export function getRegions(accessKeyId, cb) {
  let regions;

  async.series([
    function(callback) {
      ws.validWithoutVars(accessKeyId, err => {
        if (err) {
          return callback(err);
        }

        callback(null);
      });
    },
    function(callback) {
      const AWS = require('aws-sdk');
      AWS.config.loadFromPath(`${workspaceDir(accessKeyId)}/aws_ec2_config.json`);
      new AWS.EC2().describeRegions({},(err, data) => {
        if (err) {
          return callback(err);
        }

        regions = data.Regions.map(region => region.RegionName);

        callback(null);
      });
    }
  ],
  function(err) {
    if (err) {
      return cb(err);
    }
    cb(null, regions);
  });
}

function filterRunningInstances(data) {
  return data
    .Reservations
    .reduce((instances, Reservation) =>
      instances.concat(Reservation.Instances), [])
    .filter(instance => instance.State.Code === 16)
    .map(i => ({
      InstanceId: i.InstanceId,
      ImageId: i.ImageId,
      PublicDnsName: i.PublicDnsName,
      Tags: i.Tags,
      InstanceType: i.InstanceType,
      SubnetId: i.SubnetId,
      VpcId: i.VpcId,
      //SecurityGroupsIds: `"${i.SecurityGroups.map(sg => sg.GroupId).join('","')}"`
      SecurityGroupsIds: i.SecurityGroups.map(sg => sg.GroupId),
      PublicIpAddress: i.PublicIpAddress
    }));
}

export function getInstances(keyv, progressKey, accessKeyId, cb) {
  let runningInstances;
  var validWorkspaceWithVars = false;

  async.series([
    function(callback) {
      ws.validWithoutVars(accessKeyId, err => {
        if (err) {
          return callback(err);
        }

        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 10, callback);
    },
    function(callback) {
      const AWS = require('aws-sdk');
      AWS.config.loadFromPath(`${workspaceDir(accessKeyId)}/aws_ec2_config.json`);
      new AWS.EC2().describeInstances((err, instances) => {
        if (err) {
          return callback(err);
        }

        runningInstances = filterRunningInstances(instances);

        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 20, callback);
    },
    function(callback) {
      ws.validWithVars(accessKeyId, err => {
        validWorkspaceWithVars = !err;
        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 30, callback);
    },
    function(callback) {
      if (!validWorkspaceWithVars || runningInstances.length === 0) {
        return callback(null);
      }

      terraform.init(accessKeyId, err => {
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      if (!validWorkspaceWithVars || runningInstances.length === 0) {
        return callback(null);
      }

      terraform.show(accessKeyId, 'aws_instance.target', (err, output) => {
        if (err) {
          return callback(err);
        }

        if (output.trim().length === 0) {
          return callback(null);
        }

        const targetOutput = output
          .split('\n')
          .filter(line => {
            const pair = line.split('=');
            return pair.length === 2 && pair[0].indexOf('id') === 0;
          })
          .map(line => line.split('=')[1]);

        if (targetOutput.length !== 1) {
          return callback(null);
        }

        runningInstances = runningInstances
          .filter(({InstanceId}) => targetOutput.filter(targetId => targetId.indexOf(InstanceId) > -1).length === 0);

        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 60, callback);
    },
    function(callback) {
      if (!validWorkspaceWithVars || runningInstances.length === 0) {
        return callback(null);
      }

      terraform.show(accessKeyId, 'aws_instance.cloned', (err, output) => {
        if (err) {
          return callback(err);
        }

        if (output.trim().length === 0) {
          return callback(null);
        }

        const cloneOutput = output
          .split('\n')
          .filter(line => {
            const pair = line.split('=');
            return pair.length === 2 && pair[0].indexOf('id') === 0;
          })
          .map(line => line.split('=')[1]);

        if (cloneOutput.length !== 1) {
          return callback(null);
        }

        runningInstances = runningInstances
          .filter(({InstanceId}) => cloneOutput.filter(cloneId => cloneId.indexOf(InstanceId) > -1).length === 0);

        callback(null);
      });
    }
  ],
  function(err) {
    if (err) {
      return cb(err);
    }
    runningInstances = runningInstances.map(i => {
      i.Tags = i.Tags.map(tag => `${tag.Key}: ${tag.Value}`);
      return i;
    });

    cb(null, runningInstances);
  });
}

export function getImportedAndCloned(keyv, progressKey, accessKeyId, cb) {
  let runningInstances, imported, cloned;
  var validWorkspaceWithVars = false;

  async.series([
    function(callback) {
      ws.validWithVars(accessKeyId, err => {
        validWorkspaceWithVars = !err;

        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 5, callback);
    },
    function(callback) {
      if (!validWorkspaceWithVars) {
        return callback(null);
      }

      const AWS = require('aws-sdk');
      AWS.config.loadFromPath(`${workspaceDir(accessKeyId)}/aws_ec2_config.json`);
      new AWS.EC2().describeInstances((err, instances) => {
        if (err) {
          return callback(err);
        }

        runningInstances = filterRunningInstances(instances);

        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 20, callback);
    },
    function(callback) {
      if (!validWorkspaceWithVars) {
        return callback(null);
      }

      terraform.show(accessKeyId, 'aws_instance.target', (err, output) => {
        if (err) {
          return callback(err);
        }

        if (output.trim().length === 0) {
          return callback(null);
        }

        const targetOutput = output
          .split('\n')
          .filter(line => {
            const pair = line.split('=');
            return pair.length === 2 && pair[0].indexOf('id') === 0;
          })
          .map(line => line.split('=')[1]);

        if (targetOutput.length !== 1) {
          return callback(null);
        }

        const filterredInstances = runningInstances
          .filter(({InstanceId}) => targetOutput.filter(targetId => targetId.indexOf(InstanceId) > -1).length === 1);

        if (filterredInstances.length !== 1) {
          return callback(null);
        }

        imported = filterredInstances[0];
        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 60, callback);
    },
    function(callback) {
      if (!validWorkspaceWithVars) {
        return callback(null);
      }

      terraform.show(accessKeyId, 'aws_instance.cloned', (err, output) => {
        if (err) {
          return callback(err);
        }

        if (output.trim().length === 0) {
          return callback(null);
        }

        const cloneOutput = output
          .split('\n')
          .filter(line => {
            const pair = line.split('=');
            return pair.length === 2 && pair[0].indexOf('id') === 0;
          })
          .map(line => line.split('=')[1]);

        if (cloneOutput.length !== 1) {
          return callback(null);
        }

        const filterredInstances = runningInstances
          .filter(({InstanceId}) => cloneOutput.filter(cloneId => cloneId.indexOf(InstanceId) > -1).length === 1);

        if (filterredInstances.length !== 1) {
          return callback(null);
        }

        cloned = filterredInstances[0];
        callback(null);
      });
    }
  ],
  function(err) {
    if (err) {
      return cb(err);
    }
    cb(null, {imported, cloned});
  });
}

function getTarget(accessKeyId, InstanceId, cb) {
  getInstances(null, null, accessKeyId, (err, runningInstances) => {
    if (err) {
      return cb(err);
    }

    const filteredInstances = runningInstances
      .filter(i => i.InstanceId === InstanceId);

    if (filteredInstances.length !== 1) {
      return cb('Cannot find instance');
    }

    cb(null, filteredInstances[0]);
  });
}

export function updateAwsConfig(accessKeyId, secretAccessKey, region, cb) {
  ws.writeAwsSdkConfig(accessKeyId, secretAccessKey, region, err => {
    if (err) {
      return cb(err);
    }

    cb(null);
  });
}

export function update(InstanceId, accessKeyId, secretAccessKey, region, keypair_name, keyFile, cb) {
  getTarget(accessKeyId, InstanceId, (err, target) => {
    if (err) {
      return cb(err);
    }

    // { InstanceId: 'i-0283b9e6d685bfede',
    //   ImageId: 'ami-1b791862',
    //   InstanceType: 't2.micro',
    //   SubnetId: 'subnet-12932249',
    //   VpcId: 'vpc-d74c32b0',
    //   SecurityGroupsIds: [ 'sg-670c321f' ] }

    ws.updateVars(target, accessKeyId, secretAccessKey, region, keypair_name, keyFile, err => {
      if (err) {
        return cb(err);
      }

      cb(null);
    });
  });
}

export function cloneInstance(keyv, progressKey, accessKeyId, InstanceId, cb) {
  let vars;

  async.series([
    function(callback) {
      ws.validWithVars(accessKeyId, err => {
        if (err) {
          return callback(err);
        }

        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 5, callback);
    },
    function(callback) {
      ws.readVars(accessKeyId, (err, varsInWorkspace) => {
        if (err) {
          return callback(err);
        }

        vars = varsInWorkspace;
        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 10, callback);
    },
    function(callback) {
      getTarget(accessKeyId, InstanceId, (err, foundTarget) => {
        if (err) {
          return callback(err);
        }

        if (vars.target_id !== foundTarget.ImageId) {
          return callback({
            message: 'target_id in workspace does not match the imageid of the target, please update you workspace',
            code: statusCodes.BAD_REQUEST
          });
        }

        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 20, callback);
    },
    function(callback) {
      logger.debug('Init');
      terraform.init(accessKeyId, (err, data) => {
        if (err) {
          return callback(err);
        }
        callback(null, data);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 30, callback);
    },
    function(callback) {
      logger.debug('Show target');
      terraform.show(accessKeyId, 'aws_instance.target',(err, stdout) => {
        if (err) {
          return callback(err);
        }
        if (stdout.length === 0) {
          logger.debug('Import target');
          terraform.importTarget(accessKeyId, InstanceId, err => {
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
      setkeyv(keyv, progressKey, 40, callback);
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
      setkeyv(keyv, progressKey, 45, callback);
    },
    function(callback) {
      logger.debug('Apply');
      terraform.apply(accessKeyId, err => {
        // if terraform command time out, no response is returned by express, why?
        if (err) {
          return callback(err);
        }
        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 95, callback);
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

export function destroy(keyv, progressKey, accessKeyId, cb) {
  var imported = true;
  var cloned = true;

  async.series([
    function(callback) {
      ws.validWithVars(accessKeyId, err => {
        if (err) {
          return callback(err);
        }

        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 10, callback);
    },
    function(callback) {
      terraform.showMany(accessKeyId, ['aws_instance.target','aws_instance.cloned'], (err, invalidResources) => {
        if (err) {
          return callback(err);
        }

        if (invalidResources.indexOf('aws_instance.target') > -1) {
          imported = false;
        }

        if (invalidResources.indexOf('aws_instance.cloned') > -1) {
          cloned = false;
        }

        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 30, callback);
    },
    function(callback) {
      if (!imported || !cloned) {
        return callback(null);
      }
      terraform.forget(accessKeyId, 'aws_instance.target', err => {
        if (err) {
          return callback(err);
        }

        callback(null);
      });
    },
    function(callback) {
      setkeyv(keyv, progressKey, 50, callback);
    },
    function(callback) {
      if (!imported || !cloned) {
        return callback(null);
      }
      terraform.destroy(accessKeyId, err => {
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