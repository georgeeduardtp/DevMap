const MANIFEST_NAMES = new Set([
  "pom.xml", "package.json", "compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml",
]);
const COMMAND_FILES = new Set(["readme", "readme.md", "readme.markdown", "makefile", "gnumakefile"]);
const CONTAINER_FILE = /^(?:(?:dockerfile|containerfile)(?:\..+)?|.+\.(?:dockerfile|containerfile))$/;
const IGNORED_DIRECTORIES = new Set([
  "node_modules", "target", "build", "dist", "venv", "vendor", "coverage",
]);
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_DEPTH = 12;

export type FolderSource = File[] | FileSystemDirectoryHandle;

function isSupportedFile(filename: string) {
  const name = filename.toLowerCase();
  return MANIFEST_NAMES.has(filename) || COMMAND_FILES.has(name) ||
    (!name.startsWith(".") && !name.endsWith(".dockerignore") && CONTAINER_FILE.test(name));
}

function isIgnoredDirectory(name: string) {
  return name.startsWith(".") || IGNORED_DIRECTORIES.has(name);
}

export async function readFolderManifests(source: FolderSource, onRead?: (completed: number, total: number) => void) {
  const name = Array.isArray(source) ? source[0]?.webkitRelativePath.split("/")[0] : source.name;
  if (!name) throw new Error("Selecciona una carpeta de tu ordenador.");

  const selected: { path: string; file: File }[] = [];
  let totalBytes = 0;

  function addManifest(path: string, file: File) {
    totalBytes += file.size;
    if (file.size > MAX_FILE_BYTES || totalBytes > 10 * MAX_FILE_BYTES || selected.length >= 200) {
      throw new Error("Elige una carpeta con hasta 200 manifiestos, de 1 MiB por archivo y 10 MiB en total como máximo.");
    }
    selected.push({ path, file });
  }

  async function walkDirectory(directory: FileSystemDirectoryHandle, prefix: string, depth: number) {
    for await (const entry of directory.values()) {
      const path = prefix + entry.name;
      if (entry.kind === "directory") {
        if (depth + 1 < MAX_DEPTH && !isIgnoredDirectory(entry.name)) {
          await walkDirectory(entry as FileSystemDirectoryHandle, `${path}/`, depth + 1);
        }
      } else if (isSupportedFile(entry.name)) {
        const file = await (entry as FileSystemFileHandle).getFile();
        addManifest(path, file);
      }
    }
  }

  if (Array.isArray(source)) {
    for (const file of source) {
      if (!isSupportedFile(file.name)) continue;
      const [folder, ...segments] = file.webkitRelativePath.split("/");
      if (folder !== name || segments.length === 0 || segments.length > MAX_DEPTH ||
        segments.slice(0, -1).some(isIgnoredDirectory)) continue;

      addManifest(segments.join("/"), file);
    }
  } else {
    await walkDirectory(source, "", 0);
  }

  if (selected.length === 0) {
    throw new Error("No se encontraron archivos compatibles. Busca un manifiesto, un README o un Makefile.");
  }

  let completed = 0;
  let reading = true;
  onRead?.(completed, selected.length);
  try {
    const entries = await Promise.all(selected.map(async ({ path, file }) => {
      const content = await file.text();
      if (reading) onRead?.(++completed, selected.length);
      return [path, content] as const;
    }));
    return { name, manifests: Object.fromEntries(entries) };
  } finally {
    reading = false;
  }
}
