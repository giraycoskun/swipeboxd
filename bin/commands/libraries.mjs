import { apiGet } from "../lib/http.mjs";

export const libraries = {
  summary: "Libraries the provider exposes, and which are included",
  async run(ctx) {
    return apiGet(ctx, "/libraries");
  },
  human(body) {
    const d = body.data;
    if (!d.libraries.length) return "No libraries reported by the provider.";
    const rows = d.libraries.map(
      (library) => `${library.included ? "[x]" : "[ ]"} ${library.name}  (${library.type ?? "unknown"}, ${library.id})`
    );
    const included = d.libraries.filter((library) => library.included).length;
    rows.push(
      d.includedIsEverything
        ? `included: everything (${d.libraries.length} libraries)`
        : `included: ${included} of ${d.libraries.length}`
    );
    return rows.join("\n");
  },
};
