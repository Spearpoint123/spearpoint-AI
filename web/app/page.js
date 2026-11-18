import Home from './home-client';
const title='Spearpoint | See the market before you see a name';
const description='Spearpoint maps senior talent from its own database. Try a search, see anonymised profiles, then speak with a partner.';
export const metadata={
 title,
 description,
 alternates:{canonical:'https://ai.spearpointsearch.com/'},
 openGraph:{title,description,url:'https://ai.spearpointsearch.com/',images:[{url:'https://ai.spearpointsearch.com/hero-og.jpg',alt:'Spearpoint'}]},
 twitter:{card:'summary_large_image',images:['https://ai.spearpointsearch.com/hero-knight.webp']}
};
export default function Page(){return <Home/>;}
