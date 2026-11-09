import type { ProjectCommand } from "@/lib/types";

const originLabels: Record<ProjectCommand["kind"], string> = {
  script: "Declarado",
  documented: "Documentado",
  container: "Dentro del contenedor",
};

export function commandDirectory(file: string) {
  return file.slice(0, Math.max(0, file.lastIndexOf("/")));
}

export default function ProjectCommands({ commands }: { commands?: ProjectCommand[] }) {
  if (!commands?.length) {
    return <p className="inspector-note">{commands
      ? "No se encontraron comandos en los archivos compatibles."
      : "Vuelve a analizar el proyecto para ver sus comandos."}</p>;
  }

  const byFile = new Map<string, ProjectCommand[]>();
  for (const command of commands) {
    const items = byFile.get(command.file);
    if (items) items.push(command);
    else byFile.set(command.file, [command]);
  }

  return <details className="project-commands">
    <summary>Comandos <span>{commands.length}</span></summary>
    {[...byFile].sort(([a], [b]) => a.localeCompare(b)).map(([file, items]) => (
      <details className="command-source" key={file}>
        <summary><code className="command-file">{file}</code> <span>{items.length}</span></summary>
        <div className="command-source-content">
          {items.some(({ kind }) => kind === "script") && <p>Desde {commandDirectory(file)
            ? <code>{commandDirectory(file)}/</code> : "la raíz del proyecto"}</p>}
          {items.map(({ kind, label, text, componentId }) => (
            <div className="command-item" key={JSON.stringify([kind, label, text, componentId])}>
              <span>{originLabels[kind]} · {label}</span>
              <pre><code>{text}</code></pre>
            </div>
          ))}
        </div>
      </details>
    ))}
  </details>;
}
