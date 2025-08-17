

const BASE = 'https://planearth-ga.jmlee710000.workers.dev';

// === 인증 가드 (Supabase 세션 필요) ===
;(async function authGuard(){
  try{
    if(!window.supabase){
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js';
      s.onload=authGuard; document.head.appendChild(s); return;
    }
    const supabase = window.supabase.createClient(
      'https://feprvneoartflrnmefxz.supabase.co',
      'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE'
    );
    const { data:{ user } } = await supabase.auth.getUser();
    if(!user){ location.href='login.html'; return; }
  }catch(e){ console.warn('auth guard error', e); }
})();

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

// 사이트 개설 이후 전체 구간을 (추정) 무제한 확장하여 확보
// days 파라미터를 지수적으로 늘리며 더 오래된 날짜가 안 나올 때 중단
async function fetchAllDailyData(){
  let days=400; // 초기 범위
  let lastFirst=null; let rows=[];
  for(let i=0;i<7;i++){ // 최대 7회 (400 -> 25600일 ≈ 70년)
    const r = await fetchDailyData(days);
    if(!r.length){ break; }
    rows=r;
    const first = r[0].date;
    if(first===lastFirst){ // 더 이상 과거 확장 안됨
      break;
    }
    lastFirst=first;
    days*=2; // 범위 두배 확대
  }
  return rows;
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
    console.log('🔍 raw performance data:', data);
    // 중첩 구조(normalize)
    let flat = { ...data };
    if(data.data && typeof data.data === 'object') flat = { ...flat, ...data.data };
    if(data.metrics && typeof data.metrics === 'object') flat = { ...flat, ...data.metrics };
    if(Array.isArray(data.rows) && data.rows.length === 1 && typeof data.rows[0] === 'object') flat = { ...flat, ...data.rows[0] }; // 단일 행 케이스

    // 다양한 키 이름 대응
    let avgSessionDuration = Number(
      flat.avgSessionDuration ??
      flat.averageSessionDuration ??
      flat.sessionDurationAvg ??
      flat.averageSessionDurationSeconds ??
      flat.meanSessionDuration ??
      flat.sessionDuration ?? 0
    );
    // 초 단위가 아닌 ms일 가능성 탐지 (비정상적으로 큰 값이면 변환)
    if(avgSessionDuration > 0 && avgSessionDuration > 86400){ // 하루초보다 크면 ms로 추정
      avgSessionDuration = Math.round(avgSessionDuration/1000);
    }

    let bounceRate = flat.bounceRate ?? flat.avgBounceRate ?? flat.bounce ?? null;
    // GA4는 engagementRate만 줄 가능성 -> bounceRate = 1 - engagementRate
    if((bounceRate === null || bounceRate === undefined) && (flat.engagementRate !== undefined)){
      let er = Number(flat.engagementRate);
      if(er > 1) er = er/100; // 0~100 들어온 경우 보정
      if(er>=0 && er<=1){ bounceRate = 1 - er; }
    }

    let pagesPerSession = flat.pagesPerSession ?? flat.avgPagesPerSession ?? flat.pages_session ?? null;
    if(pagesPerSession == null){
      // pageviews & sessions 있으면 계산
      const pv = Number(flat.pageviews ?? flat.screenPageViews ?? flat.views ?? NaN);
      const sessions = Number(flat.sessions ?? flat.totalSessions ?? NaN);
      if(!isNaN(pv) && !isNaN(sessions) && sessions>0){
        pagesPerSession = pv / sessions;
      }
    }

    const perf = { avgSessionDuration, bounceRate, pagesPerSession };
    const allEmpty = [avgSessionDuration, bounceRate, pagesPerSession]
      .every(v => v === 0 || v === null || v === undefined || (typeof v === 'number' && isNaN(v)));
    if(allEmpty){
      console.warn('Performance API returned empty/zero metrics -> using fallback mock');
      return { avgSessionDuration:180, bounceRate:65, pagesPerSession:2.3, _fallback:true };
    }
    console.log('✅ derived performance metrics:', perf);
    return perf;
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

/* 테이블 렌더링 (최신이 위, 각 행 기준 앞으로 7일 평균 대비) */
function renderTable(rows){
  const tbody = document.querySelector('#rawTable tbody');
  if(!tbody) return;
  tbody.innerHTML='';
  const sorted=[...rows].sort((a,b)=> b.date.localeCompare(a.date));
  sorted.forEach((r,i)=>{
    const window = sorted.slice(i, i+7); // 현재 포함 이후 6개(역순이라 미래가 과거)
    const sevenAvg = avg(window.map(s=>s.count));
    const ratio = sevenAvg ? ((r.count/sevenAvg)-1)*100 : 0;
    const cls = classifyPct(ratio);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${r.date}</td><td>${r.count}</td><td class="${cls}">${ratio.toFixed(1)}%</td>`;
    tbody.appendChild(tr);
  });
}

/* DOM 헬퍼 */
function setMetric(id,val){ const el=document.getElementById(id); if(el) el.textContent = val; }
function setText(id,val){ const el=document.getElementById(id); if(el) el.textContent = val; }

/* 차트 */
let chartDaily, chartDevices, chartBrowsers, chartHourly; // 사용 중인 차트만
let realtimeHistory=[]; let realtimeSparkChart=null; let fullDailyRows=[]; let loading=false; let realtimeIntervalId=null;

function setLoading(on){
  loading=on; const metrics=['avgSessionDuration','bounceRate','pagesPerSession','newUserPercent'];
  metrics.forEach(id=>{const el=document.getElementById(id); if(!el) return; el.textContent= on? '' : el.textContent; if(on){el.classList.add('skeleton');} else {el.classList.remove('skeleton');}});
}

function buildRealtimeSpark(){
  const ctx=document.getElementById('realtimeSpark'); if(!ctx) return;
  if(realtimeSparkChart){ realtimeSparkChart.destroy(); }
  const labels = realtimeHistory.map((_,i)=> i+1);
  realtimeSparkChart = new Chart(ctx, { 
    type:'line',
    data:{ labels, datasets:[{ data:realtimeHistory, borderColor:'#00ff9c', tension:.3, borderWidth:1.2, fill:false, pointRadius:0 }]},
    options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ x:{ display:false }, y:{ display:false } } }
  });
}

function updateRealtimeHistory(val){
  realtimeHistory.push(val); if(realtimeHistory.length>40) realtimeHistory.shift(); buildRealtimeSpark();
}

function detectAnomalies(rows){
  // 간단: 최근 30일 평균 + 2*표준편차 초과면 강조
  if(rows.length<30) return new Set();
  const last30 = rows.slice(-30); const values=last30.map(r=>r.count);
  const mean=avg(values); const variance=avg(values.map(v=> (v-mean)**2)); const sd=Math.sqrt(variance);
  const threshold = mean + 2*sd;
  const anomalous = new Set();
  rows.slice(-14).forEach(r=>{ if(r.count>threshold) anomalous.add(r.date); });
  return anomalous;
}

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
  container.innerHTML = countries.slice(0, 5).map(country =>
    `<div>${country.country}${country.region ? ' • ' + country.region : ''} <b>${country.users}명</b></div>`
  ).join('');
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
  if(!container) return;
  const top = pages.slice(0, 10);
  const html = top.map(p => {
    const title = p.title && p.title !== p.path ? p.title : '';
    const durSec = Number(p.avgDuration)||0; const mm=Math.floor(durSec/60); const ss=String(Math.round(durSec%60)).padStart(2,'0');
    const bounceRaw = Number(p.bounceRate); let bouncePct='-';
    if(!isNaN(bounceRaw)) { let v=bounceRaw; if(v<=1) v*=100; v=Math.min(100,Math.max(0,v)); bouncePct=v.toFixed(1)+'%'; }
    const engage = p.engagement!=null? `${p.engagement}%` : '-';
    let bounceClass='mid';
    const bounceVal = parseFloat(bouncePct);
    if(!isNaN(bounceVal)) {
      if(bounceVal<30) bounceClass='low'; else if(bounceVal>55) bounceClass='high'; else bounceClass='mid';
    }
    return `
    <div class="page-item detailed">
      <div class="page-info">
        <span class="page-path">${p.path}</span>
        ${title? `<span class="page-title">${title}</span>`:''}
      </div>
      <div class="page-stats">
        <span class="page-views">👁 ${p.views?.toLocaleString?.()||p.views||0}뷰</span>
        <span class="page-users">👤 ${p.users?.toLocaleString?.()||p.users||0}명</span>
        <span class="page-duration">⏱ ${mm}:${ss}</span>
        <span class="page-bounce ${'page-bounce '+bounceClass}">↩ ${bouncePct}</span>
        <span class="page-duration">🔥 ${engage}</span>
      </div>
    </div>`;
  }).join('');
  container.innerHTML = html || '<div>데이터 없음</div>';
}

function renderPerformanceMetrics(perf){
  const durRaw = Number(perf.avgSessionDuration);
  const hasDur = !!durRaw;
  const mm = Math.floor(durRaw/60); const ss=String(Math.round(durRaw%60)).padStart(2,'0');
  const durStr = hasDur ? `${mm}:${ss}` : '-';
  const brRaw = perf.bounceRate; let br='-';
  if(brRaw!==undefined && brRaw!==null && !isNaN(brRaw)){
    let v=Number(brRaw); // 이미 % 값(소수1)로 들어옴
    if(v<=1) v=v*100; // 혹시 0~1이면 변환
    v=Math.min(100,Math.max(0,v)); br=v.toFixed(1)+'%';
  }
  const ppsRaw = perf.pagesPerSession; const pps = (ppsRaw!==undefined && ppsRaw!==null && !isNaN(ppsRaw) && Number(ppsRaw)!==0)? Number(ppsRaw).toFixed(2):'-';
  setText('avgSessionDuration', durStr);
  setText('bounceRate', br);
  setText('pagesPerSession', pps);
  // 빈 데이터 경고 배지 (한 번만)
  if(durStr==='-' && br==='-' && pps==='-' && !document.getElementById('perfEmptyBadge')){
    const box=document.getElementById('performanceMetrics');
    if(box){
      const badge=document.createElement('div');
      badge.id='perfEmptyBadge';
      badge.style.cssText='grid-column:1/-1; text-align:center; font-size:11px; color:#ffb07f; opacity:.85;';
      badge.textContent='(성능 원시값이 응답에 없어 기본 계산 불가)';
      box.appendChild(badge);
    }
  }
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
  const last = rows.slice(-14); // 최근 14일 고정
  const anomalies = detectAnomalies(rows);
  return new Chart(ctx, {
    type:'bar',
    data:{
      labels:last.map(r=>r.date.slice(5)),
      datasets:[{
        label:'일일 방문',
        data:last.map(r=>r.count),
        backgroundColor:last.map(r=> anomalies.has(r.date)? '#ff5d5dcc' : '#00ff9c55'),
        borderColor:last.map(r=> anomalies.has(r.date)? '#ff5d5d' : '#00ff9c'),
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

// (주간/월간 차트 및 사용자 유형 도넛은 현재 UI에서 숨김 처리되어 함수 제거)

/* 엔트리 */
async function init(){
  setLoading(true);
  const [rows, devices, countriesRaw, browsers, userTypes, hourly, pages, performance, realtime] = await Promise.all([
    fetchAllDailyData(),
    fetchDevicesData(),
    fetchCountriesData(),
    fetchBrowsersData(),
    fetchUserTypesData(),
    fetchHourlyData(),
    fetchPopularPages(),
    fetchPerformanceData(),
    fetchRealtimeData()
  ]);

  if(!rows.length) return;
  fullDailyRows = rows;

  // 실시간 데이터
  setMetric('realtimeCount', realtime.toLocaleString());
  // 스파크라인 초기화
  updateRealtimeHistory(realtime);

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
  // 항상 오늘 날짜(한국시간)로 범위 끝을 표시
  function getKSTDateString() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kst = new Date(utc + 9 * 60 * 60000);
    return formatDate(kst);
  }
  setText('firstDate', `개설 이후: ${rows[0].date} ~ ${getKSTDateString()}`);

  // 성능 지표
  renderPerformanceMetrics(performance);
  // 신규 방문자 비율도 성능 지표에 추가
  document.getElementById('newUserPercent').textContent = userTypes.newUserPercent ? `${userTypes.newUserPercent}%` : '-';

  // 테이블 & 기존 차트
  renderTable(rows.slice(-90));
  chartDaily = buildDailyChart(document.getElementById('chartDaily'), rows);
  // 주간/월간 차트 제거

  // 새로운 분석 차트들과 리스트들
  chartDevices = buildDevicesChart(document.getElementById('chartDevices'), devices);
  // 국가/지역 중복 병합 (country|region|city 키)
  const mergedMap=new Map();
  (countriesRaw||[]).forEach(c=>{
    const key=`${c.country||''}|${c.region||''}|${c.city||''}`;
    if(!mergedMap.has(key)) mergedMap.set(key,{...c});
    else { const ref=mergedMap.get(key); ref.users=(ref.users||0)+(c.users||0); ref.pageviews=(ref.pageviews||0)+(c.pageviews||0);} });
  const mergedCountries=Array.from(mergedMap.values()).sort((a,b)=> (b.users||0)-(a.users||0));
  renderCountriesList(mergedCountries);
  renderPopularPages(pages);
  chartBrowsers = buildBrowsersChart(document.getElementById('chartBrowsers'), browsers);
  chartHourly = buildHourlyChart(document.getElementById('chartHourly'), hourly);
  
  // 추가 데이터 로깅
  setText('newUserPercent', (userTypes && userTypes.newUserPercent!=null)? `${userTypes.newUserPercent}%` : '-');
  setLoading(false);
  const lu=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const inline=document.getElementById('lastUpdatedInline'); if(inline) inline.textContent=lu;

  // 실시간 데이터 주기적 업데이트 (30초마다)
  startRealtimeUpdates();
}

/* 실시간 데이터 주기적 업데이트 */
function startRealtimeUpdates(){
  if(realtimeIntervalId) return; // 중복 방지
  realtimeIntervalId = setInterval(async () => {
    try {
      const realtimeUsers = await fetchRealtimeData();
      setMetric('realtimeCount', realtimeUsers.toLocaleString());
  updateRealtimeHistory(realtimeUsers);
      // 실시간 카드에 펄스 효과 추가
      const realtimeCard = document.getElementById('card-realtime');
      if(realtimeCard) {
        realtimeCard.style.transform = 'scale(1.02)';
        setTimeout(() => {
          realtimeCard.style.transform = 'scale(1)';
        }, 200);
      }
      const lu=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      const inline=document.getElementById('lastUpdatedInline'); if(inline) inline.textContent=lu;
    } catch (e) {
      console.warn('실시간 업데이트 실패:', e);
    }
  }, 30000); // 30초마다 업데이트
}

/* === 자정 자동 갱신 === */
async function refreshDailySection(){
  const rows = await fetchAllDailyData();
  if(!rows.length) return;
  fullDailyRows = rows;
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
  setText('firstDate', `개설 이후: ${rows[0].date} ~ ${rows[rows.length-1].date}`);
  // 차트/테이블 업데이트
  if(chartDaily){ chartDaily.destroy(); }
  chartDaily = buildDailyChart(document.getElementById('chartDaily'), rows);
  renderTable(rows.slice(-90));
}

function scheduleMidnightRefresh(){
  const now=new Date();
  const next=new Date(now); next.setDate(now.getDate()+1); next.setHours(0,2,5,0); // 자정+2분5초 (GA 데이터 반영 여유)
  const ms= next - now;
  setTimeout(async ()=>{ try{ await refreshDailySection(); } catch(e){ console.warn('Midnight refresh failed', e); } finally { scheduleMidnightRefresh(); } }, ms);
}

scheduleMidnightRefresh();

// (이전 중복 코드 정리됨)

// 접힐 수 있는 섹션 토글 기능
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

/* === 부가 기능 === */
function exportCSV(){
  if(!fullDailyRows.length) return; const header='date,count\n';
  const body=fullDailyRows.map(r=>`${r.date},${r.count}`).join('\n');
  const blob=new Blob([header+body],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download='visitors.csv'; document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},0);
}

// 성능 지표 토글
document.addEventListener('click', (e)=>{
  if(e.target && e.target.id==='togglePerf'){
    const box=document.getElementById('performanceBox');
    if(!box) return;
    if(box.classList.contains('collapsed')){
      box.classList.remove('collapsed');
      e.target.textContent='숨기기';
      localStorage.removeItem('perfHidden');
    } else {
      box.classList.add('collapsed');
      e.target.textContent='보이기';
      localStorage.setItem('perfHidden','1');
    }
  }
});

window.addEventListener('DOMContentLoaded', ()=>{
  if(localStorage.getItem('perfHidden')){
    const box=document.getElementById('performanceBox');
    const btn=document.getElementById('togglePerf');
    if(box && btn){ box.classList.add('collapsed'); btn.textContent='보이기'; }
  }
});
