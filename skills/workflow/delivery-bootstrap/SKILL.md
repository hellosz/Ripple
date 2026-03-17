---
name: delivery-bootstrap
description: Use when starting a new requirement in vesta-platform and you need to create the standard delivery directory and document set before clarification and technical design.
---

# delivery-bootstrap

## When To Use
Use this skill when the user wants to:
- start a new requirement
- initialize a delivery directory
- create the standard delivery documents for a ticket
- set up the requirement workspace before clarification and technical design

Typical requests:
- "帮我初始化一个需求目录"
- "帮我开始一个新需求"
- "帮我创建需求交付目录"
- "帮我生成需求文档骨架"

Do not use this skill for:
- editing an existing delivery directory
- generating a technical solution
- generating testing or release documents

## Required Inputs
Collect these fields before running the tool:
- `ticket_id`
- `ticket_title`
- `owner`
- `delivery_slug`

Optional fields:
- `target_branch`
- `target_version`
- `date`

If any required field is missing:
1. infer it from context if it is explicit and reliable
2. otherwise ask for only the missing minimum fields
3. do not invent ticket ids or slugs

## Process
1. Confirm that this is a new requirement bootstrap request.
2. Gather the required fields.
3. Run the repository tool:

```bash
node tools/scripts/init-delivery.mjs \
  --ticket-id <ticket_id> \
  --ticket-title "<ticket_title>" \
  --owner <owner> \
  --delivery-slug <delivery_slug>
```

4. If optional fields exist, also pass:
- `--target-branch`
- `--target-version`
- `--date`
5. Verify that the target directory was created under `docs/deliveries/`.
6. Verify that these files exist:
- `01-需求澄清.md`
- `02-技术方案.md`
- `03-提测文档.md`
- `04-上线文档.md`
7. Tell the user what was created and what the next step is.

## Output
Always report:
- the created delivery directory
- the created document files
- the next recommended action

The next action should be:
1. complete `01-需求澄清.md`
2. then move to `02-技术方案.md`

## Guardrails
- Do not skip the clarification phase.
- Do not overwrite an existing delivery directory.
- Do not fabricate technical solution content during bootstrap.
- Do not create a custom directory structure outside the repository standard.

## Success Criteria
This skill is successful only if:
- the delivery directory exists
- the four standard documents exist
- the user is guided to the clarification stage
