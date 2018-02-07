import ec2 from './ec2';
import iam from './iam';

export default function buildAPI(server) {
  server.use('/iam', iam);
  server.use('/ec2', ec2);
}