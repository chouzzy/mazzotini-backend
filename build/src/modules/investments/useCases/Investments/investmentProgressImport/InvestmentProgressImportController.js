"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectProgressInvestmentPartnerController = void 0;
const InvestmentRepository_1 = require("../../../repositories/implementations/InvestmentRepository");
const client_1 = require("@prisma/client");
const formidable_1 = __importDefault(require("formidable"));
const exceljs = __importStar(require("exceljs"));
const InvestmentProgressImportCheck_1 = require("./InvestmentProgressImportCheck");
const InvestmentProgressImportUseCase_1 = require("./InvestmentProgressImportUseCase");
class ProjectProgressInvestmentPartnerController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (!id) {
                    throw Error("ID ausente");
                }
                const form = (0, formidable_1.default)({});
                form.parse(req, (err, fields, files) => __awaiter(this, void 0, void 0, function* () {
                    if (err) {
                        throw err;
                    }
                    const file = files.file[0]; // Obtém o arquivo da planilha
                    const workbook = new exceljs.Workbook();
                    yield workbook.xlsx.readFile(file.filepath);
                    const worksheet = workbook.worksheets[0];
                    yield (0, InvestmentProgressImportCheck_1.checkWorksheet)(worksheet);
                    const investmentRepository = new InvestmentRepository_1.InvestmentRepository();
                    const investmentProgressImportUseCase = new InvestmentProgressImportUseCase_1.InvestmentProgressImportUseCase(investmentRepository);
                    const investment = yield investmentProgressImportUseCase.execute(worksheet, id);
                    return res.status(200).json({
                        successMessage: "Dados de progresso atualizados com sucesso!",
                        investment: investment
                    });
                }));
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientValidationError) {
                    console.log(error);
                    return res.status(401).json({
                        error: {
                            name: error.name,
                            message: error.message,
                        }
                    });
                }
                else {
                    console.log(error);
                    return res.status(401).json({ error: { name: 'CreateInvestmentsController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.ProjectProgressInvestmentPartnerController = ProjectProgressInvestmentPartnerController;
