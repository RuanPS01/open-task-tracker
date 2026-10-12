// Testes diretos das regras do Firestore: tentativas que a web nunca faz, mas que
// alguém com o SDK na mão poderia fazer. Só rodam no emulador.
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomId } from '../src/store/types';
import { firebaseEnv, type Person, type TestEnv } from './env';

const hostPort = (value: string | undefined) => {
  const [host, port] = (value ?? '').split(':');
  return { host: host || '127.0.0.1', port: Number(port) };
};

export function registerRulesSuite(): void {
  describe('regras do Firestore', () => {
    let env: TestEnv;
    let ana: Person;
    let bruno: Person;
    let mallory: Person;
    const apps: FirebaseApp[] = [];

    /** Cliente cru do SDK, logado como a pessoa, sem passar pelos serviços. */
    async function raw(person: Person): Promise<Firestore> {
      const app = initializeApp(
        { apiKey: 'demo-key', authDomain: 'localhost', projectId: process.env.GCLOUD_PROJECT ?? 'demo-ott', appId: 'demo-app' },
        `regras-${randomId(8)}`,
      );
      apps.push(app);
      const firestore = hostPort(process.env.FIRESTORE_EMULATOR_HOST);
      const authHost = hostPort(process.env.FIREBASE_AUTH_EMULATOR_HOST);
      const db = initializeFirestore(app, {});
      connectFirestoreEmulator(db, firestore.host, firestore.port);
      const auth = getAuth(app);
      connectAuthEmulator(auth, `http://${authHost.host}:${authHost.port}`, { disableWarnings: true });
      await signInWithEmailAndPassword(auth, person.account.email, person.account.password);
      return db;
    }

    const denied = (promise: Promise<unknown>) => expect(promise).rejects.toMatchObject({ code: 'permission-denied' });

    beforeEach(async () => {
      env = await firebaseEnv();
      ana = await env.signup('Ana');
      const invite = await env.backend.members.createInvite(ana.workspaceId, { role: 'member' });
      bruno = await env.signup('Bruno');
      await env.backend.members.acceptInvite(ana.workspaceId, invite.id);
      mallory = await env.signup('Mallory');
      await env.loginAs(ana);
    });

    afterEach(async () => {
      await Promise.all(apps.splice(0).map((app) => deleteApp(app)));
      await env.dispose();
    });

    it('quem não é membro não lê nada do workspace nem o perfil de outra pessoa', async () => {
      const db = await raw(mallory);
      const wid = ana.workspaceId;
      await denied(getDoc(doc(db, 'workspaces', wid)));
      await denied(getDocs(collection(db, `workspaces/${wid}/tasks`)));
      await denied(getDocs(collection(db, `workspaces/${wid}/timeEntries`)));
      await denied(getDoc(doc(db, 'users', ana.uid)));
      await denied(setDoc(doc(db, `workspaces/${wid}/tasks/x`), { id: 'x', workspaceId: wid, name: 'Invasora' }));
    });

    it('membro comum não se promove nem mexe em feriados ou convites', async () => {
      const db = await raw(bruno);
      const wid = ana.workspaceId;
      await denied(updateDoc(doc(db, 'workspaces', wid), { adminIds: arrayUnion(bruno.uid) }));
      await denied(updateDoc(doc(db, `workspaces/${wid}/members/${bruno.uid}`), { role: 'admin' }));
      await denied(
        setDoc(doc(db, `workspaces/${wid}/holidays/2026-12-24`), { id: '2026-12-24', workspaceId: wid, date: '2026-12-24', name: 'X' }),
      );
      await denied(getDocs(collection(db, `workspaces/${wid}/invites`)));
      // O próprio nome pode mudar (perfil), o papel não.
      await updateDoc(doc(db, `workspaces/${wid}/members/${bruno.uid}`), { name: 'Bruno Lima' });
    });

    it('ninguém entra sem convite válido, nem com papel acima do convite', async () => {
      const wid = ana.workspaceId;
      const invite = await env.backend.members.createInvite(wid, { role: 'member', weeklyCapacityHours: 20 });
      const db = await raw(mallory);
      const member = (inviteId: string, role: string) => ({
        userId: mallory.uid,
        workspaceId: wid,
        name: 'Mallory',
        email: mallory.account.email,
        avatarColor: '#0b83d9',
        role,
        weeklyCapacityHours: 20,
        hourlyRate: null,
        active: true,
        joinedAt: new Date().toISOString(),
        inviteId,
      });
      const attempt = (inviteId: string, role: string, adminToo: boolean) => {
        const batch = writeBatch(db);
        batch.set(doc(db, `workspaces/${wid}/members/${mallory.uid}`), member(inviteId, role));
        batch.update(doc(db, 'workspaces', wid), {
          memberIds: arrayUnion(mallory.uid),
          ...(adminToo ? { adminIds: arrayUnion(mallory.uid) } : {}),
        });
        return batch.commit();
      };
      await denied(attempt('convite-inventado', 'member', false));
      await denied(attempt(invite.id, 'admin', true));
      await denied(attempt(invite.id, 'member', true));
      await attempt(invite.id, 'member', false);
    });

    it('apontamento: só o dono altera; outros membros só soltam a ligação', async () => {
      const wid = ana.workspaceId;
      const project = await env.backend.projects.create(wid, { name: 'Site', color: '#0b83d9' });
      const entry = await env.backend.timeEntries.create(wid, {
        projectId: project.id,
        description: 'Layout',
        start: '2026-10-12T12:00:00.000Z',
        stop: '2026-10-12T13:00:00.000Z',
      });
      const db = await raw(bruno);
      const ref = doc(db, `workspaces/${wid}/timeEntries/${entry.id}`);
      await denied(updateDoc(ref, { description: 'Editado por outra pessoa' }));
      await denied(updateDoc(ref, { userId: bruno.uid }));
      await denied(
        setDoc(doc(db, `workspaces/${wid}/timeEntries/falso`), {
          id: 'falso',
          workspaceId: wid,
          userId: ana.uid,
          start: '2026-10-12T12:00:00.000Z',
          stop: '2026-10-12T13:00:00.000Z',
        }),
      );
      await updateDoc(ref, { projectId: null, updatedAt: new Date().toISOString() });
    });
  });
}
