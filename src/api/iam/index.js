import async from 'async';
import AWS from 'aws-sdk';
//AWS.config.update({region: 'eu-west-1'});

export function verifyIam(creds, username, cb) {
  let dataToBeSigned;
  const awsIam = new AWS.IAM(creds);
  const s3 = new AWS.S3(creds);
  const Bucket = `${creds.accessKeyId.toLowerCase()}-dd-state`;

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
    },
    function(callback) {
      s3.listBuckets({}, function(err, data) {
        if (err) {
          return callback(err);
        }

        if (data.Buckets.filter(b => b.Name === Bucket).length > 0) {
          return callback(null);
        }

        var bucketParams = {
          Bucket,
          ACL: 'private',
          CreateBucketConfiguration: {
            LocationConstraint: 'eu-west-1'
          }
        };

        s3.createBucket(bucketParams, err => {
          if (err) {
            return callback(err);
          }

          callback(null);
        });
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