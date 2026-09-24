package com.skillsync.apigateway.filter;

import com.skillsync.apigateway.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class AuthenticationGatewayFilterFactory extends AbstractGatewayFilterFactory<AuthenticationGatewayFilterFactory.Config> {

    @Autowired
    private JwtUtil jwtUtil;

    public AuthenticationGatewayFilterFactory() {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return ((exchange, chain) -> {
            String path = exchange.getRequest().getURI().getPath();
            if (!path.startsWith("/auth/")
                    && !path.contains("/v3/api-docs")
                    && !path.startsWith("/swagger-ui")
                    && !path.startsWith("/webjars/")
                    && !path.equals("/swagger-ui.html")) {
                if (!exchange.getRequest().getHeaders().containsKey(HttpHeaders.AUTHORIZATION)) {
                    exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                }

                String authHeader = exchange.getRequest().getHeaders().get(HttpHeaders.AUTHORIZATION).get(0);
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    authHeader = authHeader.substring(7);
                }

                try {
                    jwtUtil.validateToken(authHeader);
                    String role = jwtUtil.extractRole(authHeader);

                    String method = exchange.getRequest().getMethod() != null
                            ? exchange.getRequest().getMethod().name()
                            : "";

                    if (requiresRole(method, path, role)) {
                        exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
                        return exchange.getResponse().setComplete();
                    }
                } catch (Exception e) {
                    exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                }
            }
            return chain.filter(exchange);
        });
    }

    private boolean requiresRole(String method, String path, String role) {
        if (role == null || role.isBlank()) {
            return true;
        }

        if ("POST".equals(method) && "/sessions".equals(path)) {
            return !role.equals("ROLE_LEARNER");
        }
        if ("PUT".equals(method) && path.startsWith("/sessions/") && path.endsWith("/accept")) {
            return !role.equals("ROLE_MENTOR");
        }
        if ("PUT".equals(method) && path.startsWith("/sessions/") && path.endsWith("/reject")) {
            return !role.equals("ROLE_MENTOR");
        }
        if ("PUT".equals(method) && path.startsWith("/sessions/") && path.endsWith("/complete")) {
            return !role.equals("ROLE_MENTOR");
        }
        if ("PUT".equals(method) && path.startsWith("/sessions/") && path.endsWith("/remind")) {
            return !role.equals("ROLE_ADMIN");
        }
        if ("POST".equals(method) && "/skills".equals(path)) {
            return !role.equals("ROLE_ADMIN");
        }
        if ("POST".equals(method) && "/mentors/apply".equals(path)) {
            return !role.equals("ROLE_LEARNER") && !role.equals("ROLE_MENTOR");
        }
        if ("POST".equals(method) && "/mentors".equals(path)) {
            return !role.equals("ROLE_MENTOR");
        }
        if ("GET".equals(method) && "/mentors/pending".equals(path)) {
            return !role.equals("ROLE_ADMIN");
        }
        if ("PUT".equals(method) && path.startsWith("/mentors/") && path.endsWith("/availability")) {
            return !role.equals("ROLE_MENTOR");
        }
        if ("PUT".equals(method) && path.startsWith("/mentors/") && path.endsWith("/approve")) {
            return !role.equals("ROLE_ADMIN");
        }
        if ("PUT".equals(method) && path.startsWith("/mentors/") && path.endsWith("/reject")) {
            return !role.equals("ROLE_ADMIN");
        }
        if ("POST".equals(method) && "/reviews".equals(path)) {
            return !role.equals("ROLE_LEARNER");
        }

        return false;
    }

    public static class Config {
    }
}
