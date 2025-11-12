// src/modules/management/useCases/testMonthlyUpdate/TestMonthlyUpdateController.ts
import { Request, Response } from 'express';
// Importa o "Contador" (o UseCase que já fizemos)
import { UpdateMonthlyIndicesUseCase } from '../../../creditAssets/useCases/updateMonthlyIndices/UpdateMonthlyIndicesUseCase';

class TestMonthlyUpdateController {

    // "Arrow function" para garantir o 'this'
    handle = async (request: Request, response: Response): Promise<Response> => {
        
        console.log("=========================================");
        console.log("ATENÇÃO: Job de atualização mensal FORÇADO via API.");
        console.log("=========================================");
        
        const useCase = new UpdateMonthlyIndicesUseCase();
        
        try {
            await useCase.execute();
            
            console.log("[Test Endpoint] Execução do UpdateMonthlyIndicesUseCase concluída.");
            return response.status(200).json({ 
                message: "Tarefa de atualização mensal executada com sucesso. Verifique os logs e o banco de dados." 
            });

        } catch (err: any) {
            console.error("[Test Endpoint] Erro ao forçar o job:", err);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { TestMonthlyUpdateController };