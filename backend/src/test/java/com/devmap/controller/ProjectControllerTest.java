package com.devmap.controller;

import com.devmap.exception.ProjectNotFoundException;
import com.devmap.exception.ProjectStorageException;
import com.devmap.exception.ScanException;
import com.devmap.mapper.ProjectMapper;
import com.devmap.model.DetectedTechnology;
import com.devmap.model.Evidence;
import com.devmap.model.FolderScheme;
import com.devmap.model.ProjectComponent;
import com.devmap.model.ProjectCommand;
import com.devmap.model.ProjectConnection;
import com.devmap.model.ProjectMap;
import com.devmap.service.ProjectService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({ProjectController.class, HealthController.class})
@Import(ProjectMapper.class)
class ProjectControllerTest {
    @Autowired MockMvc mvc;
    @MockitoBean ProjectService service;

    private ProjectMap project() {
        return new ProjectMap("shop", "Shop", Instant.parse("2026-01-01T00:00:00Z"), "static", 1,
            List.of(new ProjectComponent("api", "API", "application", "Spring Boot", "unknown",
                    List.of(new Evidence("pom.xml", "Application manifest"))),
                new ProjectComponent("redis", "Redis", "data", "Redis", "unknown", List.of())),
            List.of(new ProjectConnection("api-redis", "api", "redis", "may use", "inferred")),
            List.of("Static evidence only"),
            List.of(new DetectedTechnology("Spring Boot", "framework", List.of(new Evidence("pom.xml", "Spring Boot dependency declared")))),
            Map.of("compose.yaml", "shop"), List.of(new ProjectCommand("script", "dev", "npm run dev", "package.json", null)),
            new FolderScheme(List.of("src"), false));
    }

    @Test void reportsLocalStaticHealth() throws Exception {
        mvc.perform(get("http://127.0.0.1/api/health")).andExpect(status().isOk())
            .andExpect(content().json("""
                {"status":"ok","mode":"static","storage":"json","version":"0.1.0"}
                """))
            .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test void listsProjects() throws Exception {
        when(service.findAll()).thenReturn(List.of(project()));
        mvc.perform(get("http://localhost/api/projects")).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value("shop"))
            .andExpect(jsonPath("$[0].nodes.length()").value(2));
    }

    @Test void rejectsForeignOriginAndRebindingHost() throws Exception {
        mvc.perform(post("http://127.0.0.1/api/projects/scan").header("Origin", "https://evil.example")
            .contentType("application/json").content("{\"path\":\".\"}")).andExpect(status().isForbidden());
        mvc.perform(get("http://evil.example/api/projects")).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test void rejectsBlankPathsAndSimpleCrossSiteContentTypes() throws Exception {
        mvc.perform(post("http://127.0.0.1/api/projects/scan").contentType("application/json")
            .content("{\"path\":\" \"}")).andExpect(status().isBadRequest());
        mvc.perform(post("http://127.0.0.1/api/projects/scan").contentType("text/plain")
            .content("{\"path\":\".\"}")).andExpect(status().isUnsupportedMediaType());
        verifyNoInteractions(service);
    }

    @Test void preservesTheFrontendContractWhenMappingInternalModelsToDtos() throws Exception {
        when(service.scan("shop")).thenReturn(project());
        mvc.perform(post("http://127.0.0.1/api/projects/scan").header("Origin", "http://127.0.0.1:3000")
            .contentType("application/json").content("{\"path\":\"shop\"}"))
            .andExpect(status().isOk())
            .andExpect(content().json("""
                {"id":"shop","name":"Shop","scannedAt":"2026-01-01T00:00:00Z","mode":"static",
                 "filesInspected":1,"nodes":[
                   {"id":"api","label":"API","kind":"application","technology":"Spring Boot",
                    "status":"unknown","evidence":[{"file":"pom.xml","description":"Application manifest"}]},
                   {"id":"redis","label":"Redis","kind":"data","technology":"Redis","status":"unknown","evidence":[]}],
                 "edges":[{"id":"api-redis","source":"api","target":"redis","label":"may use","confidence":"inferred"}],
                 "warnings":["Static evidence only"],"technologies":[
                   {"name":"Spring Boot","category":"framework","evidence":[{"file":"pom.xml","description":"Spring Boot dependency declared"}]}],
                 "composeNames":{"compose.yaml":"shop"},"commands":[
                   {"kind":"script","label":"dev","text":"npm run dev","file":"package.json","componentId":null}],
                 "folderScheme":{"directories":["src"],"partial":false}}
                """));
        verify(service).scan("shop");
    }

    @Test void mapsProjectLookupThroughTheSameDto() throws Exception {
        when(service.findById("shop")).thenReturn(project());
        mvc.perform(get("http://127.0.0.1/api/projects/shop")).andExpect(status().isOk())
            .andExpect(jsonPath("$.edges[0].confidence").value("inferred"))
            .andExpect(jsonPath("$.nodes[0].evidence[0].file").value("pom.xml"));
    }

    @Test void handlesDomainErrorsCentrally() throws Exception {
        when(service.findById("unknown")).thenThrow(new ProjectNotFoundException());
        when(service.scan("..")).thenThrow(new ScanException("The directory must be inside DEVMAP_SCAN_ROOT."));
        mvc.perform(get("http://127.0.0.1/api/projects/unknown")).andExpect(status().isNotFound())
            .andExpect(jsonPath("$.status").value(404));
        mvc.perform(post("http://127.0.0.1/api/projects/scan").contentType("application/json")
            .content("{\"path\":\"..\"}")).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("The directory must be inside DEVMAP_SCAN_ROOT."));
    }

    @Test void reportsFailedStorageWrites() throws Exception {
        doThrow(new ProjectStorageException()).when(service).delete("shop");
        mvc.perform(delete("http://127.0.0.1/api/projects/shop"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.detail").value(new ProjectStorageException().getMessage()));
    }
}
