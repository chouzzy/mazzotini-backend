import * as core from 'express-serve-static-core';

// Este bloco "reabre" a definição do Express e força os tipos 
// a serem aceitos como strings simples, resolvendo o erro globalmente.

declare module 'express-serve-static-core' {
  interface ParamsDictionary {
    [key: string]: string;
  }
}

declare module 'express' {
  interface Request {
    params: core.ParamsDictionary;
    query: core.Query;
  }
}