class AppError extends Error {
    public readonly statusCode: number
    /** Código estável para o frontend tratar o erro sem depender do texto da mensagem. */
    public readonly code?: string

    constructor(message: string, statusCode = 400, code?: string) {
        super(message)
        this.name = 'AppError'
        this.statusCode = statusCode
        this.code = code
    }
}

export { AppError }