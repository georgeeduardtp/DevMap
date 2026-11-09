package com.devmap.service;

import com.devmap.exception.ProjectNotFoundException;
import com.devmap.model.ProjectMap;
import com.devmap.repository.ProjectRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ProjectService {
    private final ScanService scanner;
    private final ProjectRepository repository;

    public ProjectService(ScanService scanner, ProjectRepository repository) {
        this.scanner = scanner;
        this.repository = repository;
    }

    public List<ProjectMap> findAll() {
        return repository.findAll();
    }

    public ProjectMap findById(String id) {
        return repository.findById(id).orElseThrow(ProjectNotFoundException::new);
    }

    public synchronized void delete(String id) {
        repository.deleteById(id);
    }

    public synchronized ProjectMap scan(String path) {
        return repository.save(scanner.scan(path));
    }

    public synchronized ProjectMap scanFolder(String name, Map<String, String> manifests) {
        return repository.save(scanner.scanFolder(name, manifests));
    }
}
