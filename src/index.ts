import express, { Request, Response } from 'express';
import subjectsRouter from './routes/subjects';
import departmentsRouter from './routes/departments';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import classesRouter from './routes/classes';
import enrollmentsRouter from './routes/enrollments';
import statsRouter from './routes/stats';
import schedulesRouter from './routes/schedules';
import cors from 'cors';

const app = express();
const PORT = 8000;

app.use(cors({
  origin:process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials:true,
}))

// JSON middleware
app.use(express.json());

app.use('/api/auth',authRouter);
app.use('/api/users',usersRouter);
app.use('/api/classes',classesRouter);
app.use('/api/enrollments',enrollmentsRouter);
app.use('/api/stats',statsRouter);
app.use('/api/schedules',schedulesRouter);
app.use('/api/subjects',subjectsRouter);
app.use('/api/departments',departmentsRouter);

// Root GET route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the Classroom API' });
});

// Health check for uptime monitoring / deploys
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Start server and log URL
const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
