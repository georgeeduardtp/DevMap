package com.devmap.exception;

public class ProjectNotFoundException extends RuntimeException {
    public ProjectNotFoundException() { super("Project not found in this session."); }
}
