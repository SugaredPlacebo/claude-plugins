---
project_id: REPLACE_ME
primary_metric: val_loss
direction: minimize
epoch_time_seconds: 180
max_wall_time_minutes: 60
worker_id: null
plateau_threshold: 5
allowed_edit_globs:
  - "**/*"
forbidden_edit_globs:
  - ".git/**"
  - ".ml-research/**"
  - "node_modules/**"
  - "**/__pycache__/**"
---

# Research notes for this project

Freeform context the experiment-analyst reads each iteration. Use this for:

- High-level research goal (e.g., "minimize val_loss on the held-out test set; secondary: keep params under 5M").
- Known dead-ends ("tried label smoothing in iter 003-007, no help").
- Out-of-scope changes ("don't touch the data loader, the upstream team owns it").
- Constraints ("max batch size 64 due to VRAM", "must keep ONNX-exportable").

Keep this file under ~500 words. Long-form findings go in `experiments.md`.
