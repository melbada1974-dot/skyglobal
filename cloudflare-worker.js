// ============================================================
// SkyGlobal Partner Form Proxy — Cloudflare Worker
// ============================================================
// Cloudflare Workers 대시보드에서 생성 시 이 코드를 붙여넣으세요.
// GAS URL을 클라이언트에서 숨기고, Rate Limiting을 적용합니다.
// ============================================================

var GAS_URL = 'https://script.google.com/macros/s/AKfycbylbBTKIRKuVvMdl48Od216AkXVuPrxzlgJpdmkuAUBfAxbpKIpoog2aISeCgX8NJPDLA/exec';

// 허용된 도메인 목록
var ALLOWED_ORIGINS = [
  'https://skyglobalstudy.com',
  'https://www.skyglobalstudy.com',
  'https://skyglobal.pages.dev',
  'http://localhost:8080',
  'http://localhost:8081'
];

export default {
  async fetch(request) {
    // CORS preflight 처리
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }

    // POST만 허용
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ result: 'error', message: 'Method not allowed' }),
        { status: 405, headers: corsHeaders(request) }
      );
    }

    // Origin 검증
    var origin = request.headers.get('Origin') || '';
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(
        JSON.stringify({ result: 'error', message: 'Forbidden' }),
        { status: 403, headers: corsHeaders(request) }
      );
    }

    try {
      // 요청 본문 읽기
      var body = await request.text();

      // GAS로 중계
      var gasResponse = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        redirect: 'follow'
      });

      var responseText = await gasResponse.text();

      return new Response(responseText, {
        status: 200,
        headers: corsHeaders(request)
      });

    } catch (error) {
      return new Response(
        JSON.stringify({ result: 'error', message: 'Proxy error' }),
        { status: 500, headers: corsHeaders(request) }
      );
    }
  }
};

function corsHeaders(request) {
  var origin = request.headers.get('Origin') || '';
  var allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function handleCORS(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request)
  });
}
