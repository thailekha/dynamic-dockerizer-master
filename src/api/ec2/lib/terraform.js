import async from 'async';
import { logger, shell, workspaceDir } from '../../../lib/util';

function terraformContainerCmd(accessKeyId, cmd) {
  const fullCmd = `cd ${workspaceDir(accessKeyId)} && docker run --rm -v "$PWD:/request" --entrypoint /bin/ash hashicorp/terraform:light -c "cd request && ${cmd}"`;
  logger.debug(fullCmd);
  return fullCmd;
}

export function init(accessKeyId, cb) {
  //avoid using replaceAll " to \" for now because of endless loop
  shell(terraformContainerCmd(accessKeyId, 'terraform init -backend-config=\\"s3_config\\" -backend-config=\\"shared_credentials_file=shared_credentials\\" -var-file=sample.tfvars.json'), err => {
    if (err) {
      const errMsg = 'Failed to init terraform';
      err.message = err.message ? (err.message += `\n${errMsg}`) : errMsg;
      return cb(err);
    }
    cb(null);
  });
}

export function refresh(accessKeyId, resource, cb) {
  shell(terraformContainerCmd(accessKeyId, `terraform refresh -var-file=sample.tfvars.json -target=${resource}`), err => {
    if (err) {
      const errMsg = 'Failed to refresh terraform state';
      err.message = err.message ? (err.message += `\n${errMsg}`) : errMsg;
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
          const errMsg = 'Failed to run terraform show';
          err.message = err.message ? (err.message += `\n${errMsg}`) : errMsg;
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
      const errMsg = 'Failed to import target into terraform';
      err.message = err.message ? (err.message += `\n${errMsg}`) : errMsg;
      return cb(err);
    }
    cb(null);
  });
}

export function forget(accessKeyId, resource, cb) {
  shell(terraformContainerCmd(accessKeyId, `terraform state rm -var-file=sample.tfvars.json ${resource}`), (err, stdout) => {
    if (err) {
      const errMsg = 'Failed to forget terraform resource';
      err.message = err.message ? (err.message += `\n${errMsg}`) : errMsg;
      return cb(err);
    }
    cb(null, stdout);
  });
}

export function apply(accessKeyId, cb) {
  shell(terraformContainerCmd(accessKeyId, 'terraform apply -input=false -auto-approve -var-file=sample.tfvars.json'), err => {
    if (err) {
      const errMsg = 'Failed to run terraform apply';
      err.message = err.message ? (err.message += `\n${errMsg}`) : errMsg;
      return cb(err);
    }
    cb(null);
  });
}

export function destroy(accessKeyId, cb) {
  shell(terraformContainerCmd(accessKeyId, 'terraform destroy -force -var-file=sample.tfvars.json'), err => {
    if (err) {
      const errMsg = 'Failed to run terraform destroy';
      err.message = err.message ? (err.message += `\n${errMsg}`) : errMsg;
      return cb(err);
    }
    cb(null);
  });
}