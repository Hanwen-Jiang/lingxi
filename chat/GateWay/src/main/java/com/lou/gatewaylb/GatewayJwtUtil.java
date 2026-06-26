package com.lou.gatewaylb;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;

public class GatewayJwtUtil {

    private static final String SECRET_PROPERTY = "jwt.secret-key";
    private static final String SECRET_ENV = "JWT_SECRET_KEY";

    private GatewayJwtUtil() {
    }

    public static String parseSubject(String token) {
        String resolvedToken = resolveToken(token);
        if (!StringUtils.hasText(resolvedToken)) {
            return null;
        }
        try {
            Claims claims = Jwts.parser()
                    .setSigningKey(signingKey())
                    .parseClaimsJws(resolvedToken)
                    .getBody();
            return claims.getSubject();
        } catch (JwtException e) {
            return null;
        }
    }

    private static String resolveToken(String authorization) {
        if (!StringUtils.hasText(authorization)) {
            return null;
        }
        String token = authorization.trim();
        if (token.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return token.substring(7).trim();
        }
        return token;
    }

    private static byte[] signingKey() {
        String secret = System.getProperty(SECRET_PROPERTY);
        if (!StringUtils.hasText(secret)) {
            secret = System.getenv(SECRET_ENV);
        }
        if (!StringUtils.hasText(secret)) {
            throw new JwtException(SECRET_ENV + " 未配置");
        }
        return secret.getBytes(StandardCharsets.UTF_8);
    }
}
