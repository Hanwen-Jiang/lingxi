package com.lou.authenticationservice.conf;

import com.lou.authenticationservice.utils.JwtUtil;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtHandlerTest {

    private final JwtHandler jwtHandler = new JwtHandler();

    @BeforeEach
    void setJwtSecret() {
        System.setProperty("jwt.secret-key", "test-jwt-secret");
    }

    @AfterEach
    void clearJwtSecret() {
        System.clearProperty("jwt.secret-key");
    }

    @Test
    void preHandleRejectsInvalidToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer invalid-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean allowed = jwtHandler.preHandle(request, response, new Object());

        assertFalse(allowed);
        assertTrue(response.getStatus() >= 400);
    }

    @Test
    void preHandleAcceptsSignedBearerToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + JwtUtil.generate("user-1"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        boolean allowed = jwtHandler.preHandle(request, response, new Object());

        assertTrue(allowed);
    }

    @Test
    void parseRejectsTokenSignedWithDifferentSecret() {
        String token = JwtUtil.generate("user-1");

        System.setProperty("jwt.secret-key", "different-secret");

        assertThrows(JwtException.class, () -> JwtUtil.parse(token));
    }
}
