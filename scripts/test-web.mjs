// Read-only checks against an explicitly supplied deployment. No real emails or accounts.
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL;if(!base)throw Error('Set TEST_BASE_URL to the web URL');
const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/Sức Trẻ/);
const auth=await fetch(new URL('/api/auth',base));assert.equal(auth.status,200);assert.equal((await auth.json()).user,null);
const state=await fetch(new URL('/api/state',base));assert.equal(state.status,401);
const bad=await fetch(new URL('/api/auth',base),{method:'POST',headers:{Origin:'https://invalid.example','Content-Type':'application/json'},body:JSON.stringify({action:'login'})});assert.equal(bad.status,403);
console.log('PASS: homepage, anonymous session, protected data, cross-origin rejection (4 HTTP checks).');
