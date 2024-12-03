import { listUserNotificationsSchema } from "./ListUserNotificationsSchema";
import { UsersEntity } from "../../../../registrations/entities/Users";


interface userNotificationsPostDataProps {
    userID: any
    page: any
    pageRange: any
}

async function checkParams(userNotificationsPostData: any) {
    // check body properties
    try {
        const { userID, page, pageRange } = await listUserNotificationsSchema.validate(userNotificationsPostData, {
            abortEarly: false,
        })
        return { userID, page, pageRange }
    }
    catch (error) {
        throw error
    }
}
export { checkParams }



