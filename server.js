require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const authRouter = require('./routes/auth');
const bankRouter = require('./routes/bank');

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

app.get('/', (req, res) => {
  res.json({ message: 'Bank API is running' });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully!');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });