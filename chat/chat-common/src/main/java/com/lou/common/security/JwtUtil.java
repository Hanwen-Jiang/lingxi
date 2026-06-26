package com.lou.common.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;

import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * 统一 JWT 工具(03-contracts.md §7)。HS256;sub=string snowflake userId;roles 声明;iss=lingxi;短 exp。
 * <p>密钥取自系统属性 {@code jwt.secret-key} 或环境变量 {@code JWT_SECRET_KEY}——在网关 + 全部 chat 服务 +
 * Auth 签发方完全一致(agent 不持)。access 短 TTL,配合刷新令牌。
 */
public final class JwtUtil {

    private static final String SECRET_PROPERTY = "jwt.secret-key";
    private static final String SECRET_ENV = "JWT_SECRET_KEY";
    private static final String ISSUER = "lingxi";
    private static final String ROLES_CLAIM = "roles";
    private static final String TYPE_CLAIM = "typ";
    private static final String TYPE_ACCESS = "access";
    private static final String TYPE_REFRESH = "refresh";

    private JwtUtil() {
    }

    public static String generateAccessToken(String userId, String rolesCsv, long ttlMillis) {
        return build(userId, rolesCsv, TYPE_ACCESS, ttlMillis);
    }

    public static String generateRefreshToken(String userId, long ttlMillis) {
        return build(userId, null, TYPE_REFRESH, ttlMillis);
    }

    private static String build(String subject, String rolesCsv, String type, long ttlMillis) {
        long now = System.currentTimeMillis();
        JwtBuilder builder = Jwts.builder()
                .setSubject(subject)
                .setIssuer(ISSUER)
                .claim(TYPE_CLAIM, type)
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + ttlMillis))
                .signWith(SignatureAlgorithm.HS256, signingKey());
        if (rolesCsv != null && !rolesCsv.isEmpty()) {
            builder.claim(ROLES_CLAIM, rolesCsv);
        }
        return builder.compact();
    }

    /** 验签并解析(失败/过期抛 {@link JwtException})。 */
    public static Claims parse(String token) throws JwtException {
        String resolved = resolveBearer(token);
        if (resolved == null || resolved.isEmpty()) {
            throw new JwtException("token 为空");
        }
        return Jwts.parser().setSigningKey(signingKey()).parseClaimsJws(resolved).getBody();
    }

    /** 验签并返回 subject(userId);任何失败(含非法格式)返回 null,不抛——供网关取路由身份。 */
    public static String parseSubject(String token) {
        try {
            return parse(token).getSubject();
        } catch (Exception e) {
            return null;
        }
    }

    public static String getRolesCsv(Claims claims) {
        Object roles = claims.get(ROLES_CLAIM);
        return roles == null ? "" : String.valueOf(roles);
    }

    public static boolean isRefreshToken(Claims claims) {
        return TYPE_REFRESH.equals(claims.get(TYPE_CLAIM));
    }

    /** 去掉可选的 "Bearer " 前缀。 */
    public static String resolveBearer(String authorization) {
        if (authorization == null) {
            return null;
        }
        String trimmed = authorization.trim();
        if (trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return trimmed.substring(7).trim();
        }
        return trimmed;
    }

    private static byte[] signingKey() {
        String secret = System.getProperty(SECRET_PROPERTY);
        if (secret == null || secret.isEmpty()) {
            secret = System.getenv(SECRET_ENV);
        }
        if (secret == null || secret.isEmpty()) {
            throw new JwtException(SECRET_ENV + " 未配置");
        }
        return secret.getBytes(StandardCharsets.UTF_8);
    }
}
