package com.lou.infinitechatagent.security;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class AuthPrincipalTest {

    @Test
    void anonymous_isNotPresent_andFallsBackToBodyUserId() {
        AuthPrincipal anon = AuthPrincipal.anonymous();
        assertThat(anon.isPresent()).isFalse();
        assertThat(anon.isAdmin()).isFalse();
        // 网关身份缺失时回退请求体 userId(expand 相)
        assertThat(anon.resolveUserId(42L)).isEqualTo(42L);
        assertThat(anon.resolveUserId(null)).isNull();
    }

    @Test
    void present_principalWinsOverBodyUserId() {
        AuthPrincipal principal = AuthPrincipal.of("1234567890123", 1234567890123L, Set.of("user"));
        assertThat(principal.isPresent()).isTrue();
        // 网关身份在场:忽略请求体 userId(IDOR 闭环)
        assertThat(principal.resolveUserId(42L)).isEqualTo(1234567890123L);
        assertThat(principal.isAdmin()).isFalse();
    }

    @Test
    void adminRole_detected() {
        assertThat(AuthPrincipal.of("1", 1L, Set.of("user", "admin")).isAdmin()).isTrue();
        assertThat(AuthPrincipal.of("1", 1L, Set.of("user")).isAdmin()).isFalse();
        assertThat(AuthPrincipal.of("1", 1L, null).isAdmin()).isFalse();
    }
}
