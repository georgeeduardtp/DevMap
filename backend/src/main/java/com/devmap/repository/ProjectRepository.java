package com.devmap.repository;

import com.devmap.exception.ProjectStorageException;
import com.devmap.model.ProjectMap;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.OverlappingFileLockException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;

/** Stores a bounded snapshot and publishes changes only after they are written to disk. */
@Repository
public class ProjectRepository implements AutoCloseable {
    private static final int MAX_PROJECTS = 20;
    private final ObjectMapper json;
    private final Path file;
    private final FileChannel lock;
    private LinkedHashMap<String, ProjectMap> projects;

    public ProjectRepository(@Value("${devmap.data-dir}") String dataDirectory, ObjectMapper json) {
        this.json = json;
        Path directory = Path.of(dataDirectory).toAbsolutePath().normalize();
        this.file = directory.resolve("projects.json");
        FileChannel channel = null;
        try {
            Files.createDirectories(directory);
            channel = FileChannel.open(directory.resolve("projects.lock"), StandardOpenOption.CREATE, StandardOpenOption.WRITE);
            if (channel.tryLock() == null) throw new IOException("Storage already in use");
            this.projects = load();
            this.lock = channel;
        } catch (IOException | OverlappingFileLockException exception) {
            if (channel != null) {
                try { channel.close(); } catch (IOException ignored) { }
            }
            throw new IllegalStateException("Could not open local project storage. Check DEVMAP_DATA_DIR, its permissions, "
                + "projects.json, and whether another DevMap instance uses the same directory.");
        }
    }

    public synchronized List<ProjectMap> findAll() {
        return List.copyOf(projects.values()).reversed();
    }

    public synchronized Optional<ProjectMap> findById(String id) {
        return Optional.ofNullable(projects.get(id));
    }

    public synchronized void deleteById(String id) {
        if (!projects.containsKey(id)) return;
        var updated = new LinkedHashMap<>(projects);
        updated.remove(id);
        commit(updated);
    }

    public synchronized ProjectMap save(ProjectMap project) {
        var updated = new LinkedHashMap<>(projects);
        updated.remove(project.id());
        updated.put(project.id(), project);
        if (updated.size() > MAX_PROJECTS) {
            updated.remove(updated.keySet().iterator().next());
        }
        commit(updated);
        return project;
    }

    private LinkedHashMap<String, ProjectMap> load() throws IOException {
        var loaded = new LinkedHashMap<String, ProjectMap>();
        if (Files.notExists(file)) return loaded;

        List<ProjectMap> saved = json.readerFor(new TypeReference<List<ProjectMap>>() {})
            .without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .readValue(file.toFile());
        if (saved == null || saved.size() > MAX_PROJECTS) throw new IOException("Invalid project snapshot");
        for (var project : saved) {
            if (project == null || project.id() == null || project.name() == null || project.scannedAt() == null
                || project.mode() == null || project.components() == null || project.connections() == null
                || project.warnings() == null || project.technologies() == null || project.composeNames() == null
                || project.commands() == null || loaded.putIfAbsent(project.id(), project) != null) {
                throw new IOException("Invalid project snapshot");
            }
        }
        return loaded;
    }

    private void commit(LinkedHashMap<String, ProjectMap> updated) {
        Path temporary = null;
        try {
            temporary = Files.createTempFile(file.getParent(), "projects-", ".tmp");
            json.writeValue(temporary.toFile(), updated.values());
            Files.move(temporary, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            projects = updated;
        } catch (IOException exception) {
            throw new ProjectStorageException();
        } finally {
            if (temporary != null) {
                try { Files.deleteIfExists(temporary); } catch (IOException ignored) { }
            }
        }
    }

    @Override
    @PreDestroy
    public synchronized void close() throws IOException {
        lock.close();
    }
}
