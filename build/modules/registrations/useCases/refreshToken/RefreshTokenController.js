"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokenController = void 0;
const RefreshTokenUseCase_1 = require("./RefreshTokenUseCase");
const RefreshTokenRepository_1 = require("../../repositories/implementations/RefreshTokenRepository");
class RefreshTokenController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const refreshToken = req.body;
            /// instanciação da classe do caso de uso
            const refreshTokenRepository = new RefreshTokenRepository_1.RefreshTokenRepository();
            const refreshTokenUseCase = new RefreshTokenUseCase_1.RefreshTokenUseCase(refreshTokenRepository);
            //NewTokens pode conter o token e/ou refreshtoken
            const newTokens = yield refreshTokenUseCase.execute(refreshToken);
            ///
            // const tokenIsValid = await ErrorValidation(newTokens)
            if (newTokens.isValid === false) {
                return res.status(newTokens.statusCode).json({
                    errorMessage: newTokens.errorMessage
                });
            }
            if (newTokens.refreshToken) {
                const { token, refreshToken } = newTokens;
                return res.status(202).json({
                    token,
                    refreshToken
                });
            }
            return res.status(202).json({
                token: newTokens.token
            });
        });
    }
}
exports.RefreshTokenController = RefreshTokenController;
