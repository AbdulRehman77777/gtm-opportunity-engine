import { describe,expect,it } from 'vitest';
import { verifyBearer } from '../apps/mcp/src/auth';
describe('MCP bearer authorization',()=>{it('requires a token in production and compares an exact bearer token',()=>{expect(verifyBearer(undefined,undefined,true)).toBe(false);expect(verifyBearer(undefined,undefined,false)).toBe(true);expect(verifyBearer('Bearer correct-token-value-123456','correct-token-value-123456',true)).toBe(true);expect(verifyBearer('Bearer incorrect','correct-token-value-123456',true)).toBe(false);});});
