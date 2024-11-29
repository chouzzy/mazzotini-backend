// import { validationResponse } from "../../../../../types";

// async function ErrorValidation(authenticatedUsers: string | validationResponse): Promise<validationResponse> {

//     function checkIfIsAError(authenticatedUsers: any): authenticatedUsers is validationResponse {
        
//         return 'isValid' in authenticatedUsers;
//     }

//     if (checkIfIsAError(authenticatedUsers)) {

//         //É um erro
//         return authenticatedUsers
//     } else {

//         //Não é um erro
//         return {
//             isValid: true,
//             statusCode: 202,
//             successMessage: 'Não foi encontrado nenhum tipo de erro.'
//         }
//     }

// }
// export { ErrorValidation }



