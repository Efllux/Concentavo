import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const pkg=JSON.parse(await readFile('package.json','utf8'));
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
assert.equal(pkg.version,lock.version,'Lockfile version must match package.json');
assert.equal(pkg.version,lock.packages[''].version,'Root lock package must match');
const tag=process.env.RELEASE_TAG;
if(tag) assert.equal(tag,`v${pkg.version}`,'Release tag must match package.json');
for(const path of ['README.md','LICENSE','LICENSING.md','THIRD-PARTY-NOTICES.txt','docs/RELEASE.md','CHANGELOG.md']) {
  assert.ok((await readFile(path,'utf8')).trim(),`Missing release document: ${path}`);
}
console.log(`Release metadata valid: v${pkg.version}`);
