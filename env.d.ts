declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EMAIL: string;
      PASSWORD: string;
    }
  }
}

export {};
