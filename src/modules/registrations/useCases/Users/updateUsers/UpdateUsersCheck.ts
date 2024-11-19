import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { updateUsersSchema } from "./UpdateUsersSchema";
import { UpdateUsersRequestProps } from "./UpdateUsersController";




async function checkBody(usersData: UpdateUsersRequestProps, id: any){
    // check body properties
    try {

        const yupValidation = await updateUsersSchema.validate(usersData, {
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



