import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { CreateNotificationsRequestProps } from "./createNotificationsController";
import { createNotificationsSchema } from "./CreateNotificationsSchema";




async function checkBody(notificationsData: CreateNotificationsRequestProps) {
    // check body properties
    try {
        await createNotificationsSchema.validate(notificationsData, {
            abortEarly: false,
        })
        return
    }
    catch (error) {
        throw error
    }
}
export { checkBody }



