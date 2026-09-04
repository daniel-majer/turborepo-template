export const isTestEnvironment = process.env.NODE_ENV === "test";

export const envFilePath = isTestEnvironment ? ".env.test" : ".env";

export const overrideEnvFile = isTestEnvironment;
