import { validationResponse } from "../../../../types";

async function ErrorValidation(token: validationResponse["token"] | validationResponse): Promise<validationResponse> {

    function checkIfIsAError(token: any): token is validationResponse {
        if (typeof(token) === "string") {
            return false
        } else {
            return 'isValid' in token;
        }
    }

    if (checkIfIsAError(token)) {

        //É um erro
        return token
    } else {

        //Não é um erro
        return {
            isValid: true,
            statusCode: 202,
            successMessage: 'Não foi encontrado nenhum tipo de erro.'
        }
    }

}
export { ErrorValidation }



