import { Router } from 'express';
import { ec2Handler } from './ec2';

export default function buildAPI(server) {
  const router = Router({mergeParams:true});
  ec2Handler(router);

  server.use('/ec2', router);
}