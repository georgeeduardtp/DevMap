package com.devmap.service;

import com.devmap.detector.ManifestDetector;
import com.devmap.detector.ComposeDetector;
import com.devmap.detector.CommandDetector;
import com.devmap.exception.ScanException;
import com.devmap.model.FolderScheme;
import com.devmap.model.ProjectCommand;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

class ScanServiceTest {
    @TempDir Path root;
    private ScanService scanner() {
        return new ScanService(root.toString(), List.of(new ManifestDetector(new ObjectMapper()), new ComposeDetector(), new CommandDetector()));
    }

    @Test void scansFoldersWithoutReadingOrdinaryFilesOrIgnoredDirectories() throws Exception {
        Files.createDirectories(root.resolve("src/empty"));
        Files.createDirectories(root.resolve("src/views"));
        Files.createDirectories(root.resolve("src/node_modules/vendor"));
        Files.createDirectories(root.resolve(".git/refs"));
        Files.writeString(root.resolve("src/views/screen.ts"), "ordinary file");
        var graph = scanner().scan(".");
        assertThat(graph.folderScheme().directories()).containsExactlyInAnyOrder("src", "src/empty", "src/views");
        assertThat(graph.folderScheme().partial()).isFalse();
        assertThat(graph.filesInspected()).isZero();
    }

    @Test void acceptsFolderOnlyImportsAndRejectsNonRelativeAndIgnoredPaths() {
        var graph = scanner().scanFolder("Folder", Map.of(), new FolderScheme(List.of("src", "src/empty"), false));
        assertThat(graph.folderScheme()).isEqualTo(new FolderScheme(List.of("src", "src/empty"), false));
        for (String invalid : List.of("../private", "/private", "src/node_modules", ".git/refs", "src//nested", "C:/private")) {
            assertThatThrownBy(() -> scanner().scanFolder("Folder", Map.of(), new FolderScheme(List.of(invalid), false)))
                .isInstanceOf(ScanException.class);
        }
    }

    @Test void workspaceCoordinatorContributesTechnologiesWithoutAddingAnApplication() {
        var graph = scanner().scanFolder("Workspace", Map.of(
            "package.json", """
                {"private":true,"workspaces":["frontend"],
                 "scripts":{"start":"npm run start --workspace frontend","dev":"npm run dev -w frontend"},
                 "devDependencies":{"eslint":"*","pg":"*"}}
                """,
            "frontend/package.json", "{\"dependencies\":{\"next\":\"*\"}}"
        ));

        assertThat(graph.components()).extracting(node -> node.id()).containsExactly("frontend/package.json::app");
        assertThat(graph.connections()).isEmpty();
        assertThat(graph.technologies()).anySatisfy(technology -> {
            assertThat(technology.name()).isEqualTo("Workspaces");
            assertThat(technology.evidence()).anyMatch(evidence -> evidence.file().equals("package.json"));
        });
        assertThat(graph.technologies()).extracting(technology -> technology.name()).contains("ESLint", "PostgreSQL");
    }

    @Test void workspaceWithItsOwnStartScriptRemainsAnApplication() {
        var graph = scanner().scanFolder("Workspace", Map.of("package.json", """
            {"workspaces":["packages/*"], "scripts":{"start":"node server.js"}}
            """));

        assertThat(graph.components()).extracting(node -> node.id()).containsExactly("package.json::app");
    }

    @Test void resolvesLocalBuildRecipesRelativeToTheirComposeFileAndContext() {
        var graph = scanner().scanFolder("Compose project", Map.of("deploy/compose.yaml", """
            services:
              api:
                build:
                  context: ../backend
                  dockerfile: docker/Dev.Dockerfile
              web:
                build: ../frontend
              external:
                build: https://user:secret@example.test/project.git
              outside:
                build: ../../private
              inline:
                build:
                  dockerfile_inline: FROM scratch
            """));

        assertThat(graph.components()).filteredOn(node -> node.label().equals("api")).singleElement().satisfies(node ->
            assertThat(node.evidence()).extracting(evidence -> evidence.file()).containsExactly("deploy/compose.yaml", "backend/docker/Dev.Dockerfile"));
        assertThat(graph.components()).filteredOn(node -> node.label().equals("web")).singleElement().satisfies(node ->
            assertThat(node.evidence()).extracting(evidence -> evidence.file()).containsExactly("deploy/compose.yaml", "frontend/Dockerfile"));
        assertThat(graph.components()).filteredOn(node -> List.of("external", "outside", "inline").contains(node.label()))
            .allSatisfy(node -> assertThat(node.evidence()).extracting(evidence -> evidence.file()).containsExactly("deploy/compose.yaml"));
        assertThat(graph.toString()).doesNotContain("user:secret", "../../private", "FROM scratch");
    }

    @Test void recordsLiteralComposeNamesByFile() {
        var graph = scanner().scanFolder("Compose project", Map.of(
            "compose.yaml", "name: devmap\nservices: {api: {image: example/api}}",
            "ops/docker-compose.yml", "name: devmap-tools\nservices: {db: {image: postgres:17}}",
            "env/compose.yaml", "name: '${PROJECT_NAME:-default}'\nservices: {api: {image: example/api}}"
        ));

        assertThat(graph.composeNames()).containsExactlyInAnyOrderEntriesOf(Map.of(
            "compose.yaml", "devmap", "ops/docker-compose.yml", "devmap-tools"
        ));
    }

    @Test void discoversCommandsFromIndependentSourcesAndKeepsTheirOrigins() {
        var graph = scanner().scanFolder("Mixed tools", Map.of(
            "ui/package.json", """
                {"packageManager":"pnpm@10.0.0","scripts":{"dev":"example --token PRIVATE","postinstall":"do-not-run"}}
                """,
            "README.md", """
                ```bash
                uv run example
                ```
                ```json
                {"ignore": "not shell"}
                ```
                """,
            "ops/Makefile", ".PHONY: preview\npreview:\n\tpython -m http.server",
            "ops/compose.yaml", "services: {api: {command: ['serve', '--port', '9000']}, db: {image: postgres}}",
            "ops/api.Dockerfile", """
                FROM example AS build
                CMD ["ignore-stage"]
                FROM example
                RUN <<EOF
                CMD ["ignore-heredoc"]
                EOF
                ENTRYPOINT ["example"]
                """
        ));

        assertThat(graph.commands()).containsExactlyInAnyOrder(
            new ProjectCommand("script", "dev", "pnpm run dev", "ui/package.json", null),
            new ProjectCommand("documented", "bash", "uv run example", "README.md", null),
            new ProjectCommand("script", "preview", "make preview", "ops/Makefile", null),
            new ProjectCommand("container", "api · command", "[\"serve\",\"--port\",\"9000\"]",
                "ops/compose.yaml", "ops/compose.yaml::api"),
            new ProjectCommand("container", "ENTRYPOINT", "[\"example\"]", "ops/api.Dockerfile", null)
        );
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
