import { UsersEntity } from "../../../entities/Users";
import { findUserByIDSchema } from "./FindUserByIDSchema";
import QueryString from "qs";


async function checkQuery(id:UsersEntity["id"]) {

    try {
        await findUserByIDSchema.validate({id}, {
            abortEarly: false
        })

        return
    } catch (error) {
        throw error
    }

}


export { checkQuery }