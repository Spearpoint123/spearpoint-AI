import Home from './home-client';
const title='Spearpoint | See the shortlist before you see a name';
const description='For hiring leaders in capital markets, crypto, AI, payments and trading. Roles above $150k. Confidential profiles from Spearpoint’s database.';
export const metadata={
 title,
 description,
 alternates:{canonical:'https://ai.spearpointsearch.com/'},
 openGraph:{title,description,url:'https://ai.spearpointsearch.com/',images:[{url:'https://ai.spearpointsearch.com/hero-og.jpg',alt:'Spearpoint'}]},
 twitter:{card:'summary_large_image',images:['https://ai.spearpointsearch.com/hero-knight.webp']}
};
export default function Page(){return <Home/>;}
