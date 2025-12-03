// git test

import express, { Request, Response } from 'express';
import UserRouter from './routes/UserRouter';
import EmailRouter from './routes/EmailRouter';
import BoardRouter from './routes/BoardRouter';
import MapRouter from './routes/MapRouter';
import ChatRouter from './routes/ChatRouter';
import AdminRouter from './routes/AdminRouter';
import NotificationRouter from './routes/NotificationRouter';
import cors from 'cors'; //cors 라이브러리를 사용하여 크로스 도메인 정책을 설정하기 위함

import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';


require('dotenv').config();

//아래의 2줄을 추가 하세요.
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true
  }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/user', UserRouter);
app.use('/api', EmailRouter);
app.use('/', BoardRouter);
app.use('/api/map', MapRouter);
app.use('/api/chat', ChatRouter);
app.use('/', AdminRouter);
app.use('/', NotificationRouter);


const swaggerDocument = YAML.load(path.join(__dirname, 'docs/swagger.yaml'));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));



app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript with Express!');
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
