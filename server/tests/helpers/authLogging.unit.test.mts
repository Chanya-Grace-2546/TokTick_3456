import { expect, it, vi } from 'vitest';
const database=vi.hoisted(()=>({session:{findUnique:vi.fn()}}));
vi.mock('../../src/prisma.js',()=>({getPrisma:()=>database}));
import { requireAuth } from '../../src/auth.js';
it('authentication failures do not log raw SQL, session tokens or connection credentials',async()=>{
  const privateDiagnostic='postgresql://private:password@host/database SQL session-token';
  database.session.findUnique.mockRejectedValueOnce(new Error(privateDiagnostic));
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()};
  try {
    await requireAuth({cookies:{toktickit_session:'opaque'}} as any,res,vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({error:'UNEXPECTED_ERROR'});
    expect(log.mock.calls.flat().map(String).join(' ')).not.toContain(privateDiagnostic);
  } finally {log.mockRestore();}
});
