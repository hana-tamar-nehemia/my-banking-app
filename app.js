require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const authRouter = require('./routes/auth');
const bankRouter = require('./routes/bank');
const notificationsRouter = require('./routes/notifications');
const botRouter = require('./routes/botRoutes');

const PORT = process.env.PORT || 5000;

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bank API',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'https://bank-backend-frws.onrender.com',
        description: 'Production Server (Render)',
      },
      {
        url: `http://localhost:${PORT}`,
        description: 'Local Development Server',
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

module.exports = app;
