import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source=fs.readFileSync(new URL("../js/movie-reference.js",import.meta.url),"utf8");
function setup(search,fetch) {
  const context={URL,URLSearchParams,fetch,window:{WEBFLIX_API_BASE:"",location:{search,href:"http://localhost:5500/movie.html"+search},history:{replaceState(a,b,url){context.canonical=url.href}}}};
  vm.createContext(context);vm.runInContext(source,context);return context;
}
test("old unique title bookmarks resolve once and become ID links",async()=>{
  let requests=0;
  const s=setup("?t=Old%20name",async url=>{requests++;assert.equal(url,"/api/movies/by-title/Old%20name");return {ok:true,json:async()=>({_id:"507f1f77bcf86cd799439011",title:"Old name"})}});
  const [a,b]=await Promise.all([vm.runInContext("resolveMovieReference()",s),vm.runInContext("resolveMovieReference()",s)]);
  assert.equal(a._id,b._id);assert.equal(requests,1);
  assert.equal(s.canonical,"http://localhost:5500/movie.html?id=507f1f77bcf86cd799439011");
});
test("duplicate title bookmarks stop rather than choosing a movie",async()=>{
  const s=setup("?t=Duplicate",async()=>({ok:false,json:async()=>({error:"Multiple movies share this title."})}));
  await assert.rejects(vm.runInContext("resolveMovieReference()",s),/Multiple movies/);
  assert.equal(s.canonical,undefined);
});
test("ID links use the ID endpoint and reject malformed identifiers",async()=>{
  const s=setup("?id=507f1f77bcf86cd799439011",async url=>{assert.equal(url,"/api/movies/507f1f77bcf86cd799439011");return {ok:true,json:async()=>({_id:"507f1f77bcf86cd799439011",title:"Renamed movie"})}});
  await vm.runInContext("resolveMovieReference()",s);
  const bad=setup("?id=bad",()=>{throw new Error("Should not fetch")});
  await assert.rejects(vm.runInContext("resolveMovieReference()",bad),/Invalid movie link/);
});
