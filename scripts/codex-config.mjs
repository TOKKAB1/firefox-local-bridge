export function configureCodex(text, entry) {
  const heading = /^\[mcp_servers\.firefox_local_bridge\][ \t]*\r?$/m;
  if (/^\[mcp_servers\.["']firefox_local_bridge["']\]/m.test(text)) throw new Error("Quoted Firefox MCP section found. Use the generated connection settings to update it manually.");
  const match = heading.exec(text);
  const values = { command: JSON.stringify(entry.command), args: JSON.stringify(entry.args), tool_timeout_sec: "120" };
  if (!match) {
    return text + (text.endsWith("\n") || !text ? "" : "\n") + "\n[mcp_servers.firefox_local_bridge]\n" + Object.entries(values).map(([key, value]) => key + " = " + value).join("\n") + "\n";
  }
  const bodyStart = match.index + match[0].length;
  const next = /^\[/m.exec(text.slice(bodyStart + 1));
  const end = next ? bodyStart + 1 + next.index : text.length;
  let body = text.slice(bodyStart, end);
  if (/^url\s*=/m.test(body)) throw new Error("This MCP name belongs to an HTTP server. Choose a different name or configure manually.");
  if (/^args\s*=/m.test(body) && !/^args[ \t]*=[ \t]*\[[^\r\n]*\][ \t]*(?:#.*)?$/m.test(body)) throw new Error("Multiline MCP arguments found. Use the generated settings to update this entry manually.");
  if (/^command\s*=\s*(?:"""|''')/m.test(body)) throw new Error("Multiline MCP command found. Configure this entry manually.");
  for (const [key, value] of Object.entries(values)) {
    const line = new RegExp("^" + key + "[ \\t]*=.*$", "m");
    if (line.test(body)) body = body.replace(line, key + " = " + value);
    else body = "\n" + key + " = " + value + body;
  }
  return text.slice(0, bodyStart) + body + (body.endsWith("\n") ? "" : "\n") + text.slice(end);
}
