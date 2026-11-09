const MANIFEST_NAMES = new Set([
  "pom.xml", "package.json", "compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml",
]);
const IGNORED_DIRECTORIES = new Set([
  "node_modules", "target", "build", "dist", "venv", "vendor", "coverage",
]);
const MAX_FILE_BYTES = 1024 * 1024;

export async function readFolderManifests(files: File[]) {
  const name = files[0]?.webkitRelativePath.split("/")[0];
  if (!name) throw new Error("Selecciona una carpeta de tu ordenador.");

  const selected: { path: string; file: File }[] = [];
  let totalBytes = 0;
  for (const file of files) {
    if (!MANIFEST_NAMES.has(file.name)) continue;
    const [folder, ...segments] = file.webkitRelativePath.split("/");
    if (folder !== name || segments.length === 0 || segments.length > 12 ||
      segments.slice(0, -1).some((part) => part.startsWith(".") || IGNORED_DIRECTORIES.has(part))) continue;

    totalBytes += file.size;
    if (file.size > MAX_FILE_BYTES || totalBytes > 10 * MAX_FILE_BYTES || selected.length >= 200) {
      throw new Error("Elige una carpeta con hasta 200 manifiestos, de 1 MiB por archivo y 10 MiB en total como máximo.");
    }
    selected.push({ path: segments.join("/"), file });
  }
  if (selected.length === 0) {
    throw new Error("No se encontraron manifiestos compatibles. Busca una carpeta con pom.xml, package.json o un archivo de Docker Compose.");
  }

  const entries = await Promise.all(selected.map(async ({ path, file }) => [path, await file.text()] as const));
  return { name, manifests: Object.fromEntries(entries) };
}
