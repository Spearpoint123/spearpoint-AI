const reference=new URLSearchParams(location.search).get('profile');
if(reference&&/^SP-[A-F0-9]{16}$/.test(reference)){
 document.getElementById('consult-title').textContent='Discuss this profile.';
 const context=document.getElementById('profile-context');
 context.textContent='Your confidential profile reference: '+reference+'. Please quote this when booking so we can review the right profile together.';
 context.hidden=false;
 const subject=encodeURIComponent('Confidential profile briefing — '+reference);
 const body=encodeURIComponent('I would like to discuss confidential profile '+reference+'.');
 document.getElementById('consult-email').href='mailto:sam@spearpointsearch.com?subject='+subject+'&body='+body;
}
