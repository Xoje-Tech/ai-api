export function landingHTML(baseUrl: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bun AI API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #fff; }
    h1 span { color: #f472b6; }
    .subtitle { color: #888; margin-bottom: 2rem; }
    h2 { font-size: 1.3rem; color: #f472b6; margin-top: 2rem; margin-bottom: 0.5rem; border-bottom: 1px solid #222; padding-bottom: 0.3rem; }
    .endpoint { background: #141414; border: 1px solid #222; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .method { display: inline-block; font-weight: bold; font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; margin-right: 8px; }
    .get { background: #064e3b; color: #6ee7b7; }
    .post { background: #3b0764; color: #c084fc; }
    .delete { background: #7f1d1d; color: #fca5a5; }
    .path { font-family: monospace; font-size: 0.95rem; color: #fff; }
    .desc { color: #999; font-size: 0.85rem; margin: 0.5rem 0; }
    pre { background: #1a1a1a; border: 1px solid #333; border-radius: 6px; padding: 0.75rem; overflow-x: auto; font-size: 0.8rem; color: #d4d4d4; margin: 0.5rem 0; }
    code { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; }
    button { background: #f472b6; color: #000; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; margin-top: 0.5rem; }
    button:hover { background: #f9a8d4; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .result { background: #0f172a; border: 1px solid #1e3a5f; border-radius: 6px; padding: 0.75rem; margin-top: 0.5rem; font-size: 0.8rem; font-family: monospace; white-space: pre-wrap; display: none; color: #93c5fd; max-height: 300px; overflow-y: auto; }
    .result.visible { display: block; }
    .badge { display: inline-block; background: #1e293b; color: #94a3b8; font-size: 0.7rem; padding: 2px 6px; border-radius: 3px; margin-left: 6px; }
  </style>
</head>
<body>
  <h1>🚀 Bun <span>AI API</span></h1>
  <p class="subtitle">API con servicios de IA y base de datos PostgreSQL</p>

  <h2>💬 Chat</h2>

  <div class="endpoint">
    <span class="method post">POST</span>
    <span class="path">/chat</span>
    <span class="badge">streaming</span>
    <p class="desc">Envía mensajes al servicio de IA y recibe respuesta en streaming.</p>
    <pre><code>curl -X POST ${baseUrl}/chat \\
  -H "Content-Type: application/json" \\
  -d '{"messages": [{"role": "user", "content": "Hola, ¿qué tal?"}]}'</code></pre>
    <button onclick="testChat()">Probar</button>
    <div class="result" id="result-chat"></div>
  </div>

  <h2>👤 Users</h2>

  <div class="endpoint">
    <span class="method get">GET</span>
    <span class="path">/users</span>
    <p class="desc">Obtiene la lista de usuarios. Parámetro opcional: <code>?limit=10</code></p>
    <pre><code>curl ${baseUrl}/users</code></pre>
    <button onclick="testEndpoint('GET', '/users', null, 'result-get-users')">Probar</button>
    <div class="result" id="result-get-users"></div>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span>
    <span class="path">/users/:id</span>
    <p class="desc">Obtiene un usuario por su ID.</p>
    <pre><code>curl ${baseUrl}/users/1</code></pre>
    <button onclick="testEndpoint('GET', '/users/1', null, 'result-get-user')">Probar (id=1)</button>
    <div class="result" id="result-get-user"></div>
  </div>

  <div class="endpoint">
    <span class="method post">POST</span>
    <span class="path">/users</span>
    <p class="desc">Crea un nuevo usuario. Body: <code>{ "name": "...", "email": "..." }</code></p>
    <pre><code>curl -X POST ${baseUrl}/users \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Ada Lovelace", "email": "ada@example.com"}'</code></pre>
    <button onclick="testEndpoint('POST', '/users', {name: 'Ada Lovelace', email: 'ada' + Date.now() + '@example.com'}, 'result-post-user')">Probar (crear usuario)</button>
    <div class="result" id="result-post-user"></div>
  </div>

  <div class="endpoint">
    <span class="method delete">DELETE</span>
    <span class="path">/users/:id</span>
    <p class="desc">Elimina un usuario por su ID.</p>
    <pre><code>curl -X DELETE ${baseUrl}/users/1</code></pre>
    <button onclick="testEndpoint('DELETE', '/users/1', null, 'result-delete-user')">Probar (id=1)</button>
    <div class="result" id="result-delete-user"></div>
  </div>

  <script>
    async function testEndpoint(method, path, body, resultId) {
      const el = document.getElementById(resultId);
      el.textContent = 'Cargando...';
      el.classList.add('visible');
      try {
        const opts = { method, headers: {} };
        if (body) {
          opts.headers['Content-Type'] = 'application/json';
          opts.body = JSON.stringify(body);
        }
        const res = await fetch(path, opts);
        const data = await res.json();
        el.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        el.textContent = 'Error: ' + err.message;
      }
    }

    async function testChat() {
      const el = document.getElementById('result-chat');
      el.textContent = '';
      el.classList.add('visible');
      try {
        const res = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'Di hola en una frase corta' }] })
        });
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          el.textContent += decoder.decode(value, { stream: true });
        }
      } catch (err) {
        el.textContent = 'Error: ' + err.message;
      }
    }
  </script>
</body>
</html>`;
}
