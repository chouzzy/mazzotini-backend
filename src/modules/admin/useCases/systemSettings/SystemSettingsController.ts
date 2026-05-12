import { Request, Response } from 'express';
import { getSystemSettings, updateSystemSettings } from './SystemSettingsService';

class SystemSettingsController {
    get = async (_req: Request, res: Response): Promise<Response> => {
        try {
            const settings = await getSystemSettings();
            return res.status(200).json(settings);
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    };

    update = async (req: Request, res: Response): Promise<Response> => {
        const { autoImportAppeals, autoImportProceduralIssues } = req.body;
        const auth0UserId = req.auth?.payload?.sub as string;

        const patch: Record<string, boolean> = {};
        if (typeof autoImportAppeals === 'boolean') patch.autoImportAppeals = autoImportAppeals;
        if (typeof autoImportProceduralIssues === 'boolean') patch.autoImportProceduralIssues = autoImportProceduralIssues;

        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ error: 'Nenhum campo válido enviado.' });
        }

        try {
            const updated = await updateSystemSettings(patch, auth0UserId);
            return res.status(200).json(updated);
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    };
}

export { SystemSettingsController };
