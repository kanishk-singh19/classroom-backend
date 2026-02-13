import express, { Request, Response } from 'express';

const app = express();
const PORT = 8000;

// JSON middleware
app.use(express.json());

// Root GET route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the Classroom API' });
});

// Start server and log URL
const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
