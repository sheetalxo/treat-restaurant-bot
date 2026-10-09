const http = require("http"), express = require("express"), jwt = require("jsonwebtoken");
const rows = [
 {id:"TR-1010-AAAA",phone:"919999900001",status:"PAID",total:540,fulfillment:"NEW",created_at:"2026-10-10T10:00:00Z",updated_at:"2026-10-10T10:00:00Z",
  data:{name:"Ravi",orderType:"DELIVERY",method:"ONLINE",address:"Vijaypur",lat:32.6,lng:75.1,bill:{foodSubtotal:480,packingCharges:24,deliveryCharges:30,discount:0,total:540,items:[{name:"Paneer Tikka",quantity:2,price:240,unitPrice:240,lineTotal:480}]}}},
 {id:"TR-1010-BBBB",phone:"919999900002",status:"AWAITING_PAYMENT",total:300,fulfillment:"NEW",created_at:"2026-10-10T09:00:00Z",updated_at:"2026-10-10T09:00:00Z",data:{orderType:"TAKEAWAY",bill:{items:[]}}}
];
const calls=[]; const patchBodies=[];
const mock = http.createServer((req,res)=>{
  calls.push(req.method+" "+decodeURIComponent(req.url));
  const u=new URL(req.url,"http://x"); let body="";
  req.on("data",c=>body+=c); req.on("end",()=>{
    res.setHeader("content-type","application/json");
    const id=(u.searchParams.get("id")||"").replace("eq.","");
    if(req.method==="GET"&&u.pathname.endsWith("/orders")){
      if(id) return res.end(JSON.stringify(rows.filter(r=>r.id===id).map(r=>({id:r.id,status:r.status}))));
      return res.end(JSON.stringify(rows));
    }
    if(req.method==="PATCH"){
      const r=rows.find(r=>r.id===id&&["PAID","CONFIRMED_CASH"].includes(r.status));
      if(!r) return res.end("[]");
      patchBodies.push(JSON.parse(body)); Object.assign(r,JSON.parse(body)); return res.end(JSON.stringify([r]));
    }
    res.statusCode=500;res.end("{}");
  });
});
mock.listen(0, async ()=>{
  process.env.SUPABASE_URL="http://127.0.0.1:"+mock.address().port;
  process.env.SUPABASE_SERVICE_KEY="sb_secret_test";
  process.env.OWNER_PHONE="+91 98765 43210"; process.env.OWNER_PIN="482915";
  process.env.JWT_SECRET="x".repeat(40); process.env.CORS_ORIGINS="https://ok.example";
  const app=express(); app.set("trust proxy",1); app.use("/api/owner",require("./ownerApi"));
  const srv=app.listen(0); const B="http://127.0.0.1:"+srv.address().port+"/api/owner";
  const J=(p,o={})=>fetch(B+p,{...o,headers:{"content-type":"application/json",...(o.headers||{})}}).then(async r=>({s:r.status,b:await r.json().catch(()=>null),h:r.headers}));
  const post=(p,b,t)=>J(p,{method:"POST",body:JSON.stringify(b),headers:t?{authorization:"Bearer "+t}:{}});
  const ok=(n,c,x)=>console.log((c?"PASS":"FAIL")+"  "+n+(c?"":"  -> "+JSON.stringify(x)));
  let r;
  r=await J("/orders"); ok("orders without token -> 401",r.s===401,r);
  r=await post("/login",{phone:"9876543210",pin:"000000"}); ok("wrong pin -> 401",r.s===401,r);
  r=await post("/login",{phone:"9111111111",pin:"482915"}); ok("wrong phone -> 401",r.s===401,r);
  r=await post("/login",{phone:123,pin:"482915"}); ok("non-string phone -> 400",r.s===400,r);
  r=await post("/login",{phone:"919876543210",pin:"482915"}); ok("valid login -> 200 + token",r.s===200&&!!r.b.token,r);
  const tok=r.b.token; const p=jwt.decode(tok,{complete:true});
  ok("HS256, iss, aud, 7d expiry",p.header.alg==="HS256"&&p.payload.iss==="treat-restaurant-bot"&&p.payload.aud==="treat-owner-app"&&p.payload.exp-p.payload.iat===604800,p);
  r=await J("/me",{headers:{authorization:"Bearer "+tok}}); ok("/me with token -> 200",r.s===200,r);
  const exp=jwt.sign({sub:"owner",tv:"1"},"x".repeat(40),{algorithm:"HS256",issuer:"treat-restaurant-bot",audience:"treat-owner-app",expiresIn:-10});
  r=await J("/orders",{headers:{authorization:"Bearer "+exp}}); ok("expired token -> 401 token_expired",r.s===401&&r.b.error.code==="token_expired",r);
  const wrongAud=jwt.sign({sub:"owner",tv:"1"},"x".repeat(40),{issuer:"treat-restaurant-bot",audience:"other"});
  r=await J("/orders",{headers:{authorization:"Bearer "+wrongAud}}); ok("wrong audience -> 401",r.s===401,r);
  const badSig=jwt.sign({sub:"owner",tv:"1"},"y".repeat(40),{issuer:"treat-restaurant-bot",audience:"treat-owner-app"});
  r=await J("/orders",{headers:{authorization:"Bearer "+badSig}}); ok("wrong signature -> 401",r.s===401,r);
  const none=Buffer.from('{"alg":"none"}').toString("base64url")+"."+Buffer.from('{"sub":"owner","tv":"1"}').toString("base64url")+".sig";
  r=await J("/orders",{headers:{authorization:"Bearer "+none}}); ok("alg=none -> 401",r.s===401,r);
  const H={authorization:"Bearer "+tok};
  r=await J("/orders?limit=1&sort=total&dir=asc",{headers:H}); ok("orders list formatted + pagination",r.s===200&&r.b.hasMore===true&&r.b.orders.length===1&&r.b.orders[0].items[0].name==="Paneer Tikka"&&r.b.orders[0].delivery.address==="Vijaypur"&&r.b.orders[0].customerPhone==="919999900001",r);
  ok("sort/limit reached Supabase query",calls.some(c=>c.includes("order=total.asc")&&c.includes("limit=2")),calls);
  r=await J("/orders?status=PAID;drop",{headers:H}); ok("bad status filter -> 400",r.s===400,r);
  r=await J("/orders?sort=data",{headers:H}); ok("unknown sort column ignored (falls back)",r.s===200&&calls.some(c=>c.includes("order=created_at.desc")),calls);
  r=await post("/update-order",{orderId:"TR-1010-AAAA",fulfillment:"PREPARING"},tok); ok("update PAID order -> 200",r.s===200&&r.b.order.fulfillment==="PREPARING",r);
  r=await post("/update-order",{orderId:"TR-1010-AAAA",fulfillment:"DROP TABLE"},tok); ok("bad fulfillment -> 400",r.s===400,r);
  r=await post("/update-order",{orderId:"TR-1010-AAAA",fulfillment:"READY",status:"PAID",total:1,id:"x"},tok); ok("extra body fields ignored",r.s===200&&r.b.order.total===540&&r.b.order.id==="TR-1010-AAAA",r);
  ok("PATCH body only has fulfillment+updated_at",patchBodies.length>=2&&patchBodies.every(b=>Object.keys(b).sort().join()==="fulfillment,updated_at"),patchBodies);
  r=await post("/update-order",{orderId:"TR-1010-BBBB",fulfillment:"ACCEPTED"},tok); ok("unpaid order -> 409",r.s===409,r);
  r=await post("/update-order",{orderId:"TR-NOPE-0000",fulfillment:"ACCEPTED"},tok); ok("missing order -> 404",r.s===404,r);
  r=await post("/update-order",{orderId:"../x?y=1",fulfillment:"READY"},tok); ok("bad orderId chars -> 400",r.s===400,r);
  r=await post("/update-order",{orderId:"TR-1010-AAAA",fulfillment:"READY"}); ok("update without token -> 401",r.s===401,r);
  r=await fetch(B+"/orders",{method:"OPTIONS",headers:{origin:"https://evil.example","access-control-request-method":"GET"}}); ok("CORS: unlisted origin gets no allow header",!r.headers.get("access-control-allow-origin"),[...r.headers]);
  r=await fetch(B+"/orders",{method:"OPTIONS",headers:{origin:"https://ok.example","access-control-request-method":"GET"}}); ok("CORS: listed origin allowed",r.headers.get("access-control-allow-origin")==="https://ok.example",[...r.headers]);
  // brute force: 8 per IP window, rest limited (7 failed so far above counted toward it)
  let last; for(let i=0;i<12;i++) last=await post("/login",{phone:"9876543210",pin:"11111"+i});
  ok("login brute force -> 429",last.s===429,last);
  r=await post("/login",{phone:"919876543210",pin:"482915"}); ok("even correct PIN blocked while rate-limited",r.s===429,r);
  srv.close(); mock.close();
});
