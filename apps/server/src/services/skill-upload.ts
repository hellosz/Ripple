import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import {
  buildInstallCommand,
  extractTextFiles,
  hasAgentsDirectory,
  rateSkill,
  validateSkillZip,
} from '@ripple/skill-core';
import type { SkillUploadForm } from '@ripple/contract';
import type { Db } from '../db/client.js';
import { skillFiles, skillVersions, skills } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import type { StorageService } from './storage.js';
import type { SkillRow } from '../lib/serialize.js';

export interface UploadOutcome {
  skill: SkillRow;
  rating: 'S' | 'A' | 'B' | 'C';
  suggestions: string[];
  isUpdate: boolean;
  version: string;
}

export async function uploadSkill(
  db: Db,
  storage: StorageService,
  params: {
    data: Uint8Array;
    fileName: string;
    form: SkillUploadForm;
    authorId: string;
  },
): Promise<UploadOutcome> {
  const validation = validateSkillZip(params.data);
  if (!validation.ok || !validation.meta || !validation.entries) {
    throw AppError.badRequest(validation.error ?? 'Invalid skill package', 'invalid_package');
  }
  const { meta, entries, skillRoot } = validation;

  const existingRows = await db.select().from(skills).where(eq(skills.name, meta.name)).limit(1);
  const existing = existingRows[0];
  if (existing && existing.author_id !== params.authorId) {
    throw AppError.conflict(`Skill '${meta.name}' belongs to another author`, 'name_taken');
  }

  const records = extractTextFiles(entries, skillRoot ?? '');
  const skillMd = records.find((r) => r.path === 'SKILL.md');
  if (!skillMd) throw AppError.badRequest('SKILL.md must be at the skill root', 'invalid_package');

  const { rating, suggestions } = rateSkill(
    skillMd.content,
    { description: meta.description },
    hasAgentsDirectory(records.map((r) => r.path)),
  );

  const checksum = createHash('sha256').update(params.data).digest('hex');
  const storageKey = `${meta.name}/${meta.version}/${checksum}.zip`;
  await storage.putPackage(storageKey, params.data);

  const installCommand = buildInstallCommand(meta.name);
  const tags = params.form.tags
    ? params.form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : (meta.tags ?? []);

  const skillValues = {
    display_name: meta.display_name ?? meta.name,
    description: meta.description,
    recommendation: params.form.recommendation,
    origin_type: params.form.origin_type,
    rating,
    version: meta.version,
    tags,
    category: params.form.category ?? meta.category,
    install_command: installCommand,
    package_file_name: params.fileName,
    package_storage_path: storageKey,
    package_checksum: checksum,
    publish_channel: params.form.publish_channel,
    updated_at: new Date(),
  };

  let skill: SkillRow;
  if (existing) {
    const rows = await db
      .update(skills)
      .set(skillValues)
      .where(eq(skills.id, existing.id))
      .returning();
    skill = rows[0]!;
  } else {
    const rows = await db
      .insert(skills)
      .values({ ...skillValues, name: meta.name, author_id: params.authorId })
      .returning();
    skill = rows[0]!;
  }

  // 同版本旧文本记录先删后写
  await db
    .delete(skillFiles)
    .where(and(eq(skillFiles.skill_id, skill.id), eq(skillFiles.version, meta.version)));
  if (records.length > 0) {
    await db.insert(skillFiles).values(
      records.map((r) => ({
        skill_id: skill.id,
        version: meta.version,
        path: r.path,
        content: r.content,
        language: r.language,
        size: r.size,
        sha256: r.sha256,
      })),
    );
  }

  await db.insert(skillVersions).values({
    skill_id: skill.id,
    version: meta.version,
    category: skill.category,
    recommendation: skill.recommendation,
    origin_type: skill.origin_type,
    rating,
    install_command: installCommand,
    package_file_name: params.fileName,
    package_storage_path: storageKey,
    package_checksum: checksum,
    author_id: params.authorId,
  });

  return { skill, rating, suggestions, isUpdate: Boolean(existing), version: meta.version };
}
