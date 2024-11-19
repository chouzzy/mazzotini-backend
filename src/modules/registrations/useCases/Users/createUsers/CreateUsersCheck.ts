import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { CreateUsersRequestProps } from "./CreateUsersController";
import { createUsersSchema } from "./CreateUsersSchema";
import { UsersEntity } from "../../../entities/Users";




async function checkBody(usersData: CreateUsersRequestProps) {
    // check body properties
    try {
        await createUsersSchema.validate(usersData, {
            abortEarly: false,
        })

        return
    }
    catch (error) {
        throw error
    }
}

export { checkBody }



