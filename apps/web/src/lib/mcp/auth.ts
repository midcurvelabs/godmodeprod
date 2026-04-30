import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

const TOKEN_ENV_VARS = ["MCP_TOKEN_RIK", "MCP_TOKEN_BEN", "MCP_TOKEN_LUCA"] as const;

export function verifyMcpToken(_req: Request, bearerToken?: string): AuthInfo | undefined {
  if (!bearerToken) return undefined;

  for (const envVar of TOKEN_ENV_VARS) {
    const expected = process.env[envVar];
    if (expected && expected === bearerToken) {
      const userName = envVar.replace("MCP_TOKEN_", "").toLowerCase();
      return {
        token: bearerToken,
        clientId: userName,
        scopes: ["docket:read"],
        extra: { user: userName },
      };
    }
  }

  return undefined;
}
