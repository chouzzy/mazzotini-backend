import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { UsersEntity } from "../../../entities/Users";
import { FilterUsersRequestProps } from "./ListUsersController";
import { listUsersSchema } from "./ListUsersSchema";


async function checkQuery(usersQuery: FilterUsersRequestProps) {

    try {
        await listUsersSchema.validate(usersQuery, {
            abortEarly: false
        })

        return
    } catch (error) {
        throw error
    }

}


export { checkQuery }