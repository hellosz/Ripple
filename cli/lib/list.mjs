import { apiJson } from "./api.mjs";

export async function list(config) {
  const data = await apiJson("/skills?page_size=50&sort_by=updated_at", config);
  const skills = data.items || [];

  if (!skills.length) {
    console.log("\n  No skills available.\n");
    return;
  }

  console.log(`\n  ${skills.length} skill(s) available:\n`);

  const maxName = Math.max(...skills.map((s) => s.name.length), 4);

  for (const s of skills) {
    const name = s.name.padEnd(maxName);
    const rating = s.rating || "-";
    const cat = (s.category || "").padEnd(12);
    const desc = s.description
      ? s.description.length > 50
        ? s.description.slice(0, 50) + "..."
        : s.description
      : "";
    console.log(`  ${rating}  ${name}  ${cat}  ${desc}`);
  }

  console.log();
}
