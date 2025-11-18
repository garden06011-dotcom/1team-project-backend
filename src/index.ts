import express, { Request, Response } from 'express';
import UserRouter from './routes/UserRouter';
import EmailRouter from './routes/EmailRouter';
<<<<<<< HEAD
import BoardRouter from './routes/BoardRouter';
=======
import MapRouter from './routes/MapRouter';
>>>>>>> f5c9d56 (선호 입지 request data db 연결)
import cors from 'cors'; //cors 라이브러리를 사용하여 크로스 도메인 정책을 설정하기 위함

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
<<<<<<< HEAD
app.use('/', BoardRouter);
=======
app.use('/api/map', MapRouter);

>>>>>>> f5c9d56 (선호 입지 request data db 연결)

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript with Express!');
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});