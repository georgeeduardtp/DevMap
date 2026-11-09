package com.devmap.repository;

import com.devmap.model.ProjectMap;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;

/** Bounded session storage. No database or disk persistence is used. */
@Repository
public class ProjectRepository {
    private static final int MAX_PROJECTS = 20;
    private final LinkedHashMap<String, ProjectMap> projects = new LinkedHashMap<>();

    public synchronized List<ProjectMap> findAll() {
        return List.copyOf(projects.values()).reversed();
    }

    public synchronized Optional<ProjectMap> findById(String id) {
        return Optional.ofNullable(projects.get(id));
    }

    public synchronized void deleteById(String id) {
        projects.remove(id);
    }

    public synchronized ProjectMap save(ProjectMap project) {
        projects.remove(project.id());
        projects.put(project.id(), project);
        while (projects.size() > MAX_PROJECTS) {
            projects.remove(projects.keySet().iterator().next());
        }
        return project;
    }
}
