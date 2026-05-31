---
name: resend-domain
description: 'Add and verify a custom sending domain so email lands in the inbox, not spam.'
claudepilot:
  category: resend
  requires:
    - resend-setup
  verification:
    kind: command
    description: DNS records resolve.
    command: 'dig +short TXT {{domain}}'
  tags:
    - resend
    - email
    - deliverability
---

## Overview

Add and verify a custom sending domain so email lands in the inbox, not spam.

## Steps

1. Add the domain in the Resend dashboard and copy the SPF, DKIM and DMARC records.
2. Create those DNS records at your provider.
3. Wait for Resend to mark the domain as verified.

## Verify

Run a DNS lookup for the domain's TXT records and confirm the SPF and DKIM entries are present.
