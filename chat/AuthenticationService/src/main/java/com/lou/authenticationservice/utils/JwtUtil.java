package com.lou.authenticationservice.utils;

import com.lou.authenticationservice.constants.config.TimeOutEnum;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import jodd.util.StringUtil;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.concurrent.TimeUnit;

/**
 * @ClassName JwtUtil
 * @Description TODO
 * @Author Lou
 * @Date 2025/5/30 18:28
 */


public class JwtUtil {
    //生成Jwt
    private static final String SECRET_PROPERTY = "jwt.secret-key";
    private static final String SECRET_ENV = "JWT_SECRET_KEY";
    private final static Duration expiration = Duration.ofHours(TimeOutEnum.JWT_TIME_OUT.getTimeOut());

    public static String generate(String userID) {
        Date expiryDate = new Date(System.currentTimeMillis() + expiration.toMillis());

        return Jwts.builder()
                .setSubject(userID)
                .setIssuedAt(new Date())
                .setExpiration(expiryDate)
                .signWith(SignatureAlgorithm.HS512, signingKey())
                .compact();
    }

    //解析Jwt
    public static Claims parse(String token) throws JwtException {
        String resolvedToken = resolveToken(token);
        if (StringUtil.isEmpty(resolvedToken)) {
            throw new JwtException("token 为空");
        }

        //这个Claims对象包含了许多属性，比如签发时间、过期时间以及存放的数据等
        Claims claims = null;
        //解析失败了会抛出异常，所以我们要捕捉一下。token过期、token非法都会导致解析失败
        claims = Jwts.parser()
                .setSigningKey(signingKey())
                .parseClaimsJws(resolvedToken)
                .getBody();


        return claims;
    }

    public static String resolveToken(String authorization) {
        if (StringUtil.isEmpty(authorization)) {
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
        if (StringUtil.isEmpty(secret)) {
            secret = System.getenv(SECRET_ENV);
        }
        if (StringUtil.isEmpty(secret)) {
            throw new JwtException(SECRET_ENV + " 未配置");
        }
        return secret.getBytes(StandardCharsets.UTF_8);
    }
}
