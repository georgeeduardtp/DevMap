package com.devmap.repository;

import com.devmap.exception.ProjectStorageException;
import com.devmap.mapper.ProjectMapper;
import com.devmap.model.FolderScheme;
import com.devmap.model.ProjectMap;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

class ProjectRepositoryTest {
    @TempDir Path dataDirectory;

    private ProjectRepository repository() {
        return new ProjectRepository(dataDirectory.toString(), new ObjectMapper().findAndRegisterModules());
    }

    private ProjectMap project(String id) {
        return new ProjectMap(id, id, Instant.now(), "static", 0, List.of(), List.of(), List.of(), List.of(), Map.of(), List.of(),
            new FolderScheme(List.of("src", "src/main"), false));
    }

    @Test void reopensMapsSavedBeforeFolderSchemesExisted() throws Exception {
        var json = new ObjectMapper().findAndRegisterModules();
        ObjectNode saved = json.valueToTree(project("legacy"));
        saved.remove("folderScheme");
        saved.withArray("connections").addObject().put("id", "web->api").put("source", "web").put("target", "api")
            .put("label", "depends on").put("confidence", "declared");
        json.writeValue(dataDirectory.resolve("projects.json").toFile(), List.of(saved));
        try (var repository = repository()) {
            assertThat(repository.findAll()).singleElement().satisfies(project -> {
                assertThat(project.id()).isEqualTo("legacy");
                assertThat(project.folderScheme()).isNull();
                assertThat(project.connections()).singleElement().satisfies(connection -> assertThat(connection.evidence()).isEmpty());
            });
        }
    }

    @Test void reopensMapsSavedWithTheStartupGuide() throws Exception {
        var json = new ObjectMapper().findAndRegisterModules();
        ObjectNode saved = json.valueToTree(project("with-guide"));
        saved.putObject("startupConfiguration").putArray("ports");
        saved.withArray("commands").addObject().put("kind", "plugin").put("text", "mvn spring-boot:run");
        saved.withArray("commands").addObject().put("kind", "script").put("text", "npm run dev");
        json.writeValue(dataDirectory.resolve("projects.json").toFile(), List.of(saved));
        try (var repository = repository()) {
            var map = repository.findById("with-guide").orElseThrow();
            assertThat(map.folderScheme().directories()).contains("src/main");
            assertThat(new ProjectMapper().toResponse(map).commands()).extracting(command -> command.text())
                .containsExactly("npm run dev");
        }
    }

    @Test void restoresOnlyTheTwentyMostRecentProjectsAndPromotesRescannedProjects() throws Exception {
        var updated = project("project-1");
        try (var repository = repository()) {
            for (int i = 0; i < 21; i++) repository.save(project("project-" + i));
            assertThat(repository.findAll().getFirst().id()).isEqualTo("project-20");
            repository.save(updated);
        }
        try (var restored = repository()) {
            assertThat(restored.findAll()).hasSize(20);
            assertThat(restored.findById("project-0")).isEmpty();
            assertThat(restored.findAll().getFirst()).isEqualTo(updated);
            assertThat(restored.findById("project-1")).contains(updated);
        }
    }

    @Test void deletionSurvivesRestart() throws Exception {
        var remaining = project("keep");
        try (var repository = repository()) {
            repository.save(project("remove"));
            repository.save(remaining);
            repository.deleteById("remove");
        }
        try (var restored = repository()) {
            assertThat(restored.findAll()).containsExactly(remaining);
        }
    }

    @Test void failedWriteKeepsInMemoryStateAndCanBeRetried() throws Exception {
        var first = project("first");
        var file = dataDirectory.resolve("projects.json");
        try (var repository = repository()) {
            repository.save(first);
            var backup = Files.move(file, dataDirectory.resolve("backup.json"));
            Files.createDirectory(file);
            assertThatThrownBy(() -> repository.deleteById("first")).isInstanceOf(ProjectStorageException.class);
            assertThatThrownBy(() -> repository.save(project("second"))).isInstanceOf(ProjectStorageException.class);
            assertThat(repository.findAll()).containsExactly(first);
            Files.delete(file);
            Files.move(backup, file);
            repository.deleteById("first");
        }
        try (var restored = repository()) {
            assertThat(restored.findAll()).isEmpty();
        }
    }

    @Test void preventsTwoInstancesUsingTheSameFileAndPreservesUnreadableSnapshots() throws Exception {
        try (var repository = repository()) {
            assertThatThrownBy(this::repository).isInstanceOf(IllegalStateException.class);
        }
        var file = dataDirectory.resolve("projects.json");
        Files.writeString(file, "[");
        assertThatThrownBy(this::repository).isInstanceOf(IllegalStateException.class);
        assertThat(Files.readString(file)).isEqualTo("[");
        Files.delete(file);
        try (var restored = repository()) {
            assertThat(restored.findAll()).isEmpty();
        }
    }
}
