import { timingSafeEqual } from 'node:crypto';
export function verifyBearer(header:string|undefined,token:string|undefined,production:boolean){if(!token)return!production;if(!header?.startsWith('Bearer '))return false;const given=Buffer.from(header.slice(7));const expected=Buffer.from(token);return given.length===expected.length&&timingSafeEqual(given,expected);}
