import {initializeGeoCountry,locateCountry} from '../server/geo-country.mjs';
await initializeGeoCountry();
const {updateDb}=await import('ip-location-api');
await updateDb();
console.log('Country database updated. Sanity lookup:',locateCountry('8.8.8.8').country||'unavailable');
