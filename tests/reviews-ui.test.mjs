import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";

class Element {
  constructor() { this.children=[];this.listeners={};this.textContent="";this.value="";this.hidden=false;this.disabled=false;this.classList={toggle(){}}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=children; }
  addEventListener(name, handler) { this.listeners[name]=handler; }
  setAttribute() {}
  reset() {}
  focus() {}
  scrollIntoView() {}
}
function setup() {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id,new Element()); return elements.get(id); };
  const context = {
    window:{WEBFLIX_API_BASE:"",location:{search:"?t=Movie"},confirm:()=>true},
    document:{addEventListener(){},createElement(){return new Element()},getElementById:get},
    localStorage:{getItem(){return "token"}},
    fetch:async()=>({ok:true,json:async()=>({id:1,name:"Owner"})}),
    resolveMovieReference: async () => ({ _id: "507f1f77bcf86cd799439011", title: "Movie" }),
    URLSearchParams,console,Date
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL("../frontend/js/reviews.js",import.meta.url),"utf8"),context);
  return {context,get};
}

test("only the authenticated owner sees edit/delete and comments render as text",()=>{
  const s=setup();
  s.context.review={r_id:10,user_id:1,rating:4,comment:"<script>alert(1)</script>",author_name:"<Owner>",created_at:"2024-01-01"};
  const owner=vm.runInContext("renderReview(review,{id:1})",s.context);
  const other=vm.runInContext("renderReview(review,{id:2})",s.context);
  const guest=vm.runInContext("renderReview(review,null)",s.context);
  assert.equal(owner.children.length,4);
  assert.equal(other.children.length,3);
  assert.equal(guest.children.length,3);
  assert.equal(owner.children[2].textContent,"<script>alert(1)</script>");
  assert.equal(owner.children[3].children[0].textContent,"Edit");
  assert.equal(owner.children[3].children[1].textContent,"Delete");
});

test("failed edit keeps the draft and failed delete keeps the review",async()=>{
  const s=setup();
  await vm.runInContext("hookReviewForm()",s.context);
  s.context.review={r_id:10,rating:4,comment:"Original"};
  vm.runInContext("editReview(review)",s.context);
  s.get("comment").value="Unsaved draft";
  s.get("rating").value="5";
  s.context.fetch=async()=>({ok:false,status:500,json:async()=>({message:"Temporary failure"})});
  await s.get("reviewForm").listeners.submit({preventDefault(){}});
  assert.equal(s.get("comment").value,"Unsaved draft");
  assert.equal(s.get("review-submit").textContent,"Save changes");
  assert.equal(s.get("review-submit").disabled,false);
  assert.equal(s.get("review-status").textContent,"Temporary failure");
  s.get("reviews-list").children=["existing review"];
  s.context.button=new Element();
  await vm.runInContext("deleteReview(review,button)",s.context);
  assert.deepEqual(s.get("reviews-list").children,["existing review"]);
  assert.equal(s.context.button.disabled,false);
});

test("guest cannot submit and authenticated submissions carry the bearer token",async()=>{
  const guest=setup();
  guest.context.localStorage.getItem=()=>null;
  await vm.runInContext("hookReviewForm()",guest.context);
  assert.equal(guest.get("reviewForm").hidden,true);
  assert.equal(guest.get("review-login-prompt").hidden,false);
  const owner=setup();
  await vm.runInContext("hookReviewForm()",owner.context);
  let request;
  owner.context.fetch=async(url,options)=>{request={url,options};return {ok:false,status:401,json:async()=>({})}};
  owner.get("rating").value="4";owner.get("comment").value="A review.";
  await owner.get("reviewForm").listeners.submit({preventDefault(){}});
  assert.equal(request.options.headers.Authorization,"Bearer token");
  assert.equal(request.options.method,"POST");
  assert.equal(JSON.parse(request.options.body).movieId,"507f1f77bcf86cd799439011");
  assert.equal(JSON.parse(request.options.body).movieTitle,undefined);
  assert.equal(owner.get("review-status").textContent,"Your session expired. Log in again.");
});
