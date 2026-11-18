export async function api(path,body){
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Something went wrong.');
 return data;
}
export function Shell({children,banner}){
 const note=banner||'Fictional demonstration profiles are labelled. No names are shown. Identity is not part of this view.';
 return <div className="wrap"><header className="top"><a className="brand" href="/begin">SPEARPOINT</a><nav><a href="/begin/brief">Brief</a><a href="/begin/market">Market</a><a href="/begin/search">Search</a><a href="/begin/portal">Portal</a><a href="/begin/book">Book a call</a><a href="/begin/engagement">Engagement</a></nav></header><p className="banner">{note}</p>{children}</div>;
}
export function PartnerShell({children}){
 return <div className="wrap"><header className="top"><a className="brand" href="/begin/desk">SPEARPOINT</a><nav><a href="/begin/desk">My searches</a></nav></header><p className="banner">Partner view. Samples are fictional. Nothing is sent until you confirm it.</p>{children}</div>;
}
