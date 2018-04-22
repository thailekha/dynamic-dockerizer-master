import request from 'supertest';
import app from '../index';
import chai from 'chai';

const expect = chai.expect;

describe('process', function() {
  let credentials;

  before(function(done) {
    if (!process.env['AWS_ACCESS_KEY_ID'] || !process.env['AWS_SECRET_ACCESS_KEY'] || !process.env['AWS_USER_NAME']) {
      return done(new Error('AWS credentials not set'));
    }

    credentials = {
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
      userName: process.env['AWS_USER_NAME']
    };

    done();
  });

  it('Authenticate IAM credentials', done => {
    request(app)
      .post('/iam/authenticate')
      .send(credentials)
      .expect('Content-Type', /json/)
      .end(function(err, res) {
        expect(res.status).to.be.equal(200);
        done();
      });
  });

});