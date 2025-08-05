import { Router } from "express"
const welcomeRoutes = Router()

welcomeRoutes.get('/', async (req, res) => {
    res.status(200).send('Seja bem vindo ao App')
})


export {welcomeRoutes}