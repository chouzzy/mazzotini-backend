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
exports.CreateInvestorProfileController = void 0;
const CreateInvestorProfileUseCase_1 = require("./CreateInvestorProfileUseCase");
const CreateInvestorProfileCheck_1 = require("./CreateInvestorProfileCheck");
const client_1 = require("@prisma/client");
const InvestorProfileRepository_1 = require("../../../repositories/implementations/InvestorProfileRepository");
class CreateInvestorProfileController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const investorData = req.body;
                investorData.age = Number(investorData.age);
                investorData.monthlyIncome = Number(investorData.monthlyIncome);
                yield (0, CreateInvestorProfileCheck_1.checkBody)(investorData);
                /// instanciação da classe do caso de uso
                const investorProfileRepository = new InvestorProfileRepository_1.InvestorProfileRepository();
                const createUsersUseCase = new CreateInvestorProfileUseCase_1.CreateInvestorProfileUseCase(investorProfileRepository);
                const user = yield createUsersUseCase.execute(investorData);
                return res.status(200).json({
                    successMessage: "Perfil de investidor criado com sucesso!",
                    user: user
                });
            }
            catch (error) {
                console.log(error);
                if (error instanceof client_1.Prisma.PrismaClientValidationError) {
                    return res.status(401).json({
                        error: {
                            name: error.name,
                            message: error.message,
                        }
                    });
                }
                else {
                    return res.status(401).json({ error: { name: 'CreateInvestorProfileController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.CreateInvestorProfileController = CreateInvestorProfileController;
