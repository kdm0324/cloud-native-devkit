// packages/cli/src/lib/io.ts
export const section = (title: string) => {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🧩 ${title}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
};

export const step = (msg: string) => console.log(`• ${msg}`);
export const ok = (msg: string) => console.log(`✅ ${msg}`);
export const warn = (msg: string) => console.log(`⚠️  ${msg}`);
export const info = (msg: string) => console.log(`ℹ️  ${msg}`);
export const err = (msg: string) => console.log(`❌ ${msg}`);

export const fail = (message: string, hint?: string) => {
  console.error(`\n❌ ${message}`);
  if (hint) console.error(`${hint}`);
  console.error();
  process.exit(1);
};
