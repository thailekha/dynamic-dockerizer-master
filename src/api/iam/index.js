import async from 'async';
import AWS from 'aws-sdk';
AWS.config.update({region: 'eu-west-1'});

export function verifyIam(creds, username, cb) {
  let dataToBeSigned;
  const awsIam = new AWS.IAM(creds);

  async.series([
    function(callback) {
      awsIam
        .getUser({
          UserName: username
        }, (err, data) => {
          if (err) {
            return callback(err);
          }

          dataToBeSigned = data;
          callback(null);
        });
    }
  ],
  function(err) {
    if (err) {
      return cb(err);
    }
    cb(null, dataToBeSigned);
  });
}