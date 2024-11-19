import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { UsersEntity } from "../../../entities/Users";
import { findUserByEmailSchema } from "./FindUserByEmailSchema";
import { FilterUsersRequestProps } from "../listUsers/ListUsersController";


async function checkQuery(usersQuery: FilterUsersRequestProps) {

    try {
        await findUserByEmailSchema.validate(usersQuery, {
            abortEarly: false
        })

        return
    } catch (error) {
        throw error
    }

}


export { checkQuery }