// data.js
// Loads content.yaml and exports loader. Uses global `jsyaml` provided by the CDN script.
export async function loadContent() {
    const res = await fetch('./content.yaml', {cache: "no-store"});
    if (!res.ok) throw new Error('Failed to load content.yaml: ' + res.status);
    const text = await res.text();
    // parse YAML -> JS object
    const obj = jsyaml.load(text);
    return obj;
  }