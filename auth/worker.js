// Stateless GitHub App OAuth exchange. Scores and room data never pass through this Worker.
const json=(body,status,origin)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'}});

export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin');
    if(origin!==env.ALLOWED_ORIGIN)return new Response('Forbidden',{status:403});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}});
    if(request.method!=='POST'||new URL(request.url).pathname!=='/oauth/exchange')return json({message:'Not found'},404,origin);
    if(Number(request.headers.get('Content-Length')||0)>4096)return json({message:'Invalid request'},400,origin);
    let data;try{const raw=await request.text();if(raw.length>4096)return json({message:'Invalid request'},400,origin);data=JSON.parse(raw);}catch{return json({message:'Invalid request'},400,origin);}
    if(!/^[A-Za-z0-9_-]{10,256}$/.test(data?.code||'')||!/^[A-Za-z0-9_-]{43,128}$/.test(data?.codeVerifier||''))return json({message:'Invalid sign-in code'},400,origin);
    const body=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:data.code,redirect_uri:env.REDIRECT_URI,code_verifier:data.codeVerifier});
    let response;try{response=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body});}catch{return json({message:'GitHub is unavailable. Try again.'},502,origin);}
    const token=await response.json().catch(()=>({}));
    if(!response.ok||!token.access_token)return json({message:'GitHub could not complete sign-in. Try again.'},400,origin);
    return json({token:token.access_token,expiresIn:token.expires_in||28800},200,origin);
  }
};
