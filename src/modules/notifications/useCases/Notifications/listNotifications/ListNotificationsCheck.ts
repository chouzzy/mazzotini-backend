import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { ListNotificationsRequestProps } from "./ListNotificationsController";
import { listNotificationsSchema } from "./ListNotificationsSchema";




async function checkParams(id: string) {
    // check body properties
    try {
        await listNotificationsSchema.validate({id}, {
            abortEarly: false,
        })
        return
    }
    catch (error) {
        throw error
    }
}
export { checkParams }



