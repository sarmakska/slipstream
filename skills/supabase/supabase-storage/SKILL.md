---
name: supabase-storage
description: >-
  Use when the app stores user-uploaded files: create a storage bucket with
  policies for user uploaded assets.
slipstream:
  category: supabase
  requires:
    - supabase-rls
  verification:
    kind: command
    description: Storage policy migration applies.
    command: supabase db reset
    expect: Applying migration
  tags:
    - supabase
    - storage
---

## Overview

Create a storage bucket with policies for user uploaded assets.

## Steps

1. Create the `{{bucket}}` bucket, public or private as required.
2. Add storage policies so users can only write to a path prefixed by their user id.
3. Generate signed URLs for private downloads.

## Verify

Reset the database, upload a file as a user, and confirm another user cannot overwrite it.
