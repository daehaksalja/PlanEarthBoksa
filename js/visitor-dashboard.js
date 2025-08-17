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
   /ga/daily?days=120 -> {ok, rows: [{date, users, pageviews}, ...]}
   여기서 "방문자" 카드/차트는 users로 매핑 */
async function fetchDailyData(days=120){
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

/* 디바이스별 데이터 */
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

/* 국가별 데이터 */
async function fetchCountriesData(){
  try{
    const r = await fetch(`${BASE}/ga/countries?limit=10`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    return data.rows || [];
  }catch(e){
    console.warn('Countries fetch failed:', e);
    return [
      { country: 'South Korea', users: 200 },
      { country: 'United States', users: 50 },
      { country: 'Japan', users: 30 }
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

/* 인기 페이지 데이터 */
async function fetchPopularPages(){
  try{
    const r = await fetch(`${BASE}/ga/pages?limit=15`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    return data.rows || [];
  }catch(e){
    console.warn('Popular pages fetch failed:', e);
    return [
      { path: '/', views: 150 },
      { path: '/works.html', views: 80 },
      { path: '/workshop.html', views: 60 }
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
  rows.forEach((r, i)=>{
    const tr = document.createElement('tr');
    const slice = rows.slice(Math.max(0, i-6), i+1); // 해당일 포함 7일 평균
    const sevenAvg = avg(slice.map(s=>s.count));
    const ratio = sevenAvg ? ((r.count/sevenAvg)-1)*100 : 0;
    const cls = classifyPct(ratio);
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
        backgroundColor: ['#00ff9c', '#7fffd1', '#00ffc3'],
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

function renderCountriesList(countries) {
  const container = document.getElementById('countriesList');
  container.innerHTML = countries.slice(0, 8).map(country => `
    <div class="country-item">
      <span class="country-name">${country.country}</span>
      <span class="country-users">${country.users.toLocaleString()}</span>
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
  container.innerHTML = pages.slice(0, 10).map(page => `
    <div class="page-item">
      <span class="page-path">${page.path}</span>
      <span class="page-views">${page.views.toLocaleString()}</span>
    </div>
  `).join('');
}

function renderPerformanceMetrics(perf) {
  document.getElementById('avgSessionDuration').textContent = 
    perf.avgSessionDuration ? `${Math.floor(perf.avgSessionDuration / 60)}:${String(perf.avgSessionDuration % 60).padStart(2, '0')}` : '-';
  document.getElementById('bounceRate').textContent = 
    perf.bounceRate ? `${perf.bounceRate}%` : '-';
  document.getElementById('pagesPerSession').textContent = 
    perf.pagesPerSession || '-';
}

function buildBrowsersChart(ctx, browsers){
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: browsers.map(b => b.browser),
      datasets: [{
        label: '방문자',
        data: browsers.map(b => b.users),
        backgroundColor: '#00ff9c55',
        borderColor: '#00ff9c',
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      scales: {
        x: { ticks: { color: '#7fe4bf' }, grid: { color: '#0f3d2d' } },
        y: { ticks: { color: '#7fe4bf' }, grid: { display: false } }
      },
      plugins: { legend: { labels: { color: '#9fffe2' } } }
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
        borderWidth:1.5,
        borderRadius:3
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
  // 병렬로 모든 데이터 가져오기
  const [rows, devices, countries, browsers, userTypes, hourly, sources, pages, performance, realtime] = await Promise.all([
    fetchDailyData(120),
    fetchDevicesData(),
    fetchCountriesData(),
    fetchBrowsersData(),
    fetchUserTypesData(),
    fetchHourlyData(),
    fetchTrafficSources(),
    fetchPopularPages(),
    fetchPerformanceData(),
    fetchRealtimeData()
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
  setText('firstDate', rows[0].date+' ~ '+rows[rows.length-1].date);

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
  renderTrafficSources(sources);
  renderPopularPages(pages);
  chartBrowsers = buildBrowsersChart(document.getElementById('chartBrowsers'), browsers);
  chartUserTypes = buildUserTypesChart(document.getElementById('chartUserTypes'), userTypes);
  chartHourly = buildHourlyChart(document.getElementById('chartHourly'), hourly);

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

init();
