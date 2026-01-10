---
title: Knowledge Graph
description: Visualize your codebase structure and dependencies
---

**Knowledge Graph** provides an interactive visualization of your codebase, showing how files and modules connect.

## How to Use

```bash
Code Coach: Show Knowledge Graph
```

A webview opens with your codebase visualization.

## What You See

### Nodes

Each node represents a file or module:

- **Size**: Based on complexity/lines of code
- **Color**:
  - 🟡 Gold - Team pinned
  - 🔴 Red - Frequently explained (hotspot)
  - 🔵 Blue - Normal
  - ⚪ Gray - External/node_modules

### Edges

Lines between nodes show:

- **Solid arrow**: Import/export relationship
- **Dashed arrow**: Type reference only
- **Direction**: Points to dependency

### Clusters

Related files are grouped:

```
┌─────────────────────┐
│ Authentication      │
│ ┌───┐ ┌───┐ ┌───┐   │
│ │ A ├─┤ B ├─┤ C │   │
│ └───┘ └───┘ └───┘   │
└─────────────────────┘
```

## Interactions

### Click Node

Opens Deep Dive for that symbol:

- View usages
- See history
- Read AI summary

### Hover

Shows quick info:

```
src/auth/validate.ts
├─ Lines: 145
├─ Exports: 4 functions
├─ Imports: 3 modules
├─ Team pins: 1
└─ Last modified: 2 days ago
```

### Filter

Show only what you need:

| Filter | Effect |
|--------|--------|
| By directory | `src/auth/**` |
| By type | Functions, classes, all |
| Hide tests | Remove `*.test.ts` |
| Hide node_modules | Remove externals |

### Search

Find nodes by name:

1. Press `/` or click search
2. Type symbol name
3. Graph centers on matches

### Focus

Zoom to neighborhood of current file:

```bash
Code Coach: Focus Knowledge Graph on Current File
```

## Configuration

### Show on Startup

```json
{
  "codeCoach.graph.showOnStartup": false
}
```

### Default Filters

```json
{
  "codeCoach.graph.defaultFilters": {
    "hideTests": true,
    "hideNodeModules": true,
    "directory": "src/"
  }
}
```

### Layout Algorithm

```json
{
  "codeCoach.graph.layout": "force" // or "hierarchy" or "radial"
}
```

## Export

Save the graph as an image:

```bash
Code Coach: Export Knowledge Graph
```

Formats: SVG, PNG

Use for:
- Documentation
- Architecture reviews
- Onboarding materials

## Use Cases

### Onboarding

New team members can:
1. Open Knowledge Graph
2. See overall architecture
3. Click modules to learn
4. Follow dependencies

### Impact Analysis

Before changing code:
1. Focus on the file
2. See what depends on it
3. Understand blast radius

### Architecture Review

During planning:
1. View full graph
2. Identify clusters
3. Spot tight coupling
4. Find isolated modules

### Documentation

Generate architecture diagrams:
1. Filter to relevant modules
2. Export as SVG
3. Include in docs

## Related Features

- [Team Pins](/team/pins/) - Highlighted in graph
- [Deep Dive](/features/deep-dive/) - Click node to analyze
- [Onboarding Tours](/team/tours/) - Guided exploration
