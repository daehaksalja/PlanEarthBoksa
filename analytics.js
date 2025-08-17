// analytics.js
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const client = new BetaAnalyticsDataClient();

async function runReport() {
  const [response] = await client.runReport({
    property: 'properties/499359404',
 // 네 GA4 Property ID
    dateRanges: [
  { startDate: '30daysAgo', endDate: 'today' }
],
    metrics: [
      { name: 'activeUsers' },       // 방문자 수
    ],
    dimensions: [{ name: 'sessionSourceMedium' }], // 유입 경로
  });

  console.log('=== 결과 ===');
  console.log(JSON.stringify(response.rows ?? [], null, 2));
}

runReport().catch(console.error);
