import { Investment } from "@prisma/client"
import { GetInvestmentByIDSchema } from "./GetInvestmentByIDSchema"

async function checkQuery(id: Investment["id"]) {

    try {
        await GetInvestmentByIDSchema.validate({id}, {
            abortEarly: false
        })
        return
    } catch (error) {
        throw error
    }


}
export { checkQuery }