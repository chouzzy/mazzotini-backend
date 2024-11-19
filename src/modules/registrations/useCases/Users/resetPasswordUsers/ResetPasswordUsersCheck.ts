import { ResetPasswordUsersRequestProps } from "./ResetPasswordUsersController";
import { resetPasswordUsersSchema } from "./ResetPasswordUsersSchema";


async function checkBody(checkBody: ResetPasswordUsersRequestProps) {

    try {
        await resetPasswordUsersSchema.validate(checkBody, {
            abortEarly: false
        })

        return
    } catch (error) {
        throw error
    }

}


export { checkBody }