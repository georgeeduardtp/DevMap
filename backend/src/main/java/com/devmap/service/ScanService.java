package com.devmap.service;

import com.devmap.detector.TechnologyDetector;
import com.devmap.exception.ScanException;
import com.devmap.model.Evidence;
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
        List<ProjectComponent> nodes = new ArrayList<>();
        List<ProjectConnection> edges = new ArrayList<>();
        LinkedHashSet<String> warnings = new LinkedHashSet<>();
        int[] entries = {0}, manifests = {0}, bytes = {0};
        long deadline = System.nanoTime() + 10_000_000_000L;
        try {
            Files.walkFileTree(root, EnumSet.noneOf(FileVisitOption.class), 12, new SimpleFileVisitor<>() {
                private FileVisitResult budget() {
                    if (++entries[0] > MAX_ENTRIES || manifests[0] >= MAX_MANIFESTS || bytes[0] >= 10 * MAX_FILE_BYTES || System.nanoTime() > deadline) {
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
                    var detector = detectors.stream().filter(d -> d.supports(filename)).findFirst();
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
                        var detection = detector.get().detect(filename, StandardCharsets.UTF_8.decode(buffer).toString());
                        if (nodes.size() + detection.components().size() > 1000 || edges.size() + detection.connections().size() > 2000) {
                            warnings.add("Graph size limit reached; this map is partial.");
                            return FileVisitResult.TERMINATE;
                        }
                        String prefix = relative + "::";
                        for (var c : detection.components()) {
                            String module = root.relativize(file.getParent()).toString().replace('\\', '/');
                            String label = c.key().equals("app") && !module.isEmpty() ? module + " · " + c.label() : c.label();
                            nodes.add(new ProjectComponent(prefix + c.key(), label, c.kind(), c.technology(), "unknown",
                                List.of(new Evidence(relative, c.description()))));
                        }
                        for (var c : detection.connections()) {
                            edges.add(new ProjectConnection(prefix + c.source() + "->" + c.target(), prefix + c.source(), prefix + c.target(), c.label(), c.confidence()));
                        }
                    } catch (Exception e) {
                        // Parser errors may contain source text and secrets. Never expose their messages.
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
        if (nodes.isEmpty()) warnings.add("No supported manifests found. Look for pom.xml, package.json or a Compose file in the selected directory.");
        warnings.add("Static evidence only: dependencies do not prove usage, connectivity or runtime health.");
        String id = UUID.nameUUIDFromBytes(root.toString().getBytes(StandardCharsets.UTF_8)).toString();
        String name = root.getFileName() == null ? "Project" : root.getFileName().toString();
        return new ProjectMap(id, name, Instant.now(), "static", manifests[0], List.copyOf(nodes), List.copyOf(edges), List.copyOf(warnings));
    }
}
