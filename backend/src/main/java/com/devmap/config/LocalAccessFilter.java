package com.devmap.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.Set;

/** Host checks resist DNS rebinding; exact origins and JSON-only POSTs prevent cross-site scans. */
@Component
public class LocalAccessFilter extends OncePerRequestFilter {
    private final Set<String> origins;
    public LocalAccessFilter(@Value("${devmap.frontend-origin}") String origin) {
        origins = new java.util.HashSet<>(java.util.List.of(origin, "http://localhost:3000", "http://127.0.0.1:3000"));
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String host = request.getServerName();
        String origin = request.getHeader("Origin");
        if ((!host.equals("127.0.0.1") && !host.equals("localhost")) || (origin != null && !origins.contains(origin))) {
            response.sendError(403);
            return;
        }
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        chain.doFilter(request, response);
    }
}
