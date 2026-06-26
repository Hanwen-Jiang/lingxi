package com.lou.infinitechatagent.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.io.PrintWriter;
import java.io.StringWriter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 直接驱动 {@code doFilterInternal}(同包可访问 protected),避开 OncePerRequestFilter 的 dispatch 管线。
 */
class GatewayIdentityFilterTest {

    private HttpServletRequest request(String method, String uri, String userId) {
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getMethod()).thenReturn(method);
        when(req.getRequestURI()).thenReturn(uri);
        when(req.getContextPath()).thenReturn("/api");
        when(req.getHeader("X-User-Id")).thenReturn(userId);
        return req;
    }

    @Test
    void permissive_noHeader_chainsWithAnonymousPrincipal() throws Exception {
        GatewayIdentityFilter filter = new GatewayIdentityFilter(false);
        HttpServletRequest req = request("POST", "/api/agent/chat", null);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, res, chain);

        verify(chain).doFilter(req, res);
        verify(req).setAttribute(eq(GatewayIdentityFilter.PRINCIPAL_ATTRIBUTE),
                argThat(p -> p instanceof AuthPrincipal && !((AuthPrincipal) p).isPresent()));
    }

    @Test
    void enforce_noHeader_protectedPath_returns401_andDoesNotChain() throws Exception {
        GatewayIdentityFilter filter = new GatewayIdentityFilter(true);
        HttpServletRequest req = request("POST", "/api/agent/chat", null);
        HttpServletResponse res = mock(HttpServletResponse.class);
        StringWriter body = new StringWriter();
        when(res.getWriter()).thenReturn(new PrintWriter(body));
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, res, chain);

        verify(res).setStatus(HttpStatus.UNAUTHORIZED.value());
        verify(chain, never()).doFilter(any(), any());
        assertThat(body.toString()).contains("40100");
    }

    @Test
    void enforce_validHeader_chainsWithParsedPrincipalAndRoles() throws Exception {
        GatewayIdentityFilter filter = new GatewayIdentityFilter(true);
        HttpServletRequest req = request("POST", "/api/agent/chat", "1234567890123");
        when(req.getHeader("X-User-Roles")).thenReturn("user,admin");
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, res, chain);

        verify(chain).doFilter(req, res);
        verify(req).setAttribute(eq(GatewayIdentityFilter.PRINCIPAL_ATTRIBUTE), argThat(p -> {
            AuthPrincipal principal = (AuthPrincipal) p;
            return principal.isPresent()
                    && principal.userIdLong() == 1234567890123L
                    && principal.isAdmin();
        }));
    }

    @Test
    void enforce_noHeader_publicActuatorPath_chains() throws Exception {
        GatewayIdentityFilter filter = new GatewayIdentityFilter(true);
        HttpServletRequest req = request("GET", "/api/actuator/health", null);
        HttpServletResponse res = mock(HttpServletResponse.class);
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, res, chain);

        verify(chain).doFilter(req, res);
    }

    @Test
    void enforce_malformedHeader_protectedPath_returns401() throws Exception {
        GatewayIdentityFilter filter = new GatewayIdentityFilter(true);
        HttpServletRequest req = request("POST", "/api/memory/write", "not-a-number");
        HttpServletResponse res = mock(HttpServletResponse.class);
        StringWriter body = new StringWriter();
        when(res.getWriter()).thenReturn(new PrintWriter(body));
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(req, res, chain);

        verify(res).setStatus(HttpStatus.UNAUTHORIZED.value());
        verify(chain, never()).doFilter(any(), any());
    }
}
