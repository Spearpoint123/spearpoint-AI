import Home from './home-client';
const title='Spearpoint | Senior hiring, without the search-firm price';
const description='Hire leaders and senior talent above $150K for a fraction of the cost of an executive search firm. Software maps the market. A partner runs the approach and the close.';
export const metadata={
 title,
 description,
 alternates:{canonical:'https://ai.spearpointsearch.com/'},
 openGraph:{title,description,url:'https://ai.spearpointsearch.com/',images:[{url:'https://ai.spearpointsearch.com/hero-og.jpg',alt:'Spearpoint'}]},
 twitter:{card:'summary_large_image',images:['https://ai.spearpointsearch.com/hero-knight.webp']}
};
export default function Page(){return <Home/>;}
