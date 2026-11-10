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
const MAX_DIRECTORIES = 1_000;
const MAX_DIRECTORY_PATH_LENGTH = 512;
const MAX_VISITED_ENTRIES = 20_000;

export type FolderSource = File[] | FileSystemDirectoryHandle;

function isSupportedFile(filename: string) {
  const name = filename.toLowerCase();
  return MANIFEST_NAMES.has(filename) || COMMAND_FILES.has(name) ||
    (!name.startsWith(".") && !name.endsWith(".dockerignore") && CONTAINER_FILE.test(name));
}

function isIgnoredDirectory(name: string) {
  return name.startsWith(".") || IGNORED_DIRECTORIES.has(name);
}

function isValidDirectory(name: string) {
  return !!name.trim() && !name.includes("\\") && !name.includes(":") && !Array.from(name).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159);
  });
}

export async function readFolderManifests(source: FolderSource, onRead?: (completed: number, total: number) => void) {
  const name = Array.isArray(source) ? source[0]?.webkitRelativePath.split("/")[0] : source.name;
  if (!name) throw new Error("Selecciona una carpeta de tu ordenador.");

  const selected: { path: string; file: File }[] = [];
  const directories = new Set<string>();
  let totalBytes = 0;
  let visited = 0;
  let partial = Array.isArray(source);

  function addDirectory(path: string) {
    if (directories.has(path)) return;
    if (directories.size >= MAX_DIRECTORIES || path.length > MAX_DIRECTORY_PATH_LENGTH) partial = true;
    else directories.add(path);
  }

  function addManifest(path: string, file: File) {
    totalBytes += file.size;
    if (file.size > MAX_FILE_BYTES || totalBytes > 10 * MAX_FILE_BYTES || selected.length >= 200) {
      throw new Error("Elige una carpeta con hasta 200 manifiestos, de 1 MiB por archivo y 10 MiB en total como máximo.");
    }
    selected.push({ path, file });
  }

  async function walkDirectory(directory: FileSystemDirectoryHandle, prefix: string, depth: number) {
    for await (const entry of directory.values()) {
      if (++visited > MAX_VISITED_ENTRIES) {
        partial = true;
        return;
      }
      const path = prefix + entry.name;
      if (entry.kind === "directory") {
        if (isIgnoredDirectory(entry.name)) continue;
        if (!isValidDirectory(entry.name)) {
          partial = true;
          continue;
        }
        addDirectory(path);
        if (depth + 1 < MAX_DEPTH) {
          await walkDirectory(entry as FileSystemDirectoryHandle, `${path}/`, depth + 1);
          if (visited > MAX_VISITED_ENTRIES) return;
        } else {
          partial = true;
        }
      } else if (isSupportedFile(entry.name)) {
        const file = await (entry as FileSystemFileHandle).getFile();
        addManifest(path, file);
      }
    }
  }

  if (Array.isArray(source)) {
    for (const file of source) {
      const [folder, ...segments] = file.webkitRelativePath.split("/");
      if (folder !== name || !segments.length) continue;
      const parents = segments.slice(0, -1);
      let path = "";
      for (const part of parents.slice(0, MAX_DEPTH)) {
        if (isIgnoredDirectory(part) || !isValidDirectory(part)) break;
        path = path ? `${path}/${part}` : part;
        addDirectory(path);
      }
      if (segments.length <= MAX_DEPTH && path === parents.join("/") && isSupportedFile(file.name)) {
        addManifest(segments.join("/"), file);
      }
    }
  } else {
    await walkDirectory(source, "", 0);
  }

  let completed = 0;
  let reading = true;
  if (selected.length) onRead?.(completed, selected.length);
  try {
    const entries = await Promise.all(selected.map(async ({ path, file }) => {
      const content = await file.text();
      if (reading) onRead?.(++completed, selected.length);
      return [path, content] as const;
    }));
    return { name, manifests: Object.fromEntries(entries), folderScheme: { directories: [...directories], partial } };
  } finally {
    reading = false;
  }
}
