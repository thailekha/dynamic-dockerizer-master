import AWS from 'aws-sdk';
AWS.config.update({region: 'eu-west-1'});

export function verifyIam(creds, username, cb) {
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