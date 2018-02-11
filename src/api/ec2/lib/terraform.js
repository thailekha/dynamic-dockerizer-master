import async from 'async';
import { logger, shell, workspaceDir } from '../../../lib/util';

function terraformContainerCmd(accessKeyId, cmd) {
  const fullCmd = `cd ${workspaceDir(accessKeyId)} && docker run --rm -v "$PWD:/request" --entrypoint /bin/ash hashicorp/terraform:light -c "cd request && ${cmd}"`;
  logger.debug(fullCmd);
  return fullCmd;
}

export function init(accessKeyId, cb) {
  //avoid using replaceAll " to \" for now because of endless loop
  shell(terraformContainerCmd(accessKeyId, 'terraform init -backend-config=\\"shared_credentials_file=shared_credentials\\" -var-file=sample.tfvars.json'), err => {
    if (err) {
      return cb(err);
    }
    cb(null);
  });
}

export function refresh(accessKeyId, resource, cb) {
  shell(terraformContainerCmd(accessKeyId, `terraform refresh -var-file=sample.tfvars.json -target=${resource}`), err => {
    if (err) {
      return cb(err);
    }
    cb(null);
  });
}

export function show(accessKeyId, resource, cb) {
  let showOutput;

  async.series([
    function(callback) {
      refresh(accessKeyId, resource, err => {
        if (err) {
          return callback(err);
        }

        callback(null);
      });
    },
    function(callback) {
      shell(terraformContainerCmd(accessKeyId, `terraform state show -var-file=sample.tfvars.json ${resource}`), (err, stdout) => {
        if (err) {
          return callback(err);
        }

        showOutput = stdout;
        callback(null);
      });
    }
  ],
  function(err) {
    if (err) {
      return cb(err);
    }
    cb(null, showOutput);
  });
}

export function showMany(accessKeyId, resources, cb) {
  const invalidResources = [];
  const shows = resources.map(resource => asyncCallback => {
    show(accessKeyId, resource, (err, stdout) => {
      if (err) {
        return asyncCallback(err);
      }

      if (!(stdout.length > 0)) {
        invalidResources.push(resource);
      }

      asyncCallback(null);
    });
  });

  async.parallel(shows, err => {
    if (err) {
      return cb(err);
    }

    cb(null, invalidResources);
  });
}

export function importTarget(accessKeyId, InstanceId, cb) {
  shell(terraformContainerCmd(accessKeyId, `terraform import -var-file=sample.tfvars.json aws_instance.target ${InstanceId}`), err => {
    if (err) {
      return cb(err);
    }
    cb(null);
  });
}

export function apply(accessKeyId, cb) {
  shell(terraformContainerCmd(accessKeyId, 'terraform apply -input=false -auto-approve -var-file=sample.tfvars.json'), err => {
    if (err) {
      return cb(err);
    }
    cb(null);
  });
}