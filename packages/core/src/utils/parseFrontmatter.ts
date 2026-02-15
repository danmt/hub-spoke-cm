/**
 * LIGHTWEIGHT STATEFUL YAML PARSER (Mobile-Friendly)
 * Optimized for React Native environments where gray-matter is unavailable.
 */
export function parseFrontmatter(raw: string): {
  data: Record<string, any>;
  content: string;
} {
  const regex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = raw.match(regex);

  if (!match) return { data: {}, content: raw };

  const yamlBlock = match[1];
  const content = match[2];
  const data: Record<string, any> = {};

  const lines = yamlBlock.split("\n");
  let activeKey: string | null = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect Key: Value or Key: (start of block)
    // We ensure we don't treat list items containing colons as new keys
    if (trimmed.includes(":") && !trimmed.startsWith("-")) {
      const firstColon = line.indexOf(":");
      const key = line.slice(0, firstColon).trim();
      const value = line
        .slice(firstColon + 1)
        .trim()
        .replace(/^['"]|['"]$/g, "");

      activeKey = key;
      // If there is no value, we leave it empty to be filled by list items or kept as empty string
      data[key] = value;
    }
    // Detect List Items (- item)
    else if (trimmed.startsWith("-") && activeKey) {
      const listItem = trimmed
        .replace(/^-/, "")
        .trim()
        .replace(/^['"]|['"]$/g, "");

      // If it's the first item found for this key, initialize the array
      if (!Array.isArray(data[activeKey])) {
        // If the key had a standalone value (e.g. key: val \n - item),
        // we convert the existing value to the first element of the array
        const existingValue = data[activeKey];
        data[activeKey] = existingValue
          ? [existingValue, listItem]
          : [listItem];
      } else {
        // Otherwise just push to the existing array
        data[activeKey].push(listItem);
      }
    }
  });

  return { data, content };
}
