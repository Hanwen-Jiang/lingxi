package com.lou.authenticationservice.constants.config;

/**
 * @ClassName JwtConstant
 * @Description 统一 JWT TTL 常量(03-contracts §7:access 短、refresh 长)
 * @Author Lou
 * @Date 2026/6/27
 */
public class JwtConstant {

    /** access token 有效期:30 分钟。 */
    public static final long ACCESS_TTL_MS = 30L * 60L * 1000L;

    /** refresh token 有效期:7 天。 */
    public static final long REFRESH_TTL_MS = 7L * 24L * 60L * 60L * 1000L;

    private JwtConstant() {
    }
}
