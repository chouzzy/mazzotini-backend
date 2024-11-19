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
exports.welcomeRoutes = void 0;
const express_1 = require("express");
const welcomeRoutes = (0, express_1.Router)();
exports.welcomeRoutes = welcomeRoutes;
welcomeRoutes.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.status(200).send('Seja bem vindo ao App C2DI');
}));
