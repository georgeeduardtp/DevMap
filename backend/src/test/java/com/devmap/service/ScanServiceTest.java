package com.devmap.service;

import com.devmap.detector.ManifestDetector;
import com.devmap.detector.ComposeDetector;
import com.devmap.exception.ScanException;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class ScanServiceTest {
    @TempDir Path root;
    private ScanService scanner() {
        return new ScanService(root.toString(), List.of(new ManifestDetector(new ObjectMapper()), new ComposeDetector()));
    }
    @Test void discoversSignalsWithoutExecutingScriptsOrReadingSecrets() throws Exception {
        Files.writeString(root.resolve("package.json"), """
            {"name":"ignored", "scripts":{"postinstall":"touch SHOULD_NOT_EXIST"},
             "dependencies":{"next":"*","ioredis":"*","pg":"*"}}
            """);
        Files.writeString(root.resolve(".env"), "PASSWORD=super-secret");
        Files.createDirectories(root.resolve("node_modules/ignored"));
        Files.writeString(root.resolve("node_modules/ignored/package.json"), "{\"dependencies\":{\"mongoose\":\"*\"}}");
        var graph = scanner().scan(".");
        assertThat(graph.components()).extracting(n -> n.technology()).containsExactly("Next.js", "PostgreSQL", "Redis");
        assertThat(graph.components()).allMatch(n -> n.status().equals("unknown"));
        assertThat(graph.connections()).allMatch(e -> e.confidence().equals("inferred"));
        assertThat(graph.filesInspected()).isEqualTo(1);
        assertThat(new ObjectMapper().findAndRegisterModules().writeValueAsString(graph)).doesNotContain("super-secret", "postinstall");
        assertThat(root.resolve("SHOULD_NOT_EXIST")).doesNotExist();
    }
    @Test void rejectsEscapesAndNonDirectories() throws Exception {
        Files.writeString(root.resolve("file.txt"), "fixture");
        assertThatThrownBy(() -> scanner().scan("..")).isInstanceOf(ScanException.class);
        assertThatThrownBy(() -> scanner().scan("file.txt")).isInstanceOf(ScanException.class);
        assertThatThrownBy(() -> scanner().scan("missing")).isInstanceOf(ScanException.class);
    }
    @Test void rejectsXmlExternalEntitiesAndKeepsSourceOutOfWarnings() throws Exception {
        Files.writeString(root.resolve("pom.xml"), """
            <!DOCTYPE project [<!ENTITY xxe SYSTEM "file:///sensitive">]>
            <project><name>&xxe;</name></project>
            """);
        var graph = scanner().scan(".");
        assertThat(graph.components()).isEmpty();
        assertThat(graph.warnings()).anyMatch(w -> w.contains("invalid manifest"));
        assertThat(graph.warnings().toString()).doesNotContain("sensitive", "DOCTYPE");
    }
    @Test void parsesComposeDependenciesWithoutReturningEnvironmentOrImageCredentials() throws Exception {
        Files.writeString(root.resolve("compose.yaml"), """
            services:
              api:
                image: private:secret@example.test/app:latest
                environment:
                  PASSWORD: secret-password
                depends_on:
                  redis:
                    condition: service_started
              redis:
                image: redis:7
            """);
        var graph = scanner().scan(".");
        assertThat(graph.components()).hasSize(2);
        assertThat(graph.connections()).singleElement().satisfies(e -> {
            assertThat(e.confidence()).isEqualTo("declared");
            assertThat(e.target()).endsWith("::redis");
        });
        assertThat(graph.toString()).doesNotContain("secret-password", "private:secret", "example.test");
    }
    @Test void skipsOversizedManifestsAndUnsafeYamlTags() throws Exception {
        Files.writeString(root.resolve("package.json"), " ".repeat(1_048_577));
        Files.writeString(root.resolve("compose.yaml"), "!!javax.script.ScriptEngineManager []");
        var graph = scanner().scan(".");
        assertThat(graph.components()).isEmpty();
        assertThat(graph.warnings()).anyMatch(w -> w.startsWith("Oversized"));
        assertThat(graph.warnings()).anyMatch(w -> w.contains("invalid manifest"));
    }
    @Test void skipsSymbolicLinksWhenTheOperatingSystemAllowsCreatingThem() throws Exception {
        Path outside = Files.createTempDirectory("devmap-test-outside");
        try {
            Files.writeString(outside.resolve("package.json"), "{\"dependencies\":{\"react\":\"*\"}}");
            try { Files.createSymbolicLink(root.resolve("linked"), outside); }
            catch (Exception e) { assumeTrue(false, "Symlink creation requires OS privileges"); }
            assertThat(scanner().scan(".").components()).isEmpty();
            assertThatThrownBy(() -> scanner().scan("linked")).isInstanceOf(ScanException.class);
        } finally {
            Files.deleteIfExists(root.resolve("linked"));
            Files.deleteIfExists(outside.resolve("package.json"));
            Files.deleteIfExists(outside);
        }
    }
    @Test void rescansKeepTheSameProjectIdentity() throws Exception {
        Files.writeString(root.resolve("pom.xml"), "<project><dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>");
        var service = scanner();
        var first = service.scan(".");
        var second = service.scan(".");
        assertThat(first.id()).isEqualTo(second.id());
    }
}
