const path = require('path');
const fs = require('fs-extra');
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

// .env가 있을 때만 읽고(로컬), Cloudflare Pages에선 환경변수 그대로 사용
try { require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); } catch {}

// ----- 환경변수 체크 (빌드 로그에 안전하게 프리픽스만 노출)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
console.log('[supabase] url ok:', !!SUPABASE_URL, ' key prefix:', SUPABASE_KEY ? SUPABASE_KEY.slice(0, 3) : '(none)');
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
if (!/^sb_secret_/.test(SUPABASE_KEY)) {
  throw new Error('SUPABASE_KEY must be a server key starting with "sb_secret_".');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OUTPUT_DIR = path.join(__dirname, '..');
const TEMPLATE_PATH = path.join(__dirname, '..', 'template.html');

function slugifyWithPadding(id, subtitle) {
  const paddedId = id.toString().padStart(4, '0');
  const slug = String(subtitle || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${paddedId}-${slug}`;
}

// 숫자형 html만 정리 (0001-*.html)
async function cleanOutput() {
  const files = await fs.readdir(OUTPUT_DIR);
  const regex = /^\d{4,}-.+\.html$/;
  await Promise.all(
    files
      .filter(f => regex.test(f))
      .map(f => fs.unlink(path.join(OUTPUT_DIR, f)).then(() => console.log(`🗑️ 삭제됨: ${f}`)))
  );
  console.log('🧹 숫자형 html 파일 정리 완료!');
}

async function fetchWorks() {
  const { data, error } = await supabase.from('works').select('*');
  if (error) throw error;
  return data || [];
}

async function renderPages(works) {
  const template = await fs.readFile(TEMPLATE_PATH, 'utf-8');

  for (const item of works) {
    const slug = slugifyWithPadding(item.id, item.subtitle || item.title || 'untitled');
    const html = template
      .replace(/{{id}}/g, item.id ?? '')
      .replace(/{{title}}/g, item.title || '')
      .replace(/{{subtitle}}/g, item.subtitle || '')
      .replace(/{{image_url}}/g, item.image_url || '')
      .replace(/{{since}}/g, item.since || '')
      .replace(/{{slug}}/g, slug);

    const outputPath = path.join(OUTPUT_DIR, `${slug}.html`);
    await fs.writeFile(outputPath, html);
    console.log(`✅ 생성됨: ${slug}.html`);
  }
}

(async () => {
  try {
    // 1) 먼저 DB 접근이 되는지 확인 (여기서 실패하면 기존 파일을 지우지 않음!)
    const works = await fetchWorks();

    // 2) 이제 안전하게 정리하고
    await cleanOutput();

    // 3) 페이지 생성
    await renderPages(works);
    console.log('🎉 모든 정적 페이지 생성 완료!');

    // 4) 사이트맵 생성 (stderr/stdout 그대로 표시)
    execSync('node js/generateSitemap.js', { stdio: 'inherit' });
  
  } catch (err) {
    console.error('❌ 오류 발생:', err);
    process.exit(1);
  }
})();
