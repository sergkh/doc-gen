---
name: mcp-resource
description: Create MCP resources with registerResource + ResourceTemplate; use when exposing domain data as MCP resources instead of tools (list → URIs, fetch → contents). keywords: mcp resource, ResourceTemplate, list resources, read resource, URI template, contents, mimeType, json text.
---

# Skill: Create MCP Resource

## Purpose
Scaffold MCP resources using `server.registerResource` with `ResourceTemplate`. List handlers advertise resource URIs; fetch handlers return contents (e.g., JSON serialized to text).

## When to use
- Expose domain entities as MCP resources (not tools).
- Need a list endpoint that enumerates URIs and a fetch that returns data by URI.
- Modeling hierarchies (e.g., specialty → courses, user → profile, template → documents).

## Pattern
- `registerResource(name, new ResourceTemplate(templateUri, { list }), metadata, fetch)`
- **List handler** (`ctx: ServerContext`): return `{ resources: [{ uri, name, description? }] }` only.
- **Fetch handler** (`uri: URL, variables: Variables, ctx: ServerContext`): return `{ contents: [{ uri, text?, blob?, mimeType?, _meta? }] }` only.
- For JSON payloads: `text: JSON.stringify(payload)` and `mimeType: "application/json"`.
- `variables` may contain arrays; normalize `id` via `variables.id ?? uri.host`.

## Steps
1) Choose canonical URI template (e.g., `user://{userId}/profile`).
2) Implement list:
	 - Load parents (e.g., users, specialties).
	 - Map to resources with stable URIs and readable names/optional description.
	 - Return `{ resources }` (no contents here).
3) Implement fetch:
	 - Resolve and validate id from `variables` or `uri.host`.
	 - On invalid/missing: return `{ contents: [{ uri, text: "error" }] }`.
	 - Load entity; on not found: `{ contents: [{ uri, text: "not found" }] }`.
	 - Build payload, serialize to JSON string, return as contents with mimeType.
4) Metadata: set `title`, `description`, `mimeType` (usually application/json).
5) Logging: mandatory, minimal, contextual (sessionId, uri), avoid noise.

## Example (User profile)
```ts
server.registerResource(
	"user-profile",
	new ResourceTemplate("user://{userId}/profile", {
		list: async () => ({
			resources: [
				{ uri: "user://123/profile", name: "Alice" },
				{ uri: "user://456/profile", name: "Bob" },
			],
		}),
	}),
	{
		title: "User Profile",
		description: "User profile data",
		mimeType: "application/json",
	},
	async (uri, { userId }) => ({
		contents: [
			{
				uri: uri.href,
				text: JSON.stringify({ userId, name: "Example User" }),
				mimeType: "application/json",
			},
		],
	})
);
```

## Example (Specialty → Courses)
```ts
server.registerResource(
	"list_courses",
	new ResourceTemplate("specialty://{id}/courses", {
		list: async (ctx) => {
			const specs = await specialties.all();
			const resources = specs.map((spec) => ({
				uri: `specialty://${spec.id}/courses`,
				name: `${spec.code} ${spec.name}`,
				description: spec.area ? `Галузь: ${spec.area}` : undefined,
			}));
			return { resources };
		},
	}),
	{
		title: "Дисципліни спеціальностей",
		description: "Перелік дисциплін по спеціальностях",
		mimeType: "application/json",
	},
	async (uri, variables, ctx) => {
		const idVar = (variables as Record<string, string | string[] | undefined>)?.id ?? uri.host;
		const specialtyId = Number(idVar);
		if (!Number.isFinite(specialtyId)) {
			return { contents: [{ uri: uri.href, text: "Некоректний URI спеціальності." }] };
		}
		const specialty = await specialties.get(specialtyId);
		if (!specialty) {
			return { contents: [{ uri: uri.href, text: "Спеціальність не знайдено." }] };
		}
		const list = await courses.bySpecialty(specialty.id);
		const payload = {
			specialty: { id: specialty.id, code: specialty.code, name: specialty.name },
			courses: list.map((course) => ({
				id: course.id,
				name: course.name,
				okNo: course.data?.ok_no ?? null,
				teacher: course.teacher ?? null,
				uri: `discipline://${course.id}`,
			})),
		};
		return {
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: JSON.stringify(payload),
				},
			],
		};
	}
);
```

## Checklist
- list returns only `{ resources }` (no contents)
- fetch returns only `{ contents }`
- IDs normalized from `variables.id` or `uri.host`
- JSON serialized into `text` with `mimeType: application/json`
- URIs canonical and stable
- Errors as textual contents
- Minimal contextual logging

## Example prompts
- "Expose templates as MCP resources with list/fetch using the MCP resource skill."
- "Convert the teachers tool to an MCP resource (list teachers, fetch teacher profile)."
- "Add a resource to list courses per teacher using the resource pattern."