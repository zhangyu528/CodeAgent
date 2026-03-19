import { WebSearchTool } from '../../core/tools/web_search_tool';
import { BrowsePageTool } from '../../core/tools/browse_page_tool';
import { SecurityLayer } from '../../core/controller/security_layer';

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

export async function test() {
  console.log('=== Running Integration Test: Web Tools (Mocked Fetch) ===');

  const originalFetch: any = (globalThis as any).fetch;
  assert(typeof originalFetch === 'function', 'global fetch is not available in this Node runtime');

  try {
    // Mock fetch for Tavily and browse_page
    (globalThis as any).fetch = async (url: any, init?: any) => {
      const u = String(url);

      if (u.startsWith('https://api.tavily.com/search')) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify({
            query: body.query,
            results: [
              { title: 'Example Result', url: 'https://example.com/docs', content: 'Hello snippet from Tavily.' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (u === 'https://example.com/page') {
        const html = `
          <html>
            <head><title>Test Page</title></head>
            <body>
              <nav>nav content</nav>
              <article>
                <h1>Article Title</h1>
                <p>First paragraph.</p>
                <p>Second paragraph.</p>
                <pre><code>console.log('hi');</code></pre>
                <ul><li>Bullet one</li><li>Bullet two</li></ul>
              </article>
              <footer>footer content</footer>
            </body>
          </html>
        `;
        return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }

      return new Response('Not Found', { status: 404, headers: { 'content-type': 'text/plain' } });
    };

    process.env.WEB_SEARCH_PROVIDER = 'tavily';
    process.env.TAVILY_API_KEY = 'test';

    const ws = new WebSearchTool();
    const wsOut = JSON.parse(await ws.execute({ query: 'typescript zod', numResults: 3 }));
    assert(wsOut.provider === 'tavily', 'provider should be tavily');
    assert(Array.isArray(wsOut.results) && wsOut.results.length === 1, 'should return 1 mocked result');
    assert(wsOut.results[0].url === 'https://example.com/docs', 'mocked url mismatch');

    const security = new SecurityLayer(process.cwd());
    const bp = new BrowsePageTool(security);
    const bpOut = JSON.parse(await bp.execute({ url: 'https://example.com/page', maxChars: 2000, format: 'markdown' }));
    assert(bpOut.title === 'Test Page' || bpOut.title === 'Article Title' || typeof bpOut.title === 'string', 'title should exist');
    assert(typeof bpOut.summary === 'string' && bpOut.summary.length > 0, 'summary should be non-empty');
    assert(typeof bpOut.content === 'string' && bpOut.content.includes('First paragraph'), 'content should include extracted text');

    console.log('\n=== Web Tools Integration Test Pass ===');
  } finally {
    (globalThis as any).fetch = originalFetch;
  }
}

const isMain = Boolean(process.argv[1]) && import.meta.url.endsWith(process.argv[1]!.replace(/\\\\/g, '/'));
if (isMain) {
  test().catch(e => {
    console.error('❌ Web Tools Integration Test Failed:', e.message);
    process.exit(1);
  });
}
