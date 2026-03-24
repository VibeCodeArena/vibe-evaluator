# Vibe Evaluator GitHub Action

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/github/v/tag/VibeCodeArena/vibe-evaluator)

A reusable GitHub Action that:
- Uploads your repository to a backend
- Triggers the evaluation process
- Provides a direct link to the results on the **Vibe Code Arena website**
- Works with both **private and public repositories**

---

## Inputs

| Name      | Description                                                                 | Required | Default |
|-----------|-----------------------------------------------------------------------------|----------|---------|
| isPrivate | Set to true to make the code private in Vibe Code Arena. Always private for private repositories. | false    | "false" |

---

## Evaluation Results

The evaluation process typically takes about **one hour** to complete. Once finished, you can access the detailed summary and results on our website.

The GitHub Action will output a workflow notice containing a direct link to your evaluation results (e.g., `https://vibecodearena.ai/duel/PROMPT_ID/RESPONSE_ID`).

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
        with:
          isPrivate: "false"
```

## Maintainer Build Instructions

```bash
npm install
npx husky init
npm run build
npm run start
```
