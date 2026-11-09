package com.devmap.service;

import com.devmap.detector.TechnologyDetector;
import com.devmap.exception.ScanException;
import com.devmap.model.DetectedTechnology;
import com.devmap.model.Evidence;
import com.devmap.model.ProjectCommand;
import com.devmap.model.ProjectComponent;
import com.devmap.model.ProjectConnection;
import com.devmap.model.ProjectMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.channels.SeekableByteChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.util.*;

@Service
public class ScanService {
    private static final Set<String> IGNORED = Set.of(".git", "node_modules", "target", "build", "dist", ".next",
        ".gradle", ".idea", ".vscode", ".venv", "venv", "vendor", "coverage");
    private static final int MAX_ENTRIES = 20_000, MAX_MANIFESTS = 200, MAX_FILE_BYTES = 1_048_576;
    private static final int MAX_TOTAL_BYTES = 10 * MAX_FILE_BYTES;
    private static final int MAX_DEPTH = 12;
    private static final long SCAN_BUDGET_NANOS = 10_000_000_000L;
    private final Path allowedRoot;
    private final List<TechnologyDetector> detectors;

    public ScanService(@Value("${devmap.scan-root}") String allowedRoot, List<TechnologyDetector> detectors) {
        try { this.allowedRoot = Path.of(allowedRoot).toRealPath(); }
        catch (IOException | InvalidPathException e) { throw new IllegalStateException("DEVMAP_SCAN_ROOT must be an existing directory"); }
        if (!Files.isDirectory(this.allowedRoot)) throw new IllegalStateException("DEVMAP_SCAN_ROOT must be a directory");
        this.detectors = detectors;
    }


    public synchronized ProjectMap scan(String input) {
        final Path root;
        try {
            Path requested = Path.of(input);
            root = (requested.isAbsolute() ? requested : allowedRoot.resolve(requested)).toRealPath();
        } catch (IOException | InvalidPathException e) { throw new ScanException("Choose an existing, readable directory inside DEVMAP_SCAN_ROOT."); }
        if (!root.startsWith(allowedRoot) || !Files.isDirectory(root)) {
            throw new ScanException("The directory must be inside DEVMAP_SCAN_ROOT.");
        }
        var analysis = new Analysis();
        var warnings = analysis.warnings;
        int[] entries = {0}, manifests = {0}, bytes = {0};
        long deadline = System.nanoTime() + SCAN_BUDGET_NANOS;
        try {
            Files.walkFileTree(root, EnumSet.noneOf(FileVisitOption.class), MAX_DEPTH, new SimpleFileVisitor<>() {
                private FileVisitResult budget() {
                    if (++entries[0] > MAX_ENTRIES || manifests[0] >= MAX_MANIFESTS || bytes[0] >= MAX_TOTAL_BYTES || System.nanoTime() > deadline) {
                        warnings.add("Scan limit reached; this map is partial.");
                        return FileVisitResult.TERMINATE;
                    }
                    return FileVisitResult.CONTINUE;
                }
                @Override public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                    if (budget() == FileVisitResult.TERMINATE) return FileVisitResult.TERMINATE;
                    if (!dir.equals(root) && (IGNORED.contains(dir.getFileName().toString()) || dir.getFileName().toString().startsWith(".")
                        || attrs.isSymbolicLink() || attrs.isOther() || !dir.toRealPath().startsWith(root))) return FileVisitResult.SKIP_SUBTREE;
                    return FileVisitResult.CONTINUE;
                }
                @Override public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    if (budget() == FileVisitResult.TERMINATE) return FileVisitResult.TERMINATE;
                    if (attrs.isDirectory()) {
                        warnings.add("Maximum directory depth reached; this map may be partial.");
                        return FileVisitResult.CONTINUE;
                    }
                    if (!attrs.isRegularFile() || attrs.isSymbolicLink()) return FileVisitResult.CONTINUE;
                    String filename = file.getFileName().toString();
                    var detector = findDetector(filename);
                    if (detector.isEmpty()) return FileVisitResult.CONTINUE;
                    String relative = root.relativize(file).toString().replace('\\', '/');
                    if (attrs.size() > MAX_FILE_BYTES) {
                        warnings.add("Oversized manifest skipped: " + relative);
                        return FileVisitResult.CONTINUE;
                    }
                    manifests[0]++;
                    try {
                        if (!file.toRealPath().startsWith(root)) return FileVisitResult.CONTINUE;
                        ByteBuffer buffer = ByteBuffer.allocate(MAX_FILE_BYTES + 1);
                        try (SeekableByteChannel channel = Files.newByteChannel(file, Set.of(StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS))) {
                            while (buffer.hasRemaining() && channel.read(buffer) != -1) { /* bounded read */ }
                        }
                        if (buffer.position() > MAX_FILE_BYTES) {
                            warnings.add("Oversized manifest skipped: " + relative);
                            return FileVisitResult.CONTINUE;
                        }
                        bytes[0] += buffer.position();
                        buffer.flip();
                        if (!analysis.inspect(relative, filename, detector.get(), StandardCharsets.UTF_8.decode(buffer).toString())) {
                            return FileVisitResult.TERMINATE;
                        }
                    } catch (IOException e) {
                        warnings.add("Unreadable or invalid manifest skipped: " + relative);
                    }
                    return FileVisitResult.CONTINUE;
                }
                @Override public FileVisitResult visitFileFailed(Path file, IOException e) {
                    warnings.add("Some paths could not be read; this map may be partial.");
                    return budget();
                }
            });
        } catch (IOException e) { throw new ScanException("The directory could not be scanned. Check local read permissions."); }
        String id = UUID.nameUUIDFromBytes(root.toString().getBytes(StandardCharsets.UTF_8)).toString();
        String name = root.getFileName() == null ? "Project" : root.getFileName().toString();
        return analysis.result(id, name, manifests[0]);
    }

    public synchronized ProjectMap scanFolder(String name, Map<String, String> manifests) {
        if (!validSegment(name) || name.length() > 255) {
            throw new ScanException("El nombre de la carpeta no es válido.");
        }
        if (manifests == null || manifests.isEmpty() || manifests.size() > MAX_MANIFESTS) {
            throw new ScanException("Selecciona una carpeta con entre 1 y 200 manifiestos compatibles.");
        }
        int totalBytes = 0;
        for (var entry : manifests.entrySet()) {
            String relative = entry.getKey();
            if (relative == null || relative.length() > 4096) {
                throw new ScanException("La carpeta contiene una ruta de manifiesto no permitida.");
            }
            String[] segments = relative.split("/", -1);
            String filename = segments[segments.length - 1];
            if (segments.length > MAX_DEPTH
                || Arrays.stream(segments).anyMatch(segment -> !validSegment(segment) || segment.startsWith(".") || IGNORED.contains(segment))
                || findDetector(filename).isEmpty()) {
                throw new ScanException("La carpeta contiene una ruta de manifiesto no permitida.");
            }
            String content = entry.getValue();
            if (content == null || content.length() > MAX_FILE_BYTES) {
                throw new ScanException("Cada manifiesto debe tener un tamaño máximo de 1 MiB.");
            }
            int fileBytes = content.getBytes(StandardCharsets.UTF_8).length;
            totalBytes += fileBytes;
            if (fileBytes > MAX_FILE_BYTES || totalBytes > MAX_TOTAL_BYTES) {
                throw new ScanException("El límite es de 1 MiB por manifiesto y 10 MiB por carpeta.");
            }
        }

        var analysis = new Analysis();
        long deadline = System.nanoTime() + SCAN_BUDGET_NANOS;
        int inspected = 0;
        for (var entry : manifests.entrySet()) {
            if (System.nanoTime() > deadline) {
                analysis.warnings.add("Scan limit reached; this map is partial.");
                break;
            }
            String relative = entry.getKey();
            String filename = relative.substring(relative.lastIndexOf('/') + 1);
            inspected++;
            if (!analysis.inspect(relative, filename, findDetector(filename).orElseThrow(), entry.getValue())) break;
        }
        return analysis.result(UUID.randomUUID().toString(), name, inspected);
    }

    private Optional<TechnologyDetector> findDetector(String filename) {
        return detectors.stream().filter(detector -> detector.supports(filename)).findFirst();
    }

    private static boolean validSegment(String segment) {
        return segment != null && !segment.isBlank() && !segment.equals(".") && !segment.equals("..")
            && segment.indexOf('/') < 0 && segment.indexOf('\\') < 0 && segment.indexOf(':') < 0
            && segment.chars().noneMatch(Character::isISOControl);
    }

    private static class Analysis {
        private static final int MAX_EVIDENCE_PER_TECHNOLOGY = 5;
        private record TechnologyKey(String name, String category) {}

        private final List<ProjectComponent> nodes = new ArrayList<>();
        private final List<ProjectConnection> edges = new ArrayList<>();
        private final LinkedHashSet<String> warnings = new LinkedHashSet<>();
        private final Map<TechnologyKey, Set<Evidence>> technologyEvidence = new LinkedHashMap<>();
        private final Map<String, String> composeNames = new LinkedHashMap<>();
        private final List<ProjectCommand> commands = new ArrayList<>();

        private boolean inspect(String relative, String filename, TechnologyDetector detector, String content) {
            try {
                var detection = detector.detect(filename, content);
                if (nodes.size() + detection.components().size() > 1000 || edges.size() + detection.connections().size() > 2000) {
                    warnings.add("Graph size limit reached; this map is partial.");
                    return false;
                }
                String prefix = relative + "::";
                int separator = relative.lastIndexOf('/');
                String module = separator < 0 ? "" : relative.substring(0, separator);
                for (var component : detection.components()) {
                    String label = component.key().equals("app") && !module.isEmpty()
                        ? module + " · " + component.label() : component.label();
                    List<Evidence> evidence = new ArrayList<>();
                    evidence.add(new Evidence(relative, component.description()));
                    if (component.buildFile() != null) {
                        try {
                            Path buildFile = Path.of(module).resolve(component.buildFile()).normalize();
                            if (!buildFile.isAbsolute() && !buildFile.startsWith("..") && !buildFile.toString().isEmpty()) {
                                evidence.add(new Evidence(buildFile.toString().replace('\\', '/'), "Dockerfile referenced by " + relative));
                            }
                        } catch (InvalidPathException ignored) {
                            // The service remains valid even when its build path cannot be resolved locally.
                        }
                    }
                    nodes.add(new ProjectComponent(prefix + component.key(), label, component.kind(), component.technology(), "unknown",
                        List.copyOf(evidence)));
                }
                for (var connection : detection.connections()) {
                    edges.add(new ProjectConnection(prefix + connection.source() + "->" + connection.target(),
                        prefix + connection.source(), prefix + connection.target(), connection.label(), connection.confidence()));
                }
                for (var technology : detection.technologies()) {
                    var key = new TechnologyKey(technology.name(), technology.category());
                    var evidence = technologyEvidence.computeIfAbsent(key, ignored -> new LinkedHashSet<>());
                    if (evidence.size() < MAX_EVIDENCE_PER_TECHNOLOGY) {
                        evidence.add(new Evidence(relative, technology.description()));
                    }
                }
                if (detection.composeName() != null) composeNames.put(relative, detection.composeName());
                for (var command : detection.commands()) {
                    if (commands.size() >= 200 || command.text().length() > 4096) {
                        warnings.add("Command list limit reached; some commands were omitted.");
                        if (commands.size() >= 200) break;
                        continue;
                    }
                    String componentId = command.componentKey() == null ? null : prefix + command.componentKey();
                    commands.add(new ProjectCommand(command.kind(), command.label(), command.text(), relative, componentId));
                }
            } catch (Exception e) {
                // Parser errors may contain source text and secrets. Never expose their messages.
                warnings.add("Unreadable or invalid manifest skipped: " + relative);
            }
            return true;
        }

        private ProjectMap result(String id, String name, int inspected) {
            if (nodes.isEmpty()) {
                warnings.add(inspected == 0
                    ? "No supported files found in the selected directory."
                    : "No applications or services identified in the supported files.");
            }
            warnings.add("Static evidence only: dependencies do not prove usage, connectivity or runtime health.");
            var technologies = technologyEvidence.entrySet().stream()
                .map(entry -> new DetectedTechnology(entry.getKey().name(), entry.getKey().category(), List.copyOf(entry.getValue())))
                .sorted(Comparator.comparing(DetectedTechnology::name))
                .toList();
            return new ProjectMap(id, name, Instant.now(), "static", inspected, List.copyOf(nodes), List.copyOf(edges),
                List.copyOf(warnings), technologies, Map.copyOf(composeNames), List.copyOf(commands));
        }
    }
}
