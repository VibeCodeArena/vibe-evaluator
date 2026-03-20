# Vibe Evaluator GitHub Action

A reusable GitHub Action that:
- Uploads your repository to a backend
- Triggers evaluation
- Polls for progress
- Returns a final summary

---

## Features

- Works with **private and public repositories**
- Uploads to S3 via presigned URL
- Polls backend every 30 seconds
- Timeout after 20 minutes
- Outputs final evaluation summary

---

## Outputs

| Name     | Description                  |
|----------|------------------------------|
| summary  | JSON result from backend     |

---

## Usage

```yaml
name: Evaluate Repository

on: [push]

jobs:
  evaluate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Run Vibe Evaluator
        uses: VibeCodeArena/vibe-evaluator@v1
```

## Maintainer Build Instructions

```bash
npm install
npx husky init
npm run build
npm run start
```
