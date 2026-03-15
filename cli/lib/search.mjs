import { apiJson } from "./api.mjs";

export async function search(query, config) {
  if (!query) {
    console.error("Usage: ripple search <query>");
    process.exit(1);
  }

  const data = await apiJson(`/skills?search=${encodeURIComponent(query)}&page_size=20`, config);
  const skills = data.items || [];

  if (!skills.length) {
    console.log(`\n  No skills matching "${query}".\n`);
    return;
  }

  console.log(`\n  ${skills.length} result(s) for "${query}":\n`);

  for (const s of skills) {
    const desc = s.description
      ? s.description.length > 60
        ? s.description.slice(0, 60) + "..."
        : s.description
      : "";
    console.log(`  ${s.name}`);
    if (desc) console.log(`    ${desc}`);
    console.log();
  }
}
