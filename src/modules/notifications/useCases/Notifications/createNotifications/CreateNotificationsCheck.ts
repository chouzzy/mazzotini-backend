import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { createNotificationsSchema } from "./CreateNotificationsSchema";
import { CreateNotificationsRequestProps } from "./CreateNotificationsController";




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



