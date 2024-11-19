import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { deleteUsersSchema } from "./DeleteUsersSchema"




async function checkBody(id: any){
    // check body properties
    try {

        await deleteUsersSchema.validate({id}, {
            abortEarly: false,
        })

        if (!id) {
            throw Error("ID do usuário inválido.")
        }

        return
    }
    catch (error) {
        throw error
    }
}

export { checkBody }



