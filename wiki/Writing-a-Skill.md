# Writing a skill

A skill is a small, single-purpose unit of know-how that Claude Code can invoke. claudepilot skills are ordinary Claude Code agent skills with a verification gate. Here is how to write one that passes the validator and scales to a library of hundreds.

## Layout

Create a directory named after the skill, with a `SKILL.md` inside:

```
skills/<category>/<skill-name>/SKILL.md
```

The directory name must match the `name` in the frontmatter. The validator enforces this.

## Frontmatter

```yaml
---
name: resend-transactional
description: Use when sending a transactional email such as a receipt or password reset. Sends through Resend and verifies the API accepts the message.
claudepilot:
  category: resend
  requires:
    - resend-setup
  verification:
    kind: smoke
    description: A test send returns a message id.
    command: node scripts/send-test-email.mjs
    expect: id
  tags:
    - resend
    - email
---
```

- `name`: kebab case, lower case. Stable id and directory name.
- `description`: the relevance text Claude Code uses to decide when the skill fires. Start it with when to use the skill, then say what it does. Be specific; a vague description never fires at the right time.
- `claudepilot.category`: one of the known categories.
- `claudepilot.verification`: required for shipping skills. Pick the cheapest honest check that proves the step worked.
- `claudepilot.requires`: list any prerequisite skills by name.

## Body

Two sections are required, `## Steps` and `## Verify`:

```markdown
## Steps

1. Concrete, ordered actions. Reference real commands and files.
2. Keep each step small enough to follow without guessing.

## Verify

Tie the verification back to the gate: what a passing check looks like and what
to do if it fails.
```

## Choosing a gate

| kind | proves | typical command |
|---|---|---|
| typecheck | the code type-checks | `pnpm typecheck` |
| build | the project builds | `pnpm build` |
| test | the tests pass | `pnpm test` |
| smoke | a runtime path works | a small script that exits non-zero on failure |
| healthcheck | a deploy is live | `curl -fsS -o /dev/null -w '%{http_code}' <url>` with `expect: "200"` |
| command | any other objective check | the command itself |

Use `expect` when a zero exit code is not enough and you need a substring in the output.

## Validate

```
pnpm build
pnpm plugin-validate
```

The validator checks your frontmatter, the gate, the body sections and the directory name, and fails on anything malformed. Fix the named issues and rerun until it prints `OK`.

## Conventions

- Single purpose. A skill that does one thing well is easier to recall and to gate than a sprawling one.
- UK English, no emojis, no em-dashes.
- Update `CHANGELOG.md` under `Unreleased` when you add a skill.

See [CONTRIBUTING](https://github.com/sarmakska/claudepilot/blob/main/CONTRIBUTING.md) for the full path.

---
SarmaLinux . sarmalinux.com . [Repository](https://github.com/sarmakska/claudepilot)
