import express, { Request, Response } from 'express';
import subjectsRouter from './routes/subjects';
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

app.use('/api/subjects',subjectsRouter);

// Root GET route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the Classroom API' });
});

// Start server and log URL
const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
