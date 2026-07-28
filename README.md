# Documents generator

Project is using bun to run.

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Marp presentations

The presentation feature stores one presentation per course topic in an independent
Git repository for each course. By default the repositories are created in
`./presentations/course-<id>`. Override the root directory in production:

```bash
PRESENTATIONS_DIR=/uploads/presentations
```

Diagram source files and the SVG files rendered by Kroki are committed together.
By default diagrams are rendered by `https://kroki.sergkh.com`. Configure a
different self-hosted Kroki endpoint without a trailing path when needed:

```bash
KROKI_BASE_URL=http://localhost:8000
```

Topic names and indices may change. Presentation links use the immutable topic
`uid` stored with each topic instead.
