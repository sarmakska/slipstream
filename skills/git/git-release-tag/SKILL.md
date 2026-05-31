---
name: git-release-tag
description: >-
  Use when cutting a release: tag a release with an annotated semantic version
  and push the tag.
slipstream:
  category: git
  requires:
    - git-conventional-commit
  verification:
    kind: command
    description: The tag exists.
    command: 'git tag --list {{version}}'
    expect: '{{version}}'
  tags:
    - git
    - release
---

## Overview

Tag a release with an annotated semantic version and push the tag.

## Steps

1. Update the changelog and version field.
2. Create an annotated tag with `git tag -a {{version}} -m '{{version}}'`.
3. Push the tag with `git push origin {{version}}`.

## Verify

Run `git tag --list {{version}}` and confirm the tag is listed.
