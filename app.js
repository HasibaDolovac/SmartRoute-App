
const map = L.map('map').setView([43.72, 20.69], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);


let points    = [];
let routeLine = null;
let travelMode = 'driving'; 



function makeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;
      background:${color};
      border:2px solid #fff;
      border-radius:50%;
      box-shadow:0 0 6px ${color}88;
    "></div>`,
    iconAnchor: [7, 7]
  });
}


map.on('click', function(e) {
  addPoint(e.latlng.lat, e.latlng.lng);
});

function addPoint(lat, lng, label) {
  const isFirst = points.length === 0;
  const color   = isFirst ? '#3ecf8e' : '#4f8ef7';
  const marker  = L.marker([lat, lng], { icon: makeIcon(color) })
    .addTo(map)
    .bindPopup(label || `Tačka ${points.length + 1}`);
  points.push({ lat, lng, marker, label: label || null });
  renderPointList();
}

function renderPointList() {
  const ul = document.getElementById('pointList');
  ul.innerHTML = '';
  if (!points.length) {
    ul.innerHTML = '<li class="empty-hint">Klikni na mapu da dodaš tačku</li>';
    return;
  }
  points.forEach((p, i) => {
    const li   = document.createElement('li');
    const icon = i === 0 ? '🟢' : i === points.length - 1 ? '🔵' : '⚪';
    const name = p.label
      ? `<span style="flex:1;font-size:11px">${p.label.split(',')[0]}</span>`
      : `<span class="pt-coords">${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}</span>`;
    li.innerHTML = `
      <span>${icon}</span>
      ${name}
      <span style="cursor:pointer;color:#6b7280;font-size:13px" onclick="removePoint(${i})">✕</span>`;
    ul.appendChild(li);
  });
}

function removePoint(i) {
  map.removeLayer(points[i].marker);
  points.splice(i, 1);
  renderPointList();
}

// ── Izgradi rutu ──
function buildRoute() {
  if (points.length < 2) { alert('Dodaj bar 2 tačke!'); return; }

  const modeColor = { driving: '#4f8ef7', walking: '#3ecf8e', cycling: '#f5a623' };
  const coords    = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url       = `https://router.project-osrm.org/route/v1/${travelMode}/${coords}?overview=full&geometries=geojson`;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      const route = data.routes[0];
      if (routeLine) map.removeLayer(routeLine);
      routeLine = L.geoJSON(route.geometry, {
        style: { color: modeColor[travelMode] || '#4f8ef7', weight: 5, opacity: 0.9 }
      }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

      const km      = (route.distance / 1000).toFixed(1);
      const min     = Math.round(route.duration / 60);
      const timeStr = min >= 60 ? `${Math.floor(min/60)}h ${min%60}m` : `${min} min`;

      document.getElementById('routeDistance').textContent = `${km} km`;
      document.getElementById('routeTime').textContent     = timeStr;
      document.getElementById('routeInfo').style.display   = 'block';
    })
    .catch(() => alert('Greška pri učitavanju rute.'));
}


const WMO_CODES = {
  0:'Vedro ', 1:'Pretežno vedro ', 2:'Delimično oblačno ', 3:'Oblačno ',
  45:'Magla ', 48:'Magla sa mrazom ',
  51:'Slaba rosulja ', 53:'Rosulja ', 55:'Jaka rosulja ',
  61:'Slaba kiša ', 63:'Kiša ', 65:'Jaka kiša ',
  71:'Slabih snega ', 73:'Sneg ', 75:'Jak sneg ',
  80:'Pljuskovi ', 81:'Jak pljusak ', 82:'Olujni pljusak ',
  95:'Grmljavina ', 96:'Grmljavina sa gradom ', 99:'Jaka grmljavina ',
};

function fetchWeather() {
  if (!points.length) { alert('Dodaj bar jednu tačku da vidim prognozu!'); return; }
  const dest = points[points.length - 1];
  const url  = `https://api.open-meteo.com/v1/forecast?latitude=${dest.lat}&longitude=${dest.lng}&current=temperature_2m,relativehumidity_2m,windspeed_10m,weathercode&timezone=auto`;

  fetch(url)
    .then(r => r.json())
    .then(data => {
      const c    = data.current;
      const desc = WMO_CODES[c.weathercode] || 'Nepoznato';
      const [emoji, ...words] = desc.split(' ');
      const opis = words.join(' ');

      document.getElementById('weatherContent').innerHTML = `
        <div class="weather-main">
          <span class="weather-emoji">${emoji}</span>
          <div>
            <div class="weather-temp">${c.temperature_2m}°C</div>
            <div class="weather-desc">${opis}</div>
          </div>
        </div>
        <div class="weather-meta">
          <span> <strong>${c.relativehumidity_2m}%</strong></span>
          <span> <strong>${c.windspeed_10m} km/h</strong></span>
        </div>`;
      document.getElementById('weatherPanel').style.display = 'block';
    })
    .catch(() => alert('Greška pri učitavanju prognoze.'));
}

function locateMe() {
  if (!navigator.geolocation) { alert('Browser ne podržava geolokaciju.'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      map.setView([lat, lng], 14);
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:18px;height:18px;background:#7c5cfc;border:3px solid #fff;border-radius:50%;box-shadow:0 0 10px #7c5cfc"></div>`,
          iconAnchor: [9, 9]
        })
      }).addTo(map).bindPopup(' Moja lokacija').openPopup();
    },
    () => alert('Nije moguće dobiti lokaciju. Proveri dozvole u browseru.')
  );
}


function saveRoute() {
  if (!points.length) { alert('Nema tačaka za čuvanje!'); return; }
  const data = {
    naziv: 'SmartRoute ruta',
    mod: travelMode,
    tacke: points.map((p, i) => ({
      redosled: i + 1,
      lat: p.lat,
      lng: p.lng,
      naziv: p.label || null
    }))
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'smartroute.json';
  a.click();
}


function resetMap() {
  points.forEach(p => map.removeLayer(p.marker));
  points = [];
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  renderPointList();
  document.getElementById('routeInfo').style.display   = 'none';
  document.getElementById('weatherPanel').style.display = 'none';
  document.getElementById('routeDistance').textContent  = '—';
  document.getElementById('routeTime').textContent      = '—';
}


function searchLocation() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  const resList = document.getElementById('searchResults');
  resList.innerHTML = '<li style="color:#6b7280;font-style:italic">Pretraga...</li>';
  fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`)
    .then(r => r.json())
    .then(results => {
      resList.innerHTML = '';
      if (!results.length) { resList.innerHTML = '<li style="color:#e05c5c">Ništa nije pronađeno.</li>'; return; }
      results.forEach(r => {
        const li   = document.createElement('li');
        const name = r.display_name.split(',').slice(0, 3).join(', ');
        li.textContent = name;
        li.title       = r.display_name;
        li.onclick     = () => {
          map.setView([+r.lat, +r.lon], 14);
          addPoint(+r.lat, +r.lon, name);
          resList.innerHTML = '';
          document.getElementById('searchInput').value = '';
        };
        resList.appendChild(li);
      });
    })
    .catch(() => { resList.innerHTML = '<li style="color:#e05c5c">Greška pretrage.</li>'; });
}

document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchLocation();
});

//registracija i prijava korisnika
//osnovni layout i navigacija
