/* 
    Code and logic concerning the web map on the page will reside here, Since we are
    pulling it from a CDN Leaflet will use defalut alias 'L' in global scope!.
*/

// For mockup purposes will use node module approach...
let map = L.map('map').setView([0, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);