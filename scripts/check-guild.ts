// Check da barreira de servidor (sem framework): npx tsx scripts/check-guild.ts
// Interação de outro servidor é ignorada, comando administrativo exige Administrator na hora e o servidor oficial,
// DM segue funcionando e o /keymensal sem GUILD_ID recusa em vez de cair no primeiro servidor do cache.
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { guardInteraction } from "../src/utils/interactionGuard.js";
import { keyMensalCommand } from "../src/commands/keymensal.js";

const perms = (admin: boolean) => ({ has: (p: bigint) => admin && p === PermissionFlagsBits.Administrator });
const cmd = (commandName: string, guildId: string | null, admin: boolean) =>
  ({ guildId, commandName, isChatInputCommand: () => true, memberPermissions: guildId ? perms(admin) : null });
const button = (guildId: string | null) => ({ guildId, isChatInputCommand: () => false });

process.env.GUILD_ID = "oficial";

// Outro servidor: tudo ignorado, até com Administrator lá.
assert.equal(guardInteraction(cmd("sync", "alheio", true)), "ignore");
assert.equal(guardInteraction(cmd("userstatus", "alheio", true)), "ignore");
assert.equal(guardInteraction(cmd("vincular", "alheio", false)), "ignore");
assert.equal(guardInteraction(button("alheio")), "ignore", "botao/modal de outro servidor tambem");

// Servidor oficial: admin passa, sem Administrator recusa (mesmo com o comando liberado pra outro cargo).
for (const name of ["sync", "userstatus", "stats", "qa", "sorteio", "setup-verificar"]) {
  assert.equal(guardInteraction(cmd(name, "oficial", true)), "ok", name);
  assert.equal(guardInteraction(cmd(name, "oficial", false)), "forbidden", name);
}
assert.equal(guardInteraction(cmd("vincular", "oficial", false)), "ok");
assert.equal(guardInteraction(button("oficial")), "ok");

// DM: comandos de usuario e o /keymensal passam; admin no DM nao.
assert.equal(guardInteraction(cmd("vincular", null, false)), "ok");
assert.equal(guardInteraction(cmd("keymensal", null, false)), "ok");
assert.equal(guardInteraction(button(null)), "ok");
assert.equal(guardInteraction(cmd("sync", null, false)), "forbidden");

// Sem GUILD_ID: nenhum servidor vale (fecha em vez de abrir).
delete process.env.GUILD_ID;
assert.equal(guardInteraction(cmd("sync", "qualquer", true)), "ignore");

// /keymensal sem GUILD_ID: recusa, nunca usa o primeiro servidor do cache (onde o invocador seria admin).
const replies: string[] = [];
const alheio = { members: { fetch: async () => ({ roles: { cache: new Map() }, permissions: perms(true) }) } };
await keyMensalCommand.execute({
  guild: null,
  user: { id: "42" },
  client: { guilds: { cache: Object.assign(new Map([["alheio", alheio]]), { first: () => alheio }) } },
  deferReply: async () => {},
  editReply: async (m: string) => { replies.push(m); },
  options: { getUser: () => null }
} as any);
assert.match(replies[0] ?? "", /servidor não encontrado/, "sem GUILD_ID o keymensal recusa");

console.log("check-guild: ok");
