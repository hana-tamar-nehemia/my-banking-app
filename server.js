require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const authRouter = require('./routes/auth');
const bankRouter = require('./routes/bank');
const notificationsRouter = require('./routes/notifications');
const botRouter = require('./routes/botRoutes');

const PORT = process.env.PORT || 5000; // רנדר קובע את הפורט אוטומטית, אז אנחנו נותנים לו עדיפות

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bank API',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'https://bank-backend-frws.onrender.com', // הכתובת הרשמית שלך ברנדר עבור המרצים
        description: 'Production Server (Render)'
      },
      {
        url: `http://localhost:${PORT}`,
        description: 'Local Development Server'
      },
    ],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/auth', authRouter);
app.use('/api/bank', bankRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/bot', botRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Bank API is running' });
});

// HTTP server wraps Express so Socket.IO can share the same port.
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Authenticate every socket connection with the same JWT used for the REST API.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: no token'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    return next();
  } catch (err) {
    return next(new Error('Authentication error: invalid token'));
  }
});

io.on('connection', (socket) => {
  // Each user joins a private room keyed by their id so we can target them directly.
  socket.join(socket.userId);
  console.log(`Socket connected for user ${socket.userId}`);

  socket.on('disconnect', () => {
    console.log(`Socket disconnected for user ${socket.userId}`);
  });
});

// Expose io to the rest of the app (e.g. routes) via req.app.get('io').
app.set('io', io);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully!');
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
