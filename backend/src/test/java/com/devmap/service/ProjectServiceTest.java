package com.devmap.service;

import com.devmap.detector.ManifestDetector;
import com.devmap.exception.ProjectNotFoundException;
import com.devmap.exception.ScanException;
import com.devmap.repository.ProjectRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

class ProjectServiceTest {
    @TempDir Path root;

    private ProjectService service() {
        return new ProjectService(new ScanService(root.toString(),
            List.of(new ManifestDetector(new ObjectMapper()))), new ProjectRepository());
    }

    @Test void storesSuccessfulScansAndReplacesEarlierMapsForTheSameDirectory() throws Exception {
        Files.writeString(root.resolve("package.json"), "{\"dependencies\":{\"react\":\"*\"}}");
        var service = service();
        var first = service.scan(".");
        Files.writeString(root.resolve("package.json"), "{\"dependencies\":{\"next\":\"*\"}}");
        var second = service.scan(".");
        assertThat(second.id()).isEqualTo(first.id());
        assertThat(second.components().getFirst().technology()).isEqualTo("Next.js");
        assertThat(service.findAll()).containsExactly(second);
        assertThat(service.findById(first.id())).isEqualTo(second);
    }

    @Test void failedScansDoNotCreateSessionEntries() {
        var service = service();
        assertThatThrownBy(() -> service.scan("..")).isInstanceOf(ScanException.class);
        assertThat(service.findAll()).isEmpty();
        assertThatThrownBy(() -> service.findById("missing")).isInstanceOf(ProjectNotFoundException.class);
    }
}
