import { LowSync, MemorySync } from 'lowdb';
import { describe, expect, it } from 'vitest';
import { createLocalBackend } from '../src/connect';
import { emptyLocalData, LocalStore, type LocalData } from '../src/store/local';
import { arrayRemove, arrayUnion, increment, where } from '../src/store/types';
import { localEnv } from './env';
import { registerSuites } from './suites';

describe('modo local (lowdb)', () => {
  registerSuites(localEnv);
});

describe('armazenamento local', () => {
  const store = () => {
    const db = new LowSync<LocalData>(new MemorySync<LocalData>(), emptyLocalData());
    return new LocalStore(db);
  };

  it('filtra como o Firestore e aplica incremento e listas', async () => {
    const local = store();
    await local.commit([
      { type: 'set', path: 'itens', id: 'a', data: { id: 'a', n: 1, tags: ['x'], start: '2026-10-12' } },
      { type: 'set', path: 'itens', id: 'b', data: { id: 'b', n: 2, tags: [], start: null } },
    ]);
    expect((await local.list<{ id: string }>('itens', [where('start', '>=', '2026-10-01')])).map((d) => d.id)).toEqual(['a']);
    expect(await local.list('itens', [where('tags', 'array-contains', 'x')])).toHaveLength(1);
    await local.commit([{ type: 'update', path: 'itens', id: 'a', data: { n: increment(4), tags: arrayUnion('y', 'x') } }]);
    await local.commit([{ type: 'update', path: 'itens', id: 'b', data: { tags: arrayRemove('z'), extra: undefined } }]);
    expect(await local.get('itens', 'a')).toMatchObject({ n: 5, tags: ['x', 'y'] });
    expect(await local.get('itens', 'b')).not.toHaveProperty('extra');
  });

  it('lote com erro não grava nada', async () => {
    const local = store();
    await expect(
      local.commit([
        { type: 'set', path: 'itens', id: 'a', data: { id: 'a' } },
        { type: 'update', path: 'itens', id: 'inexistente', data: { n: 1 } },
      ]),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await local.get('itens', 'a')).toBeNull();
  });

  it('não guarda a senha em texto puro e mantém a sessão no armazenamento', async () => {
    const adapter = new MemorySync<LocalData>();
    const backend = createLocalBackend({ adapter });
    await backend.session.signup({ name: 'Ana', email: 'ana@exemplo.com', password: 'senha-segura' });
    const raw = JSON.stringify(adapter.read());
    expect(raw).not.toContain('senha-segura');
    // Outra "aba" com o mesmo armazenamento já abre logada.
    const again = createLocalBackend({ adapter });
    expect((await again.session.get())?.user.email).toBe('ana@exemplo.com');
  });

  it('excluir workspace não deixa nenhum documento dele no armazenamento', async () => {
    const adapter = new MemorySync<LocalData>();
    const backend = createLocalBackend({ adapter });
    const session = await backend.session.startDemo();
    const wid = session.workspaces[0]!.id;
    const [project] = await backend.projects.list(wid);
    await backend.projects.update(wid, project!.id, { pinned: true });
    await backend.timeEntries.start(wid, { description: 'Rodando' });
    const other = await backend.workspaces.create('Pessoal');
    await backend.session.switchWorkspace(wid);
    await backend.workspaces.remove(wid);
    const data = adapter.read()!;
    expect(Object.keys(data.collections).filter((path) => path.includes(wid))).toEqual([]);
    expect(data.collections.workspaces?.[wid]).toBeUndefined();
    expect(data.collections.workspaces?.[other.id]).toBeDefined();
    expect(data.collections.users?.[session.user.id]).toMatchObject({
      currentWorkspaceId: other.id,
      runningEntry: null,
      pinnedProjectIds: [],
    });
  });

  it('demonstração local entra com a conta de exemplo', async () => {
    const backend = createLocalBackend({ adapter: new MemorySync<LocalData>() });
    const session = await backend.session.startDemo();
    expect(session.user.email).toBe('demo@exemplo.com');
    expect(session.workspaces[0]!.name).toBe('Estúdio Aurora');
    expect(await backend.projects.list(session.workspaces[0]!.id)).toHaveLength(4);
    await backend.session.logout();
    // Segunda vez só entra, sem criar outro workspace.
    const again = await backend.session.startDemo();
    expect(again.workspaces).toHaveLength(1);
  });
});
