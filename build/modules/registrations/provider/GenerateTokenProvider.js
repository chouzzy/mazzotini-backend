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
exports.GenerateTokenProvider = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
class GenerateTokenProvider {
    execute(usersID) {
        return __awaiter(this, void 0, void 0, function* () {
            const privateKey = process.env.TOKEN_PRIVATE_KEY;
            const payload = JSON.stringify({
                id: usersID,
            });
            const token = (0, jsonwebtoken_1.sign)({ payload }, privateKey ? privateKey : '', {
                subject: usersID,
                expiresIn: "1d"
            });
            return token;
        });
    }
}
exports.GenerateTokenProvider = GenerateTokenProvider;
