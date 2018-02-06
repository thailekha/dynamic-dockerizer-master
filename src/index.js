import http from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import config from './config.json';
import fileUpload from 'express-fileupload';
import buildAPI from './api/index';
import swaggerJSDoc from 'swagger-jsdoc';
import packagejson from '../package.json';
import path from 'path';

const swaggerDefinition = {
  info: {
    title: packagejson.name,
    version: packagejson.version,
    description: packagejson.description,
  },
  host: 'localhost:8080',
  basePath: '/'
};

const swaggerSpec = swaggerJSDoc({
  swaggerDefinition: swaggerDefinition,
  apis: [path.join(__dirname, 'api/*.js')]
});

const app = express();
app.server = http.createServer(app);

// logger
app.use(morgan('dev'));

// 3rd party middleware
app.use(cors({
  exposedHeaders: config.corsHeaders
}));

app.use(bodyParser.json({
  limit : config.bodyLimit
}));

app.use(fileUpload());

buildAPI(app);

app.get('/swagger.json', (req,res) => {
  res.json(swaggerSpec);
});

app.use('/docs', express.static(path.join(__dirname, '../assets/swagger')));

app.server.listen(process.env.PORT || config.port, () => {
  console.log(`Started on port ${app.server.address().port}`);
});

export default app;