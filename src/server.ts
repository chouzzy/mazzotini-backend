import 'reflect-metadata';
import express, { NextFunction, Request, Response } from 'express'
import { router } from './routes'
import { AppError } from './errors/AppError'
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';
import specs from '../swagger';
import { ProjectProgressInvestmentPartnerController } from './modules/investments/useCases/Investments/investmentProgressImport/InvestmentProgressImportController';
import formidable from 'formidable';
import { checkJwtFromCookie, jwtCheck } from './modules/registrations/middleware/auth0Check';
var cookieParser = require('cookie-parser')


const app = express()

app.use(cors({
    origin: process.env.FRONT_END_URL,
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH'],
    credentials: true, // Permita o envio de credenciais (cookies, headers de autorização)
}));

const projectProgressInvestmentPartnerController = new ProjectProgressInvestmentPartnerController();

app.post('/investments/progress/import/:id', projectProgressInvestmentPartnerController.handle);

app.use(express.json()); // Define o body parser para JSON após a rota de upload
app.use(cookieParser());

app.get('/test-cookies', (req, res) => {
    res.json({ cookies: req.cookies });
});



app.use(router);



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
