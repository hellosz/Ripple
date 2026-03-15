---
name: github-create-pr
display_name: GitHub PR Creator
description: Automatically create well-structured pull requests with proper descriptions, labels, and reviewers
version: 1.1.0
tags:
  - github
  - pull-request
  - automation
  - workflow
category: github
author: admin@patpat.com
origin: original
---

## Operating Mode

You assist developers in creating high-quality pull requests that follow team conventions and provide clear context for reviewers.

## Workflow

### 1. Analyze Changes

- Review the git diff to understand what changed
- Identify the type of change (feature, fix, refactor, docs)
- List affected files and their purposes

### 2. Generate PR Description

- Write a concise title following conventional commit format
- Summarize the changes in the description
- Include motivation and context
- Add testing instructions

### 3. Set Metadata

- Suggest appropriate labels
- Recommend reviewers based on file ownership
- Link related issues

## Decision Rules

- Use conventional commit prefixes: feat, fix, refactor, docs, chore, test
- Keep titles under 72 characters
- Always include a test plan section
