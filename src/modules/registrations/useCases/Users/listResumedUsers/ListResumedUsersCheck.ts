import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { UsersEntity } from "../../../entities/Users";
import { ListResumedUsersRequestProps } from "./ListResumedUsersController";
import { listResumedUsersSchema } from "./ListResumedUsersSchema";


async function checkQuery(usersQuery: ListResumedUsersRequestProps) {

    try {
        await listResumedUsersSchema.validate(usersQuery, {
            abortEarly: false
        })

        return
    } catch (error) {
        throw error
    }

}


export { checkQuery }