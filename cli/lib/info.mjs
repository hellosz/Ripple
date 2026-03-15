import { apiJson } from "./api.mjs";

export async function info(name, config) {
  let skill;
  try {
    skill = await apiJson(`/skills/${name}`, config);
  } catch (err) {
    throw new Error(`Skill "${name}" not found (${err.message})`);
  }

  console.log();
  console.log(`  ${skill.display_name}`);
  console.log(`  ${"─".repeat(40)}`);
  console.log(`  Name      : ${skill.name}`);
  console.log(`  Version   : ${skill.version}`);
  console.log(`  Rating    : ${skill.rating}`);
  console.log(`  Category  : ${skill.category || "-"}`);
  console.log(`  Origin    : ${skill.origin_type}`);
  console.log(`  Author    : ${skill.author?.nickname || skill.author?.email || "-"}`);

  if (skill.tags?.length) {
    console.log(`  Tags      : ${skill.tags.join(", ")}`);
  }

  if (skill.description) {
    console.log();
    console.log(`  ${skill.description}`);
  }

  if (skill.stats) {
    console.log();
    console.log(`  Downloads : ${skill.stats.download_count}`);
    console.log(`  Likes     : ${skill.stats.like_count}`);
    console.log(`  Ripples   : ${skill.stats.ripple_count}`);
  }

  console.log();
  console.log(`  Install: npx ripple install ${skill.name}`);
  console.log();
}
