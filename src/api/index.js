import ec2 from './ec2';
import iam from './iam';
import progress from './progress';
import Keyv from 'keyv';
import errorHandler from './error';

const keyv = new Keyv();

export default function buildAPI(server) {
  server.use('/iam', iam);
  server.use('/ec2', ec2(keyv));
  server.use('/progress', progress(keyv));
  server.use(errorHandler);
}