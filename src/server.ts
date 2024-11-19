import 'reflect-metadata';
import express, { NextFunction, Request, Response } from 'express'
import { router } from './routes'
import { AppError } from './errors/AppError'
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';
import specs from '../swagger';
var cookieParser = require('cookie-parser')


const app = express()

app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH'],
    credentials: true, // Permita o envio de credenciais (cookies, headers de autorização)
}));

app.use(express.json())

app.use(bodyParser.json({ type: 'application/json' }))

app.use(cookieParser());

app.use(router)



// Tratamento de erro
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {

    // Erros instanciados na classe AppError, ex throw new AppError(lalala)
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            message: err.message
        })
    }

    console.log(err)

    // Erro sem instanciar na classe App Error ex Throw new Error(lalala)
    return res.status(500).json({
        status: 'error',
        message: `⛔ Internal Server Error: ${err.message}⛔`
    })
})

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.listen(8081, () => console.log('System working... 🦥'));
