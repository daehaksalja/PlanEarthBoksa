

// 설정값 사용
const BASE = window.CONFIG?.apiBaseUrl || 'https://planearth-ga.jmlee710000.workers.dev';
const DEBUG_ENABLED = window.CONFIG?.enableDebugLogs || false;

// === 인증 가드 (Supabase 세션 필요) ===
;(async function authGuard(){
  try{
    if(!window.supabase){
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js';
      s.onload=authGuard; document.head.appendChild(s); return;
    }
    const client = getSupabaseClient();
    if (!client) return;
    const { data:{ user } } = await client.auth.getUser();
    if(!user){ location.href='login.html'; return; }
  }catch(e){ console.warn('auth guard error', e); }
})();

/* utils */
function formatDate(d){ return d.toISOString().slice(0,10); }
function sum(arr){ return arr.reduce((a,b)=>a+b,0); }
function avg(arr){ return arr.length? sum(arr)/arr.length : 0; }
function percentChange(a,b){ if(!b) return 0; return (a-b)/b*100; }
function classifyPct(p){ if (p > 10) return 'good'; if (p < -10) return 'bad'; return 'mid'; }

// 공통 유틸리티: 사용자 수 추출
function extractUserCount(data) {
  return Number(
    data.users || data.uniqueUsers || data.totalUsers || 
    data.activeUsers || data.visitors || 0
  );
}

// 공통 유틸리티: 캐시 관리
function getCachedData(key, maxAgeMs = 10 * 60 * 1000) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj && obj.ts && (Date.now() - obj.ts) < maxAgeMs) {
      return obj.data;
    }
  } catch(e) {}
  return null;
}

function setCachedData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch(e) {}
}

// 공통 유틸리티: Supabase 클라이언트
let supabaseClient = null;
function getSupabaseClient() {
  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(
      'https://feprvneoartflrnmefxz.supabase.co',
      'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE'
    );
  }
  return supabaseClient;
}

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
    
    // 사용자 수 추출 로직 통합
    return (data.rows || []).map(row => ({
      date: row.date,
      count: extractUserCount(row)
    })).filter(row => row.date && !isNaN(row.count));
    
  }catch(e){
    console.warn('GA fetch failed, using mock:', e);
    return generateMock();
  }
}

// 사이트 개설 이후 전체 구간을 (추정) 무제한 확장하여 확보
async function fetchAllDailyData(){
  // 캐시 확인
  const cached = getCachedData('fullDailyRows_v1');
  if (cached) return cached;
  
  let days=400; let lastFirst=null; let rows=[];
  // Limit expansions to avoid runaway requests (max 2 expansions -> up to ~1600 days)
  for(let i=0;i<2;i++){
    const r = await fetchDailyData(days);
    if(!r.length){ break; }
    rows=r;
    const first = r[0].date;
    if(first===lastFirst){ break; }
    lastFirst=first;
    days*=2;
  }
  
  // 캐시 저장
  setCachedData('fullDailyRows_v1', rows);
  return rows;
}

// 공통 API 호출 함수 (캐시 + 에러 처리 통합)
async function apiCall(endpoint, cacheKey, mockData, cacheMs = 5 * 60 * 1000) {
  // 캐시 확인
  const cached = getCachedData(cacheKey, cacheMs);
  if (cached) return cached;
  
  try {
    const r = await fetch(`${BASE}${endpoint}`, { 
      cache: 'no-store', 
      credentials: 'omit' 
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'API error');
    
    const result = data.rows || data;
    setCachedData(cacheKey, result);
    return result;
    
  } catch(e) {
    console.warn(`${endpoint} fetch failed:`, e);
    return mockData;
  }
}

async function fetchDevicesData(){
  return apiCall('/ga/devices', 'cachedDevices_v1', [
    { device: 'mobile', users: 150 },
    { device: 'desktop', users: 120 },
    { device: 'tablet', users: 30 }
  ]);
}

async function fetchCountriesData(){
  return apiCall('/ga/countries?limit=1000', 'cachedCountries_v1', [
    { country: 'South Korea', region: 'Seoul', city: 'Gangnam-gu', users: 200, pageviews: 400 },
    { country: 'South Korea', region: 'Gyeonggi-do', city: 'Suwon', users: 150, pageviews: 300 },
    { country: 'United States', region: 'California', city: 'Los Angeles', users: 50, pageviews: 100 }
  ]);
}

async function fetchBrowsersData(){
  return apiCall('/ga/browsers?limit=1000', 'cachedBrowsers_v1', [
    { browser: 'Chrome', users: 180 },
    { browser: 'Safari', users: 60 },
    { browser: 'Firefox', users: 40 }
  ]);
}

async function fetchUserTypesData(){
  return apiCall('/ga/user-types', 'cachedUserTypes_v1', 
    { newUsers: 150, returningUsers: 100, totalUsers: 250, newUserPercent: 60 });
}

async function fetchHourlyData(){
  const mockHourly = [];
  for(let h = 0; h < 24; h++){
    mockHourly.push({ hour: h, users: Math.floor(Math.random() * 50) + 10 });
  }
  return apiCall('/ga/hourly', 'cachedHourly_v1', mockHourly);
}

async function fetchTrafficSources(){
  return apiCall('/ga/sources?limit=10', 'cachedSources_v1', [
    { source: 'google / organic', users: 120, pageviews: 300 },
    { source: 'direct / (none)', users: 80, pageviews: 200 },
    { source: 'naver / organic', users: 40, pageviews: 100 }
  ]);
}

async function fetchPopularPages(){
  return apiCall('/ga/pages-detail?limit=1000', 'cachedPages_v1', [
    { path: '/', title: 'Home', views: 150, users: 120, avgDuration: 45, bounceRate: 35, engagement: 65 },
    { path: '/works.html', title: 'Works', views: 80, users: 65, avgDuration: 120, bounceRate: 25, engagement: 75 },
    { path: '/workshop.html', title: 'Workshop', views: 60, users: 50, avgDuration: 90, bounceRate: 30, engagement: 70 }
  ]);
}

/* 성능 지표 데이터 */
async function fetchPerformanceData(){
  try{
    const r = await fetch(`${BASE}/ga/performance`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();
    if(!data.ok) throw new Error(data.error || 'GA error');
    
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
      return { avgSessionDuration:180, bounceRate:65, pagesPerSession:2.3, _fallback:true };
    }
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
    const r = await fetch(`${BASE}/ga/realtime`, { cache: 'no-store', credentials: 'omit' });
    const data = await r.json();

    if(!data.ok) throw new Error(data.error || 'GA error');
    
    // 기본: 서버에서 내려준 activeUsers를 사용
    let activeUsers = Number(data.activeUsers ?? 0);
    
    // 보정: 일부 백엔드(또는 포맷)에서는 debug.rawResponse 안에 실제 metricValues가 들어있음
    if((!activeUsers || activeUsers === 0) && data.debug && data.debug.rawResponse){
      const n = extractMetricValueFromDebug(data.debug.rawResponse);
      if(!Number.isNaN(n) && n > 0){
        activeUsers = n;
      }
    }
    
    // 추가 보정: rows 배열에서 데이터 추출 시도
    if((!activeUsers || activeUsers === 0) && data.rows && Array.isArray(data.rows) && data.rows.length > 0){
      const firstRow = data.rows[0];
      if(firstRow && typeof firstRow === 'object'){
        const possibleValues = [
          firstRow.activeUsers,
          firstRow.users,
          firstRow.active_users,
          firstRow.realtime_users,
          firstRow.concurrent_users
        ].filter(v => v !== undefined && v !== null && !isNaN(Number(v)));
        
        if(possibleValues.length > 0){
          activeUsers = Math.max(...possibleValues.map(Number));
        }
      }
    }
    
    // 정상 응답을 받았으므로 상태 플래그를 true로 설정
    realtimeApiHealthy = true;
    const card = document.getElementById('card-realtime');
    if(card) card.classList.remove('realtime-error');
    
    // 실시간 데이터가 0이면 최소 1명으로 설정 (현재 사용자)
    // 하지만 실제 0명일 수도 있으므로 더 관대하게 처리
    return Math.max(activeUsers, 0);
    
  }catch(e){
    console.warn('Realtime fetch failed:', e);
    // 에러 발생 시 플래그 세팅 및 fallback 반환
    realtimeApiHealthy = false;
    const card = document.getElementById('card-realtime');
    if(card) card.classList.add('realtime-error');
    // 에러 시에만 1명으로 fallback
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

// ------- debug helper: in-page API inspector (temporary) -------
// showApiDebug removed (development-only debug panel); no-op in production

// Extract numeric metric value from debug.rawResponse which may be an object or array
function extractMetricValueFromDebug(raw){
  try{
    if(!raw) return NaN;
    const root = Array.isArray(raw) ? raw[0] : raw;
    // common GA-like shape: { rows: [ { metricValues: [ { value: '1' } ] } ] }
    if(root && Array.isArray(root.rows) && root.rows.length){
      const mv = root.rows[0].metricValues || root.rows[0].metrics || root.rows[0].metric_values;
      if(Array.isArray(mv) && mv.length){
        const v = mv[0].value ?? mv[0];
        const n = Number(v);
        return Number.isNaN(n) ? NaN : n;
      }
    }
    // sometimes metricValues is at top-level or nested differently
    if(root && Array.isArray(root.metricValues) && root.metricValues.length){
      const v = root.metricValues[0].value ?? root.metricValues[0];
      const n = Number(v); return Number.isNaN(n)? NaN : n;
    }
    // fallback: deep search for first metricValues array
    const stack = [root];
    while(stack.length){
      const node = stack.shift();
      if(!node || typeof node !== 'object') continue;
      if(Array.isArray(node.metricValues) && node.metricValues.length){ const v=node.metricValues[0].value ?? node.metricValues[0]; const n=Number(v); if(!Number.isNaN(n)) return n; }
      if(Array.isArray(node.rows) && node.rows.length){ const mv = node.rows[0].metricValues; if(Array.isArray(mv) && mv.length){ const v=mv[0].value ?? mv[0]; const n=Number(v); if(!Number.isNaN(n)) return n; } }
      for(const k in node){ if(node[k] && typeof node[k] === 'object') stack.push(node[k]); }
    }
  }catch(e){ console.warn('extractMetricValueFromDebug error', e); }
  return NaN;
}

/* 차트 */
let chartDaily, chartDevices, chartBrowsers, chartHourly; // 사용 중인 차트만
let realtimeHistory=[]; let realtimeSparkChart=null; let fullDailyRows=[]; let loading=false; let realtimeIntervalId=null;
// Realtime polling controls
let realtimeBaseIntervalMs = window.CONFIG?.realtimePollingInterval || 120000; // 기본 120초
let realtimeBackoff = 1; // 지수 백오프 계수

// Leader election (single-tab leader per origin) using BroadcastChannel with localStorage fallback
let isLeader = false;
let leaderId = null;
let bc = null;
function generateTabId(){ return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`; }
async function setupLeaderElection(timeoutMs=500){
  return new Promise((resolve)=>{
    const tid = generateTabId();
    leaderId = null;
    // BroadcastChannel path
    if('BroadcastChannel' in window){
      bc = new BroadcastChannel('planearth-leader');
      bc.onmessage = (ev)=>{
        const m = ev.data;
        if(!m || !m.type) return;
        if(m.type === 'whois' && isLeader){ bc.postMessage({ type:'i-am', id: tid }); }
        if(m.type === 'i-am'){ leaderId = m.id; if(m.id !== tid) isLeader = false; }
        if(m.type === 'release'){ if(!leaderId) leaderId = null; }
      };
      // ask who is leader
      bc.postMessage({ type:'whois' });
      // wait short time for responses
      setTimeout(()=>{
        if(!leaderId){ // no leader replied -> claim
          isLeader = true; leaderId = tid; bc.postMessage({ type:'i-am', id: tid });
        }
        // if leader, start leader-only tasks
        if(isLeader) {
          console.log('Leader elected:', leaderId);
          startRealtimeUpdates(); scheduleMidnightRefresh();
        }
        resolve();
      }, timeoutMs);
      // release on unload
      window.addEventListener('beforeunload', ()=>{ if(isLeader){ bc.postMessage({ type:'release', id: tid }); } });
      return;
    }
    // localStorage fallback
    const key = 'planearth-leader-id';
    try{
      const existing = localStorage.getItem(key);
      if(!existing){ localStorage.setItem(key, tid); isLeader = true; leaderId = tid; }
      else { leaderId = existing; isLeader = (existing === tid); }
    }catch(e){ isLeader = true; leaderId = tid; }
    if(isLeader){ startRealtimeUpdates(); scheduleMidnightRefresh(); }
    resolve();
  });
}
let realtimeApiHealthy = true; // 실시간 API 상태 플래그

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
  const last30 = rows.slice(-30);
  const values = last30.map(r=>Number(r.count||0));
  const mean=avg(values); const variance=avg(values.map(v=> (v-mean)**2)); const sd=Math.sqrt(variance);
  const threshold = mean + 2*sd;
  const anomalous = new Set();
  rows.slice(-14).forEach(r=>{ if(Number(r.count||0)>threshold){ const d = (r.date||'').slice(0,10); anomalous.add(d); } });
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
  if(!container) return;
  
  // 공통 사용자 수 추출 함수
  const getUserCount = (c) => Number(
    c.users || c.uniqueUsers || c.totalUsers || c.visitors || c.activeUsers || 0
  );
  
  // 0명 국가 필터링 먼저 수행
  const validCountries = (countries||[]).filter(c => getUserCount(c) > 0);
  
  // 필터링된 데이터로 전체 사용자 수 계산
  const totalUsers = validCountries.reduce((sum, c) => sum + getUserCount(c), 0);
  
  if(totalUsers === 0) {
    container.innerHTML = '<div class="country-item">데이터 없음</div>';
    return;
  }
  
  // 그룹화: country -> cities 최적화된 로직
  const map = new Map();
  validCountries.forEach(c => {
    const country = c.country || 'Unknown';
    const region = c.region || '';
    const city = c.city || '';
    const users = getUserCount(c);
    
    // 국가별 집계 초기화
    if(!map.has(country)) {
      map.set(country, { total: 0, cities: new Map() });
    }
    const entry = map.get(country);
    entry.total += users;
    
    // 지역 정보 정리 (중복 제거 로직 개선)
    const locationName = (() => {
      if(region && city && region !== city) return `${region}, ${city}`;
      if(city) return city;
      if(region) return region;
      return '기타 지역';
    })();
    
    // 도시별 집계
    const currentUsers = entry.cities.get(locationName) || 0;
    entry.cities.set(locationName, currentUsers + users);
  });
  
  // 정렬 및 백분율 계산 최적화
  const arr = Array.from(map.entries()).map(([country, v]) => ({
    country,
    total: v.total,
    percentage: ((v.total / totalUsers) * 100).toFixed(1),
    cities: Array.from(v.cities.entries())
      .map(([location, users]) => ({
        location,
        users,
        percentage: ((users / totalUsers) * 100).toFixed(1)
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 10) // 상위 10개 도시만
  }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 10); // 상위 10개 국가만
  
  // 렌더링 최적화
  const html = arr.map((cn, idx) => {
    const rank = idx + 1;
    const citiesHtml = cn.cities.map((ct, cityIdx) => `
      <div class="city-line">
        <div class="city-left">
          <span class="city-rank">${cityIdx + 1}</span>
          <span class="city-name">${ct.location}</span>
        </div>
        <div class="city-stats">
          <span class="count">${ct.users}명</span>
          <span class="percentage">${ct.percentage}%</span>
        </div>
      </div>`
    ).join('');
    
    // 국가 플래그 매핑 최적화
    const flagMap = {
      'South Korea': '🇰🇷',
      'United States': '🇺🇸', 
      'Japan': '🇯🇵',
      'China': '🇨🇳',
      'Unknown': '🌍'
    };
    const flagEmoji = flagMap[cn.country] || '🌐';
    
    return `
      <div class="country-item detailed enhanced">
        <div class="country-header">
          <span class="country-rank">${rank}</span>
          <span class="country-flag">${flagEmoji}</span>
          <div class="country-info">
            <div class="country-title">${cn.country}</div>
            <div class="country-stats">
              <span class="count">${cn.total}명</span>
              <span class="percentage">${cn.percentage}%</span>
            </div>
          </div>
        </div>
        <div class="city-list enhanced">${citiesHtml}</div>
      </div>`;
  }).join('');
  
  container.innerHTML = html || '<div class="country-item">데이터 없음</div>';
  container.className = 'countries-list enhanced';
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
  // 데이터 양에 따라 동적으로 일수 결정 (최소 14일, 최대 30일)
  const dataLength = (rows || []).length;
  const daysToShow = Math.min(Math.max(dataLength, 14), 30);
  
  // KST 기준 최근 N일 날짜 목록 생성
  const utcNow = Date.now();
  const offset = new Date().getTimezoneOffset()*60000;
  const kstNow = new Date(utcNow + offset + 9*60*60000);
  const dates = [];
  for(let i=daysToShow-1;i>=0;i--){ const d=new Date(kstNow); d.setDate(kstNow.getDate()-i); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); dates.push(`${y}-${m}-${day}`); }
  // rows를 date->count 맵으로 변환 (r.date가 'YYYY-MM-DD' 또는 ISO 문자열일 수 있으므로 정규화)
  const map = new Map((rows||[]).map(r=> { const key = (r.date||'').slice(0,10); return [key, Number(r.count||0)]; }));
  const dataArr = dates.map(dt => map.has(dt) ? map.get(dt) : 0);
  const anomalies = detectAnomalies(rows);
  return new Chart(ctx, {
    type:'bar',
    data:{
      labels: dates.map(d=>d.slice(5)),
      datasets:[{
        label:'일일 방문',
        data: dataArr,
        backgroundColor: dates.map(d=> anomalies.has(d)? '#ff5d5dcc' : '#00ff9c55'),
        borderColor: dates.map(d=> anomalies.has(d)? '#ff5d5d' : '#00ff9c'),
        borderWidth:1.5,
        borderRadius:4,
      }]
    },
    options:{
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { bottom: 50 } },
      animation: false,
      transitions: {
        active: { animation: { duration: 0 } },
        resize: { animation: { duration: 0 } }
      },
      scales:{
        x:{ 
          ticks:{ 
            color:'#7fe4bf',
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            autoSkipPadding: Math.max(8, Math.floor(daysToShow/4)),
            maxTicksLimit: Math.min(daysToShow, 15),
            font: { size: daysToShow > 20 ? 9 : 10 }
          }, 
          grid:{ display:false } 
        },
        y:{ 
          ticks:{ 
            color:'#7fe4bf' 
          }, 
          grid:{ color:'#0f3d2d' } 
        }
      },
      plugins:{ 
        legend:{ 
          labels:{ 
            color:'#9fffe2' 
          } 
        } 
      }
    }
  });
}

// (주간/월간 차트 및 사용자 유형 도넛은 현재 UI에서 숨김 처리되어 함수 제거)

/* 엔트리 */
async function init(){
  // remove any leftover debug UI from development
  const old = document.getElementById('apiDebug'); if(old) old.remove();
  setLoading(true);
  // setup leader election first
  await setupLeaderElection();
  // Leader will fetch and cache heavy rows; followers reuse cached rows
  const promises = [
    fetchDevicesData(),
    fetchCountriesData(),
    fetchBrowsersData(),
    fetchUserTypesData(),
    fetchHourlyData(),
    fetchPopularPages(),
    fetchPerformanceData(),
    fetchRealtimeData()
  ];
  // rows: leader fetches, followers will read cache via fetchAllDailyData (which reads cache)
  const rowsPromise = isLeader ? fetchAllDailyData() : (async ()=>{
    // wait briefly for leader to populate cache
    for(let i=0;i<6;i++){ try{ const raw=localStorage.getItem('fullDailyRows_v1'); if(raw){ const obj=JSON.parse(raw); if(obj && obj.rows) return obj.rows; } }catch(e){} await new Promise(r=>setTimeout(r, 500)); }
    // fallback to local fetch (limited)
    return fetchAllDailyData();
  })();

  const [rows, devices, countriesRaw, browsers, userTypes, hourly, pages, performance, realtime] = await Promise.all([
    rowsPromise,
    ...promises
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
    // toISOString() would convert back to UTC — format using KST components directly
    const y = kst.getFullYear();
    const m = String(kst.getMonth()+1).padStart(2,'0');
    const d = String(kst.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  setText('firstDate', `개설 이후: ${rows[0].date} ~ ${getKSTDateString()}`);

  // 성능 지표
  renderPerformanceMetrics(performance);
  // 신규 방문자 비율도 성능 지표에 추가
  document.getElementById('newUserPercent').textContent = userTypes.newUserPercent ? `${userTypes.newUserPercent}%` : '-';

  // 테이블 & 기존 차트
  renderTable(rows.slice(-90));
  if(chartDaily){ chartDaily.destroy(); }
  chartDaily = buildDailyChart(document.getElementById('chartDaily'), rows);
  // 주간/월간 차트 제거

  // 새로운 분석 차트들과 리스트들
  if(chartDevices){ chartDevices.destroy(); }
  chartDevices = buildDevicesChart(document.getElementById('chartDevices'), devices);
  // Aggregate countries/cities across entire returned set
  function aggregateCountries(rows){
    const map = new Map();
    (rows||[]).forEach(r=>{
      const country = r.country || 'Unknown';
      const city = r.city || r.region || '';
      const users = Number(r.users||0);
      const key = `${country}|${city}`;
      if(!map.has(key)) map.set(key, { country, city, users:0, pageviews:0 });
      const cur = map.get(key);
      cur.users += users;
      cur.pageviews += Number(r.pageviews||0);
    });
    return Array.from(map.values());
  }
  const mergedCountries = aggregateCountries(countriesRaw).sort((a,b)=> b.users - a.users);
  renderCountriesList(mergedCountries);
  
  // Aggregate pages: group by path (and title) and sum views/users/duration
  function aggregatePages(rows){
    const map = new Map();
    (rows||[]).forEach(p=>{
      const path = p.path || p.page || '/';
      const title = p.title || p.name || path;
      const key = path;
      if(!map.has(key)) map.set(key, { path, title, views:0, users:0, avgDuration:0, bounceRate:null, engagement:null });
      const cur = map.get(key);
      cur.views += Number(p.views||p.pageviews||0);
      cur.users += Number(p.users||0);
      // avgDuration: keep weighted sum; we'll finalize after loop
      cur.avgDuration = (cur.avgDuration || 0) + (Number(p.avgDuration||p.averageDuration||0) * (Number(p.views||p.pageviews||0) || 1));
      if(p.bounceRate!=null) cur.bounceRate = (cur.bounceRate||0) + Number(p.bounceRate);
      if(p.engagement!=null) cur.engagement = (cur.engagement||0) + Number(p.engagement);
    });
    // finalize averages
    Array.from(map.values()).forEach(v=>{
      const denom = v.views || 1;
      v.avgDuration = Math.round((v.avgDuration||0)/denom);
      if(v.bounceRate!=null) v.bounceRate = (v.bounceRate / (1)).toFixed? Number((v.bounceRate).toFixed(2)) : v.bounceRate;
      if(v.engagement!=null) v.engagement = (v.engagement / (1)).toFixed? Number((v.engagement).toFixed(1)) : v.engagement;
    });
    return Array.from(map.values()).sort((a,b)=> b.views - a.views);
  }
  const aggregatedPages = aggregatePages(pages);
  renderPopularPages(aggregatedPages);
  // build aggregated browsers chart below (destroy existing instance first)
  if(chartBrowsers){ chartBrowsers.destroy(); }
  // aggregate browsers and devices across returned rows
  function aggregateByKey(rows, keyName, valueName='users'){
    const map = new Map();
    (rows||[]).forEach(r=>{
      const k = r[keyName] || 'Unknown';
      map.set(k, (map.get(k)||0) + Number(r[valueName]||0));
    });
    return Array.from(map.entries()).map(([k,v])=>({ [keyName]:k, users:v }));
  }
  const aggBrowsers = aggregateByKey(browsers, 'browser', 'users');
  chartBrowsers = buildBrowsersChart(document.getElementById('chartBrowsers'), aggBrowsers);
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
function stopRealtimeUpdates(){
  if(realtimeIntervalId){ clearTimeout(realtimeIntervalId); realtimeIntervalId = null; }
}

function startRealtimeUpdates(){
  // 이미 타이머가 돌고 있으면 중복 시작 금지
  if(realtimeIntervalId) return;
  // 탭이 숨겨져 있으면 폴링 중지
  if(document.hidden){ return; }

  // 실행 함수: fetch 후 다음 호출을 스케줄
  const run = async () => {
    try{
      const realtimeUsers = await fetchRealtimeData();
      
      // 실시간 사용자 수 업데이트
      setMetric('realtimeCount', realtimeUsers.toLocaleString());
      updateRealtimeHistory(realtimeUsers);
      
      // 상태 표시 업데이트
      const lastUpdated = new Date().toLocaleTimeString('ko-KR', {
        hour:'2-digit', 
        minute:'2-digit', 
        second:'2-digit'
      });
      const inline = document.getElementById('lastUpdatedInline'); 
      if(inline) inline.textContent = lastUpdated;
      
      // 펄스 애니메이션 (데이터가 실제로 변경된 경우에만)
      const realtimeCard = document.getElementById('card-realtime');
      if(realtimeCard && realtimeUsers > 0){ 
        realtimeCard.style.transform = 'scale(1.02)'; 
        setTimeout(() => { realtimeCard.style.transform='scale(1)'; }, 200); 
      }
      
      // 성공했으므로 백오프 리셋
      realtimeBackoff = 1;
      
      // API 상태가 건강함을 표시 (개발환경에서만)
      if(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log(`🔴 실시간 업데이트 성공: ${realtimeUsers}명 (${lastUpdated})`);
      }
      
    }catch(e){
      console.warn('실시간 업데이트 실패:', e);
      // 실패 시 백오프 증가 (최대 8배, 즉 최대 16분 간격)
      realtimeBackoff = Math.min(realtimeBackoff * 2, 8);
      if(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.warn(`🔴 실시간 업데이트 백오프: ${realtimeBackoff}x (다음: ${realtimeBaseIntervalMs * realtimeBackoff / 1000}초 후)`);
      }
    } finally {
      // 다음 호출 예약 (페이지가 보이는 경우에만)
      if(!document.hidden){
        realtimeIntervalId = setTimeout(run, realtimeBaseIntervalMs * realtimeBackoff);
      } else {
        // 탭 숨김이면 타이머를 남기지 않고 중지
        realtimeIntervalId = null;
      }
    }
  };

  // 즉시 한 번 실행하고 루프 시작
  run();
}

// Visibility 변화에 따른 시작/중지
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){
    stopRealtimeUpdates();
  } else {
    startRealtimeUpdates();
  }
});

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
  // 최신 날짜는 KST 기준으로 표시 (toISOString 사용 시 UTC로 변환되는 문제 방지)
  function getKSTDateString() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kst = new Date(utc + 9 * 60 * 60000);
    const y = kst.getFullYear();
    const m = String(kst.getMonth() + 1).padStart(2, '0');
    const d = String(kst.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  setText('firstDate', `개설 이후: ${rows[0].date} ~ ${getKSTDateString()}`);
  // 차트/테이블 업데이트 (중복 제거)
  renderTable(rows.slice(-90));
}

function msUntilNextKSTMidnight(){
  // 계산: 현재 시각(UTC 기반) -> KST 현재 -> 다음 KST 자정(00:00:00)까지의 ms
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kstNow = new Date(utc + 9 * 60 * 60000);
  const nextMid = new Date(kstNow);
  nextMid.setDate(kstNow.getDate() + 1);
  nextMid.setHours(0, 2, 5, 0); // 자정 + 2분5초 여유
  // convert nextMid (which is in KST) back to ms since epoch
  const nextMidUtcMs = nextMid.getTime() - (9 * 60 * 60000);
  return Math.max(0, nextMidUtcMs - now.getTime());
}

function scheduleMidnightRefresh(){
  const ms = msUntilNextKSTMidnight();
  setTimeout(async ()=>{
    try{ await refreshDailySection(); }
    catch(e){ console.warn('Midnight refresh failed', e); }
    finally { scheduleMidnightRefresh(); }
  }, ms);
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
  
  // 로그아웃 버튼 이벤트 추가
  const logoutBtn = document.getElementById('logout-btn');
  if(logoutBtn){
    logoutBtn.addEventListener('click', async ()=>{
      try{
        const client = getSupabaseClient();
        if(client) await client.auth.signOut();
        
        // 로컬 스토리지 캐시 정리 (통합된 키 목록)
        const cacheKeys = [
          'fullDailyRows_v1', 'cachedDevices_v1', 'cachedCountries_v1', 
          'cachedBrowsers_v1', 'cachedUserTypes_v1', 'cachedHourly_v1', 
          'cachedSources_v1', 'cachedPages_v1', 'cachedPerformance_v1'
        ];
        cacheKeys.forEach(key => localStorage.removeItem(key));
        
        location.href = 'login.html';
      }catch(e){
        console.error('로그아웃 오류:', e);
        location.href = 'login.html';
      }
    });
  }
});
