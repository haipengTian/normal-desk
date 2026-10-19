import { readdir, readFile, writeFile } from 'node:fs/promises';
const directory = new URL('../public/style/', import.meta.url);
const files = (await readdir(directory)).filter(file => file.endsWith('.css')).sort((a, b) => a === 'default.css' ? -1 : b === 'default.css' ? 1 : a.localeCompare(b));
function variables(section = '') {
  return Object.fromEntries([...section.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
}
const themes = await Promise.all(files.map(async file => {
  const css = await readFile(new URL(file, directory), 'utf8');
  return { id: file, name: file === 'default.css' ? 'Default' : file.replace('.css', '').split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' '),
    light: variables(css.match(/:root\s*\{([^}]+)\}/s)?.[1]), dark: variables(css.match(/\.dark\s*\{([^}]+)\}/s)?.[1]) };
}));
await writeFile(new URL('../shared/themes.generated.json', import.meta.url), JSON.stringify(themes, null, 2) + '\n');
console.log(`Prepared ${themes.length} local color themes.`);
