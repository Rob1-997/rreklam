export const LOCAL_DEMO_EMAIL: string;
export function isLocalDemoConfigured(env?:NodeJS.ProcessEnv):boolean;
export function isLocalDemoEnabled(env?:NodeJS.ProcessEnv):boolean;
export function isLocalAuthRequest(request:Request):boolean;
export function demoPasswordMatches(input:unknown,secret:unknown):boolean;
