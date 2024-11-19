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
exports.ListUsersUseCase = void 0;
const userUtils_1 = require("../../../../../utils/userUtils");
class ListUsersUseCase {
    constructor(usersRepository) {
        this.usersRepository = usersRepository;
    }
    execute(filterUserData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id, name, email, cpf, username } = filterUserData;
                const data = {
                    id,
                    name,
                    email,
                    cpf,
                    username
                };
                const { page, pageRange } = yield (0, userUtils_1.validatePageParams)(filterUserData);
                const listUserFormatted = Object.assign(Object.assign({}, data), { page,
                    pageRange });
                const users = yield this.usersRepository.filterUsers(listUserFormatted);
                return users;
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.ListUsersUseCase = ListUsersUseCase;
