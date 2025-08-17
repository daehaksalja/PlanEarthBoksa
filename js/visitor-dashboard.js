// Visitor Dashboard Logic (Cloudflare Workers + GA4 연동 버전)
// - 데이터 원천: https://planearth-ga.jmlee710000.workers.dev
// - 일단 "방문자" 지표는 GA4 activeUsers 사용.
//   pageviews(=screenPageViews)로 보고 싶으면 fetchDailyData()의 매핑만 바꾸면 돼.

const BASE = 'https://planearth-ga.jmlee710000.workers.dev';

/* utils */
function formatDate(d){ return d.toISOString().slice(0,10); }
function sum(arr){ return arr.reduce((a,b)=>a+b,0); }
function avg(arr){ return arr.length? sum(arr)/arr.length : 0; }
function percentChange(a,b){ if(!b) return 0; return (a-b)/b*100; }
function classifyPct(p){ if (p > 10) return 'good'; if (p < -10) return 'bad'; return 'mid'; }

/* === API 호출 함수들 === */

/* (옵션) 목업: API 실패시 폴백 */
function generateMock(){
  const today = new Date();
  const data = [];
  for(let i=0;i<120;i++){
    const date = new Date(today); date.setDate(today.getDate()-i);
    const base = 180 + Math.sin(i/5)*40;
    const noise = Math.random()*60 - 30;
    const value = Math.max(10, Math.round(base + noise));
    data.push({ date: formatDate(date), count: value });
  }
  return data.reverse();
}

/* === 실제 GA4 일별 데이터 가져오기 ===
   /ga/daily?days=365 -> {ok, rows: [{date, users, pageviews}, ...]}
   여기서 "방문자" 카드/차트는 users로 매핑 */
async function fetchDailyData(days=365){
  try{
    const r = await fetch(`${BASE}/ga/daily?days=${days}`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    // 👇 users(방문자) 기준으로 매핑. pageviews 쓰고 싶으면 row.pageviews로 변경.
    return (data.rows || []).map(row => ({
      date: row.date,
      count: Number(row.users || 0)
    }));
  }catch(e){
    console.warn('GA fetch failed, using mock:', e);
    return generateMock();
  }
}

/* 상세 지역 데이터 */
async function fetchRegionsData(){
  try{
    const r = await fetch(`${BASE}/ga/regions?limit=20`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    return data.ok ? data.rows : [];
  }catch(e){
    console.warn('Regions fetch failed:', e);
    return [];
  }
}

/* 페이지별 상세 데이터 */
async function fetchPagesDetailData(){
  try{
    const r = await fetch(`${BASE}/ga/pages-detail?limit=30`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    return data.ok ? data.rows : [];
  }catch(e){
    console.warn('Pages detail fetch failed:', e);
    return [];
  }
}

/* 유입 채널 상세 데이터 */
async function fetchChannelsData(){
  try{
    const r = await fetch(`${BASE}/ga/channels`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    return data.ok ? data.rows : [];
  }catch(e){
    console.warn('Channels fetch failed:', e);
    return [];
  }
}

/* 언어별 방문자 데이터 */
async function fetchLanguagesData(){
  try{
    const r = await fetch(`${BASE}/ga/languages`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    return data.ok ? data.rows : [];
  }catch(e){
    console.warn('Languages fetch failed:', e);
    return [
      { language: 'ko-kr', users: 180, pageviews: 350 },
      { language: 'en-us', users: 25, pageviews: 45 },
      { language: 'ja-jp', users: 8, pageviews: 15 }
    ];
  }
}

/* 대륙별 분석 데이터 */
async function fetchContinentsData(){
  try{
    const r = await fetch(`${BASE}/ga/continents`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    return data.ok ? data.rows : [];
  }catch(e){
    console.warn('Continents fetch failed:', e);
    return [
      { continent: 'Asia', country: 'South Korea', users: 180, pageviews: 350, avgDuration: 240 },
      { continent: 'North America', country: 'United States', users: 25, pageviews: 45, avgDuration: 180 },
      { continent: 'Europe', country: 'Germany', users: 8, pageviews: 15, avgDuration: 200 }
    ];
  }
}

/* 시간대별 지역 트래픽 데이터 */
async function fetchTimezoneRegionsData(){
  try{
    const r = await fetch(`${BASE}/ga/timezone-regions`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    return data.ok ? data.rows : [];
  }catch(e){
    console.warn('Timezone regions fetch failed:', e);
    return [];
  }
}
async function fetchDevicesData(){
  try{
    const r = await fetch(`${BASE}/ga/devices`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    return data.rows || [];
  }catch(e){
    console.warn('Devices fetch failed:', e);
    return [
      { device: 'mobile', users: 150 },
      { device: 'desktop', users: 120 },
      { device: 'tablet', users: 30 }
    ];
  }
}

/* 국가별 데이터 (시/군/구 포함) */
async function fetchCountriesData(){
  try{
    const r = await fetch(`${BASE}/ga/countries?limit=15`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    return data.rows || [];
  }catch(e){
    console.warn('Countries fetch failed:', e);
    return [
      { country: 'South Korea', region: 'Seoul', city: 'Gangnam-gu', users: 200, pageviews: 400 },
      { country: 'South Korea', region: 'Gyeonggi-do', city: 'Suwon', users: 150, pageviews: 300 },
      { country: 'United States', region: 'California', city: 'Los Angeles', users: 50, pageviews: 100 }
    ];
  }
}

/* 브라우저별 데이터 */
async function fetchBrowsersData(){
  try{
    const r = await fetch(`${BASE}/ga/browsers`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    return data.rows || [];
  }catch(e){
    console.warn('Browsers fetch failed:', e);
    return [
      { browser: 'Chrome', users: 180 },
      { browser: 'Safari', users: 60 },
      { browser: 'Firefox', users: 40 }
    ];
  }
}

/* 신규 vs 재방문자 데이터 */
async function fetchUserTypesData(){
  try{
    const r = await fetch(`${BASE}/ga/user-types`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    return data;
  }catch(e){
    console.warn('User types fetch failed:', e);
    return { newUsers: 150, returningUsers: 100, totalUsers: 250, newUserPercent: 60 };
  }
}

/* 시간대별 데이터 */
async function fetchHourlyData(){
  try{
    const r = await fetch(`${BASE}/ga/hourly`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    return data.rows || [];
  }catch(e){
    console.warn('Hourly fetch failed:', e);
    const mock = [];
    for(let h = 0; h < 24; h++){
      mock.push({ hour: h, users: Math.floor(Math.random() * 50) + 10 });
    }
    return mock;
  }
}

/* 트래픽 소스 데이터 */
async function fetchTrafficSources(){
  try{
    const r = await fetch(`${BASE}/ga/sources?limit=10`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    return data.rows || [];
  }catch(e){
    console.warn('Traffic sources fetch failed:', e);
    return [
      { source: 'google / organic', users: 120, pageviews: 300 },
      { source: 'direct / (none)', users: 80, pageviews: 200 },
      { source: 'naver / organic', users: 40, pageviews: 100 }
    ];
  }
}

/* 인기 페이지 데이터 (상세 정보 포함) */
async function fetchPopularPages(){
  try{
    const r = await fetch(`${BASE}/ga/pages-detail?limit=20`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    return data.rows || [];
  }catch(e){
    console.warn('Popular pages fetch failed:', e);
    return [
      { path: '/', title: 'Home', views: 150, users: 120, avgDuration: 45, bounceRate: 35, engagement: 65 },
      { path: '/works.html', title: 'Works', views: 80, users: 65, avgDuration: 120, bounceRate: 25, engagement: 75 },
      { path: '/workshop.html', title: 'Workshop', views: 60, users: 50, avgDuration: 90, bounceRate: 30, engagement: 70 }
    ];
  }
}

/* 성능 지표 데이터 */
async function fetchPerformanceData(){
  try{
    const r = await fetch(`${BASE}/ga/performance`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    return data;
  }catch(e){
    console.warn('Performance fetch failed:', e);
    return { 
      avgSessionDuration: 180, 
      bounceRate: 65, 
      pagesPerSession: 2.3 
    };
  }
}

/* 실시간 데이터 */
async function fetchRealtimeData(){
  try{
    console.log('🔴 실시간 데이터 요청 중...');
    const r = await fetch(`${BASE}/ga/realtime`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    console.log('🔴 실시간 API 응답:', data);
    
    if(!data.ok) throw new Error(data.error || 'GA error');
    
    const activeUsers = data.activeUsers || 0;
    console.log('🔴 실시간 활성 사용자:', activeUsers);
    
    // 실시간 데이터가 0이면 현재 방문자 수를 1로 설정 (본인)
    return activeUsers > 0 ? activeUsers : 1;
  }catch(e){
    console.warn('Realtime fetch failed:', e);
    // 본인이 지금 접속해 있으니 최소 1명
    return 1;
  }
}

/* 테이블 렌더링 */
function renderTable(rows){
  const tbody = document.querySelector('#rawTable tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  const descending = [...rows].sort((a,b)=> b.date.localeCompare(a.date));
  descending.forEach((r, i)=>{
    const recentSlice = descending.slice(i, i+7); // 현재 행 포함 이후 7일 (원래 역순이므로)
    const sevenAvg = avg(recentSlice.map(s=>s.count));
    const ratio = sevenAvg ? ((r.count/sevenAvg)-1)*100 : 0;
    const cls = classifyPct(ratio);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.date}</td><td>${r.count}</td><td class="${cls}">${ratio.toFixed(1)}%</td>`;
    tbody.appendChild(tr);
  });
}

/* DOM 헬퍼 */
function setMetric(id,val){ const el=document.getElementById(id); if(el) el.textContent = val; }
function setText(id,val){ const el=document.getElementById(id); if(el) el.textContent = val; }

/* 차트 */
let chartDaily, chartWeekly, chartMonthly, chartDevices, chartBrowsers, chartUserTypes, chartHourly;

/* 새로운 차트 렌더링 함수들 */
function buildDevicesChart(ctx, devices){
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: devices.map(d => d.device),
      datasets: [{
        data: devices.map(d => d.users),
        backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'],
        borderColor: '#061e17',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          labels: { color: '#9fffe2', font: { size: 11 } },
          position: 'bottom'
        }
      }
    }
  });
}

function renderCountriesList(countries) {
  const container = document.getElementById('countriesList');
  container.innerHTML = countries.slice(0, 12).map(country => `
    <div class="country-item detailed">
      <div class="location-info">
        <span class="country-name">${country.country}</span>
        ${country.region && country.region !== 'unknown' ? `<span class="region-name">${country.region}</span>` : ''}
        ${country.city && country.city !== 'unknown' ? `<span class="city-name">${country.city}</span>` : ''}
      </div>
      <div class="country-stats">
        <span class="country-users">${country.users.toLocaleString()}명</span>
        ${country.pageviews ? `<span class="country-views">${country.pageviews.toLocaleString()}뷰</span>` : ''}
      </div>
    </div>
  `).join('');
}

function renderTrafficSources(sources) {
  const container = document.getElementById('trafficSources');
  container.innerHTML = sources.slice(0, 8).map(source => `
    <div class="source-item">
      <span class="source-name">${source.source}</span>
      <span class="source-users">${source.users.toLocaleString()}</span>
    </div>
  `).join('');
}

function renderPopularPages(pages) {
  const container = document.getElementById('popularPages');
  container.innerHTML = pages.slice(0, 12).map(page => `
    <div class="page-item detailed">
      <div class="page-info">
        <span class="page-path">${page.path}</span>
        ${page.title && page.title !== 'Untitled' ? `<span class="page-title">${page.title}</span>` : ''}
      </div>
      <div class="page-stats">
        <span class="page-views">${page.views.toLocaleString()}뷰</span>
        ${page.users ? `<span class="page-users">${page.users.toLocaleString()}명</span>` : ''}
        ${page.avgDuration ? `<span class="page-duration">${Math.round(page.avgDuration)}초</span>` : ''}
        ${page.bounceRate ? `<span class="page-bounce ${page.bounceRate > 70 ? 'high' : page.bounceRate < 30 ? 'low' : 'mid'}">${page.bounceRate}%</span>` : ''}
      </div>
    </div>
  `).join('');
}

function renderPerformanceMetrics(perf) {
  const dur = typeof perf.avgSessionDuration === 'number' ? perf.avgSessionDuration : 0;
  const mm = Math.floor(dur / 60);
  const ss = String(Math.round(dur % 60)).padStart(2, '0');
  document.getElementById('avgSessionDuration').textContent = `${mm}:${ss}`;

  let br = perf.bounceRate;
  if (typeof br === 'number') {
    if (br <= 1) br = br * 100; // 비율을 %로 변환
    br = Math.min(100, Math.max(0, br));
    document.getElementById('bounceRate').textContent = br.toFixed(1) + '%';
  } else {
    document.getElementById('bounceRate').textContent = '-';
  }

  let pps = perf.pagesPerSession;
  if (pps !== undefined && pps !== null && !isNaN(parseFloat(pps))) {
    document.getElementById('pagesPerSession').textContent = parseFloat(pps).toFixed(1);
  } else {
    document.getElementById('pagesPerSession').textContent = '-';
  }
}

// 새로운 렌더링 함수들
function renderLanguagesList(languages) {
  const container = document.getElementById('languagesList');
  if (!container) return;
  
  container.innerHTML = languages.slice(0, 8).map(lang => `
    <div class="language-item">
      <div class="language-info">
        <span class="language-name">${getLanguageName(lang.language)}</span>
        <span class="language-code">${lang.language}</span>
      </div>
      <div class="language-stats">
        <span class="language-users">${lang.users.toLocaleString()}명</span>
        <span class="language-views">${lang.pageviews.toLocaleString()}뷰</span>
      </div>
    </div>
  `).join('');
}

function renderContinentsList(continents) {
  const container = document.getElementById('continentsList');
  if (!countries || !countries.length) {
    container.innerHTML = '<div class="empty-msg">지역 데이터 없음</div>';
    return;
  }
  // 동일 country+region+city 합산 및 중복 제거
  const map = new Map();
  countries.forEach(c => {
    const key = `${c.country}|${c.region}|${c.city}`;
    if (!map.has(key)) map.set(key, { ...c });
    else {
      const ref = map.get(key);
      ref.users += c.users || 0;
      ref.pageviews += c.pageviews || 0;
    }
  });
  const merged = Array.from(map.values())
    .sort((a,b)=>b.users-a.users)
    .slice(0,12);
  container.innerHTML = merged.map(country => `
    <div class="country-item detailed">
      <div class="location-info">
        <span class="country-name">${country.country}</span>
        ${country.region && country.region !== 'unknown' ? `<span class="region-name">${country.region}</span>` : ''}
        ${country.city && country.city !== 'unknown' ? `<span class="city-name">${country.city}</span>` : ''}
      </div>
      <div class="country-stats">
        <span class="country-users">${country.users.toLocaleString()}명</span>
        ${country.pageviews ? `<span class="country-views">${country.pageviews.toLocaleString()}뷰</span>` : ''}
      </div>
    </div>`).join('');
}

function renderTimezoneRegionsChart(ctx, timezoneData) {
  if (!timezoneData.length) return;
  
  // 시간대별로 그룹화
  const hourlyData = Array(24).fill(0);
  timezoneData.forEach(item => {
    hourlyData[item.hour] += item.users;
  });
  
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({length: 24}, (_, i) => `${i}시`),
      datasets: [{
        label: '시간대별 글로벌 방문자',
        data: hourlyData,
        borderColor: '#FF6B6B',
        backgroundColor: '#FF6B6B22',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#7fe4bf', font: { size: 9 } }, grid: { color: '#0f3d2d' } },
        y: { ticks: { color: '#7fe4bf', font: { size: 9 } }, grid: { color: '#0f3d2d' } }
      },
      plugins: { legend: { labels: { color: '#9fffe2', font: { size: 10 } } } }
    }
  });
}

// 헬퍼 함수들
function getLanguageName(code) {
  const languages = {
    'ko': '한국어', 'ko-kr': '한국어',
    'en': 'English', 'en-us': 'English (US)', 'en-gb': 'English (UK)',
    'ja': '日本語', 'ja-jp': '日本語',
    'zh': '中文', 'zh-cn': '中文 (简体)', 'zh-tw': '中文 (繁體)',
    'es': 'Español', 'fr': 'Français', 'de': 'Deutsch', 'it': 'Italiano'
  };
  return languages[code] || code;
}

function getContinentEmoji(continent) {
  const emojis = {
    'Asia': '🌏', 'Europe': '🌍', 'North America': '🌎', 
    'South America': '🌎', 'Africa': '🌍', 'Oceania': '🌏', 'Antarctica': '🐧'
  };
  return emojis[continent] || '🌐';
}

function buildBrowsersChart(ctx, browsers){
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: browsers.map(b => b.browser),
      datasets: [{
        label: '방문자',
        data: browsers.map(b => b.users),
        backgroundColor: ['#FF6B6B88', '#4ECDC488', '#45B7D188', '#96CEB488', '#FECA5788'],
        borderColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57'],
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: { ticks: { color: '#7fe4bf', font: { size: 10 } }, grid: { color: '#0f3d2d' } },
        y: { ticks: { color: '#7fe4bf', font: { size: 10 } }, grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function buildUserTypesChart(ctx, userTypes){
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['신규 방문자', '재방문자'],
      datasets: [{
        data: [userTypes.newUsers, userTypes.returningUsers],
        backgroundColor: ['#00ff9c', '#7fffd1'],
        borderColor: '#061e17',
        borderWidth: 2
      }]
    },
    options: {
      plugins: {
        legend: { 
          labels: { color: '#9fffe2' },
          position: 'bottom'
        }
      }
    }
  });
}

function buildHourlyChart(ctx, hourly){
  // 24시간 데이터 보장
  const hours = Array.from({length: 24}, (_, i) => {
    const found = hourly.find(h => h.hour === i);
    return found ? found.users : 0;
  });

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({length: 24}, (_, i) => `${i}시`),
      datasets: [{
        label: '시간대별 방문자',
        data: hours,
        borderColor: '#00ff9c',
        backgroundColor: '#00ff9c22',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      scales: {
        x: { ticks: { color: '#7fe4bf' }, grid: { display: false } },
        y: { ticks: { color: '#7fe4bf' }, grid: { color: '#0f3d2d' } }
      },
      plugins: { legend: { labels: { color: '#9fffe2' } } }
    }
  });
}

function buildDailyChart(ctx, rows){
  const last = rows.slice(-14);
  return new Chart(ctx, {
    type:'bar',
    data:{
      labels:last.map(r=>r.date.slice(5)),
      datasets:[{
        label:'일일 방문',
        data:last.map(r=>r.count),
        backgroundColor:'#00ff9c55',
        borderColor:'#00ff9c',
        borderWidth:1.5,
        borderRadius:4,
      }]
    },
    options:{
      scales:{
        x:{ ticks:{ color:'#7fe4bf' }, grid:{ display:false } },
        y:{ ticks:{ color:'#7fe4bf' }, grid:{ color:'#0f3d2d' } }
      },
      plugins:{ legend:{ labels:{ color:'#9fffe2' } } }
    }
  });
}

function buildWeeklyChart(ctx, rows){
  // 간단히 뒤에서부터 7일 묶음
  const weeks=[]; let tmp=[];
  for(let i=0;i<rows.length;i++){
    tmp.push(rows[i]);
    if(tmp.length===7){ weeks.push(tmp); tmp=[]; }
  }
  if(tmp.length) weeks.push(tmp);
  const last12 = weeks.slice(-12);
  const labels = last12.map(w=> w[0].date.slice(5)+'~'+w[w.length-1].date.slice(5));
  const values = last12.map(w=> sum(w.map(r=>r.count)) );
  return new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[{
        label:'주간 합계',
        data:values,
        borderColor:'#00ffc3',
        backgroundColor:'#00ffc322',
        tension:.25,
        fill:true
      }]
    },
    options:{
      scales:{ x:{ ticks:{ color:'#7fe4bf' } }, y:{ ticks:{ color:'#7fe4bf' }, grid:{ color:'#0f3d2d' } } },
      plugins:{ legend:{ labels:{ color:'#9fffe2' } } }
    }
  });
}

function buildMonthlyChart(ctx, rows){
  const groups = {};
  rows.forEach(r=>{ const m=r.date.slice(0,7); groups[m]=(groups[m]||0)+r.count; });
  const months = Object.keys(groups).sort().slice(-12);
  const values = months.map(m=>groups[m]);
  return new Chart(ctx, {
    type:'bar',
    data:{
      labels:months.map(m=>m.slice(2)),
      datasets:[{
        label:'월간 합계',
        data:values,
  backgroundColor:'#009cffa8',
  borderColor:'#00aaff',
  borderWidth:1,
  borderRadius:2,
  maxBarThickness:18,
  categoryPercentage:0.55,
  barPercentage:0.7
      }]
    },
    options:{
      scales:{ x:{ ticks:{ color:'#7fe4bf' } }, y:{ ticks:{ color:'#7fe4bf' }, grid:{ color:'#0f3d2d' } } },
      plugins:{ legend:{ labels:{ color:'#9fffe2' } } }
    }
  });
}

/* 엔트리 */
async function init(){
  // 병렬로 모든 데이터 가져오기 (1년치 데이터로 총 누적 정확히 계산)
  const [rows, devices, countries, browsers, userTypes, hourly, pages, performance, realtime, regions, channels, languages, continents, timezoneRegions] = await Promise.all([
    fetchDailyData(365), // 1년치 데이터로 변경
    fetchDevicesData(),
    fetchCountriesData(),
    fetchBrowsersData(),
    fetchUserTypesData(),
    fetchHourlyData(),
    fetchPopularPages(),
    fetchPerformanceData(),
    fetchRealtimeData(),
    fetchRegionsData(),
    fetchChannelsData(),
    fetchLanguagesData(),
    fetchContinentsData(),
    fetchTimezoneRegionsData()
  ]);

  if(!rows.length) return;

  // 실시간 데이터
  setMetric('realtimeCount', realtime.toLocaleString());

  // 카드 지표
  const today = rows[rows.length-1] || {count:0};
  const yesterday = rows[rows.length-2] || {count:0};
  setMetric('todayCount', today.count.toLocaleString());
  setMetric('yesterdayCount', yesterday.count.toLocaleString());
  setText('todayChange', `${percentChange(today.count, yesterday.count).toFixed(1)}% vs 어제`);
  setText('yesterdayShare', (today.count? (yesterday.count/today.count*100):0).toFixed(1)+'% of 오늘');

  const last7 = rows.slice(-7), last30 = rows.slice(-30);
  setMetric('weekCount', sum(last7.map(r=>r.count)).toLocaleString());
  setText('weekAvg', '평균 '+Math.round(avg(last7.map(r=>r.count))).toLocaleString());
  setMetric('monthCount', sum(last30.map(r=>r.count)).toLocaleString());
  setText('monthAvg', '평균 '+Math.round(avg(last30.map(r=>r.count))).toLocaleString());
  setMetric('totalCount', sum(rows.map(r=>r.count)).toLocaleString());
  setText('firstDate', `전체 기간: ${rows[0].date} ~ ${rows[rows.length-1].date}`);

  // 성능 지표
  renderPerformanceMetrics(performance);
  // 신규 방문자 비율도 성능 지표에 추가
  document.getElementById('newUserPercent').textContent = userTypes.newUserPercent ? `${userTypes.newUserPercent}%` : '-';

  // 테이블 & 기존 차트
  renderTable(rows.slice(-90));
  chartDaily = buildDailyChart(document.getElementById('chartDaily'), rows);
  chartWeekly = buildWeeklyChart(document.getElementById('chartWeekly'), rows);
  chartMonthly = buildMonthlyChart(document.getElementById('chartMonthly'), rows);

  // 새로운 분석 차트들과 리스트들
  chartDevices = buildDevicesChart(document.getElementById('chartDevices'), devices);
  renderCountriesList(countries);
  renderPopularPages(pages);
  chartBrowsers = buildBrowsersChart(document.getElementById('chartBrowsers'), browsers);
  chartUserTypes = buildUserTypesChart(document.getElementById('chartUserTypes'), userTypes);
  chartHourly = buildHourlyChart(document.getElementById('chartHourly'), hourly);
  
  // 새로운 기능들 렌더링
  renderLanguagesAnalysis(languages);
  renderContinentsAnalysis(continents);
  renderTimezoneRegionsAnalysis(timezoneRegions);
  
  // 실시간 맵 렌더링 (지역 데이터 활용)
  if (regions && regions.length > 0) {
    renderRealtimeMap(regions.slice(0, 10));
  }
  
  // 추가 데이터 로깅
  if (regions && regions.length > 0) {
    console.log('🌍 상세 지역 정보 (총 ' + regions.length + '개):', regions.slice(0, 5));
  }
  if (channels && channels.length > 0) {
    console.log('📢 유입 채널 정보 (총 ' + channels.length + '개):', channels.slice(0, 5));
  }
  if (languages && languages.length > 0) {
    console.log('🗣️ 언어별 정보 (총 ' + languages.length + '개):', languages.slice(0, 5));
  }
  if (continents && continents.length > 0) {
    console.log('🌏 대륙별 정보 (총 ' + continents.length + '개):', continents.slice(0, 5));
  }

  // 실시간 데이터 주기적 업데이트 (30초마다)
  startRealtimeUpdates();
}

/* 실시간 데이터 주기적 업데이트 */
function startRealtimeUpdates(){
  setInterval(async () => {
    try {
      const realtimeUsers = await fetchRealtimeData();
      setMetric('realtimeCount', realtimeUsers.toLocaleString());
      
      // 실시간 카드에 펄스 효과 추가
      const realtimeCard = document.getElementById('card-realtime');
      if(realtimeCard) {
        realtimeCard.style.transform = 'scale(1.02)';
        setTimeout(() => {
          realtimeCard.style.transform = 'scale(1)';
        }, 200);
      }
    } catch (e) {
      console.warn('실시간 업데이트 실패:', e);
    }
  }, 30000); // 30초마다 업데이트
}

// 실시간 트래픽 알림 시스템
let previousRealtimeCount = 0;
let trafficHistory = [];

function updateTrafficAlerts(currentCount) {
  const container = document.getElementById('trafficAlerts');
  if (!container) return;
  
  trafficHistory.push({ count: currentCount, time: new Date() });
  if (trafficHistory.length > 10) trafficHistory.shift();
  
  let alertType = 'normal';
  let alertText = '트래픽 정상';
  let alertIcon = '✅';
  
  if (currentCount > previousRealtimeCount * 2 && currentCount > 5) {
    alertType = 'warning';
    alertText = `트래픽 급증 감지 (${previousRealtimeCount} → ${currentCount})`;
    alertIcon = '⚠️';
  } else if (currentCount === 0 && previousRealtimeCount > 0) {
    alertType = 'danger';
    alertText = '실시간 방문자 없음';
    alertIcon = '🚨';
  } else if (currentCount > 0) {
    alertText = `현재 ${currentCount}명 접속 중`;
    alertIcon = '✅';
  }
  
  const timeStr = new Date().toLocaleTimeString('ko-KR', { 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });
  
  const alertHTML = `
    <div class="alert-item ${alertType}">
      <span class="alert-icon">${alertIcon}</span>
      <span class="alert-text">${alertText}</span>
      <span class="alert-time">${timeStr}</span>
    </div>
  `;
  
  container.insertAdjacentHTML('afterbegin', alertHTML);
  
  // 최대 5개 알림만 유지
  const alerts = container.querySelectorAll('.alert-item');
  if (alerts.length > 5) {
    alerts[alerts.length - 1].remove();
  }
  
  previousRealtimeCount = currentCount;
}

// 주간/월간 리포트 생성
function generateWeeklyReport(dailyData) {
  const last7Days = dailyData.slice(-7);
  const totalVisitors = last7Days.reduce((sum, day) => sum + day.count, 0);
  const avgDaily = Math.round(totalVisitors / 7);
  const bestDay = last7Days.reduce((max, day) => day.count > max.count ? day : max);
  
  return {
    period: '지난 7일',
    totalVisitors,
    avgDaily,
    bestDay: `${bestDay.date} (${bestDay.count}명)`,
    trend: last7Days[6].count > last7Days[0].count ? '상승' : '하락'
  };
}

// 언어별 데이터 가져오기
async function fetchLanguagesData() {
  try {
    const r = await fetch(`${BASE}/ga/languages?limit=10`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'GA error');
    return data.rows || [];
  } catch (e) {
    console.warn('Languages fetch failed:', e);
    return [
      { language: 'ko', languageName: '한국어', users: 150, sessions: 280 },
      { language: 'en', languageName: '영어', users: 45, sessions: 78 },
      { language: 'ja', languageName: '일본어', users: 12, sessions: 20 },
      { language: 'zh', languageName: '중국어', users: 8, sessions: 15 }
    ];
  }
}

// 대륙별 데이터 가져오기
async function fetchContinentsData() {
  try {
    const r = await fetch(`${BASE}/ga/continents?limit=10`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'GA error');
    return data.rows || [];
  } catch (e) {
    console.warn('Continents fetch failed:', e);
    return [
      { continent: 'Asia', users: 180, sessions: 320, countries: ['South Korea', 'Japan', 'China'] },
      { continent: 'North America', users: 25, sessions: 45, countries: ['United States', 'Canada'] },
      { continent: 'Europe', users: 15, sessions: 28, countries: ['Germany', 'France', 'United Kingdom'] }
    ];
  }
}

// 시간대별 지역 데이터 가져오기
async function fetchTimezoneRegionsData() {
  try {
    const r = await fetch(`${BASE}/ga/timezone-regions?limit=10`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'GA error');
    return data.rows || [];
  } catch (e) {
    console.warn('Timezone regions fetch failed:', e);
    return [
      { timezone: 'Asia/Seoul', region: '서울', users: 120, sessions: 220 },
      { timezone: 'Asia/Tokyo', region: '도쿄', users: 15, sessions: 28 },
      { timezone: 'America/New_York', region: '뉴욕', users: 12, sessions: 20 },
      { timezone: 'Europe/London', region: '런던', users: 8, sessions: 15 }
    ];
  }
}

// 언어 이모지 맵핑
const languageEmojis = {
  'ko': '🇰🇷', 'en': '🇺🇸', 'ja': '🇯🇵', 'zh': '🇨🇳', 'fr': '🇫🇷', 
  'de': '🇩🇪', 'es': '🇪🇸', 'pt': '🇵🇹', 'ru': '🇷🇺', 'it': '🇮🇹'
};

// 언어별 분석 렌더링
function renderLanguagesAnalysis(languages) {
  const container = document.getElementById('languagesAnalysis');
  if (!container) return;
  if (!languages || !languages.length) {
    container.innerHTML = '<div class="empty-msg">언어 데이터 없음</div>';
    return;
  }
  
  const total = languages.reduce((sum, lang) => sum + lang.users, 0);
  
  let html = `
    <h3>🌐 언어별 분석</h3>
    <div class="languages-grid">
  `;
  
  languages.forEach(lang => {
    const percentage = ((lang.users / total) * 100).toFixed(1);
    const emoji = languageEmojis[lang.language] || '🌍';
    
    html += `
      <div class="language-item">
        <div class="language-header">
          <span class="language-emoji">${emoji}</span>
          <span class="language-name">${lang.languageName}</span>
          <span class="language-percent">${percentage}%</span>
        </div>
        <div class="language-stats">
          <span>사용자: ${lang.users.toLocaleString()}</span>
          <span>세션: ${lang.sessions.toLocaleString()}</span>
        </div>
        <div class="language-bar">
          <div class="language-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// 대륙별 분석 렌더링
function renderContinentsAnalysis(continents) {
  const container = document.getElementById('continentsAnalysis');
  if (!container) return;
  if (!continents || !continents.length) {
    container.innerHTML = '<div class="empty-msg">대륙 데이터 없음</div>';
    return;
  }
  
  const total = continents.reduce((sum, cont) => sum + cont.users, 0);
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3'];
  
  let html = `
    <h3>🌍 대륙별 분석</h3>
    <div class="continents-grid">
  `;
  
  continents.forEach((cont, index) => {
    const percentage = ((cont.users / total) * 100).toFixed(1);
    const color = colors[index % colors.length];
    
    html += `
      <div class="continent-item">
        <div class="continent-header">
          <span class="continent-name">${cont.continent}</span>
          <span class="continent-percent">${percentage}%</span>
        </div>
        <div class="continent-stats">
          <span>사용자: ${cont.users.toLocaleString()}</span>
          <span>세션: ${cont.sessions.toLocaleString()}</span>
        </div>
        <div class="continent-countries">
          국가: ${cont.countries ? cont.countries.slice(0, 3).join(', ') : 'N/A'}
        </div>
        <div class="continent-bar">
          <div class="continent-fill" style="width: ${percentage}%; background-color: ${color}"></div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// 시간대 지역 분석 렌더링
function renderTimezoneRegionsAnalysis(regions) {
  const container = document.getElementById('timezoneRegionsAnalysis');
  if (!container) return;
  if (!regions || !regions.length) {
    container.innerHTML = '<div class="empty-msg">시간대 데이터 없음</div>';
    return;
  }
  
  const total = regions.reduce((sum, region) => sum + region.users, 0);
  
  let html = `
    <h3>⏰ 시간대별 지역 분석</h3>
    <div class="timezone-grid">
  `;
  
  regions.forEach(region => {
    const percentage = ((region.users / total) * 100).toFixed(1);
    const currentTime = new Date().toLocaleString('ko-KR', { 
      timeZone: region.timezone,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    html += `
      <div class="timezone-item">
        <div class="timezone-header">
          <span class="timezone-region">${region.region}</span>
          <span class="timezone-time">${currentTime}</span>
        </div>
        <div class="timezone-stats">
          <span>사용자: ${region.users.toLocaleString()}</span>
          <span>세션: ${region.sessions.toLocaleString()}</span>
          <span>비율: ${percentage}%</span>
        </div>
        <div class="timezone-bar">
          <div class="timezone-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// 실시간 맵 렌더링 (간단한 텍스트 버전)
function renderRealtimeMap(geoData) {
  const container = document.getElementById('realtimeMap');
  if (!container) return;
  
  let html = `
    <h3>🗺️ 실시간 방문자 지도</h3>
    <div class="realtime-locations">
  `;
  
  geoData.forEach(location => {
    const flag = getCountryFlag(location.country);
    
    html += `
      <div class="location-dot">
        <span class="location-flag">${flag}</span>
        <span class="location-name">${location.city || location.country}</span>
        <span class="location-count">${location.users}</span>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// 국가별 플래그 가져오기
function getCountryFlag(country) {
  const flags = {
    'South Korea': '🇰🇷', 'Korea': '🇰🇷', 'United States': '🇺🇸', 'Japan': '🇯🇵',
    'China': '🇨🇳', 'Germany': '🇩🇪', 'France': '🇫🇷', 'United Kingdom': '🇬🇧',
    'Canada': '🇨🇦', 'Australia': '🇦🇺', 'India': '🇮🇳', 'Brazil': '🇧🇷'
  };
  return flags[country] || '🌍';
}
function toggleRawData() {
  const content = document.getElementById('rawDataContent');
  const icon = document.getElementById('toggleIcon');
  
  if (content.classList.contains('open')) {
    content.classList.remove('open');
    icon.textContent = '▼';
  } else {
    content.classList.add('open');
    icon.textContent = '▲';
  }
}

init();
