# Vibe Evaluator GitHub Action

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/github/v/tag/VibeCodeArena/vibe-evaluator)

A reusable GitHub Action that:
- Uploads your repository to a backend
- Triggers evaluation
- Polls for progress
- Returns a final summary
- Works with **private and public repositories**

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
