import { getUsers, getUserById, insertUser, deleteUser } from '../db';
import { jsonResponse } from '../utils/response';

export async function handleUsers(req: Request, url: URL, pathname: string): Promise<Response | null> {
  const idMatch = pathname.match(/^\/users\/(\d+)$/);

  // GET /users
  if (req.method === 'GET' && pathname === '/users') {
    try {
      const limit = Number(url.searchParams.get('limit')) || 50;
      const users = await getUsers(limit);
      return jsonResponse(users);
    } catch (err) {
      console.error('[request] Error in GET /users:', (err as Error).message);
      return jsonResponse({ error: (err as Error).message }, 500);
    }
  }

  // GET /users/:id
  if (req.method === 'GET' && idMatch) {
    try {
      const user = await getUserById(Number(idMatch[1]));
      if (!user) return jsonResponse({ error: 'User not found' }, 404);
      return jsonResponse(user);
    } catch (err) {
      console.error('[request] Error in GET /users/:id:', (err as Error).message);
      return jsonResponse({ error: (err as Error).message }, 500);
    }
  }

  // POST /users
  if (req.method === 'POST' && pathname === '/users') {
    try {
      const { name, email } = await req.json() as { name: string; email: string };
      if (!name || !email) {
        return jsonResponse({ error: 'Missing required fields: name, email' }, 400);
      }
      const user = await insertUser(name, email);
      return jsonResponse(user, 201);
    } catch (err) {
      console.error('[request] Error in POST /users:', (err as Error).message);
      return jsonResponse({ error: (err as Error).message }, 500);
    }
  }

  // DELETE /users/:id
  if (req.method === 'DELETE' && idMatch) {
    try {
      const user = await deleteUser(Number(idMatch[1]));
      if (!user) return jsonResponse({ error: 'User not found' }, 404);
      return jsonResponse(user);
    } catch (err) {
      console.error('[request] Error in DELETE /users/:id:', (err as Error).message);
      return jsonResponse({ error: (err as Error).message }, 500);
    }
  }

  return null;
}
