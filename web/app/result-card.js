export function ResultCard({row,linked}){
 const musts=row.musts||[];
 return <article>
  <p className="origin">{row.origin||'Spearpoint network'}</p>
  <p className="score">{row.met} of {musts.length} must-haves</p>
  <ul className="ticks">{musts.map(item=><li key={item.label} className={item.met?'met':'gap'}><span aria-hidden="true">{item.met?'✓':'–'}</span> {item.met?'Met':'Gap'}: {item.label}</li>)}</ul>
  <p className="snapshot">{row.snapshot}</p>
  {row.fictional?<p className="note">Demo profile. Not a real person.</p>:row.origin==='Wider market'?<p className="note">Identity pending approval.</p>:<p className="note">Verified by Spearpoint</p>}
  {linked&&row.origin!=='Wider market'&&row.id?<a href={'/begin/candidate/?id='+row.id}>Confidential profile</a>:null}
 </article>;
}
