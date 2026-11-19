const reference=new URLSearchParams(location.search).get('profile');
if(reference&&/^SP-[A-F0-9]{16}$/.test(reference)){
 document.getElementById('consult-title').textContent='Discuss this profile.';
 const context=document.getElementById('profile-context');
 context.textContent='Profile reference: '+reference;
 context.hidden=false;
 const subject=encodeURIComponent('Confidential profile briefing — '+reference);
 const body=encodeURIComponent('Please send me more information about confidential profile '+reference+'.');
 document.getElementById('consult-email').href='mailto:sam@spearpointsearch.com?subject='+subject+'&body='+body;
}
