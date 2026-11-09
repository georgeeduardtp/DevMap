package com.devmap.repository;

import com.devmap.model.ProjectMap;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class ProjectRepositoryTest {
    private ProjectMap project(String id) {
        return new ProjectMap(id, id, Instant.now(), "static", 0, List.of(), List.of(), List.of(), List.of());
    }

    @Test void keepsOnlyTwentyMostRecentProjectsAndPromotesRescannedProjects() {
        var repository = new ProjectRepository();
        for (int i = 0; i < 21; i++) repository.save(project("project-" + i));
        assertThat(repository.findAll()).hasSize(20);
        assertThat(repository.findById("project-0")).isEmpty();
        assertThat(repository.findAll().getFirst().id()).isEqualTo("project-20");
        var updated = project("project-1");
        repository.save(updated);
        assertThat(repository.findAll()).hasSize(20);
        assertThat(repository.findAll().getFirst()).isEqualTo(updated);
        assertThat(repository.findById("project-1")).contains(updated);
    }
}
