import { readNotificationsSchema } from "./ReadNotificationsSchema";




async function checkParams(id: string) {
    // check body properties
    try {
        await readNotificationsSchema.validate({id}, {
            abortEarly: false,
        })
        return
    }
    catch (error) {
        throw error
    }
}
export { checkParams }



