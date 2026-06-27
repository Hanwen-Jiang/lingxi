package com.lou.infinitechatagent.security;

import com.lou.infinitechatagent.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

class AuthPrincipalTest {

    @Test
    void anonymous_requireUserId_throws401() {
        AuthPrincipal anon = AuthPrincipal.anonymous();
        assertThat(anon.isPresent()).isFalse();
        assertThat(anon.isAdmin()).isFalse();
        BusinessException ex = catchThrowableOfType(anon::requireUserId, BusinessException.class);
        assertThat(ex).isNotNull();
        assertThat(ex.getCode()).isEqualTo(40100); // UNAUTHENTICATED
    }

    @Test
    void present_requireUserId_returnsGatewayUserId() {
        AuthPrincipal principal = AuthPrincipal.of("1234567890123", 1234567890123L, Set.of("user"));
        assertThat(principal.isPresent()).isTrue();
        assertThat(principal.requireUserId()).isEqualTo(1234567890123L);
    }

    @Test
    void requireSelf_allowsSelfAndNullTarget_forbidsOther() {
        AuthPrincipal principal = AuthPrincipal.of("100", 100L, Set.of("user"));
        assertThat(principal.requireSelf(100L)).isEqualTo(100L);
        assertThat(principal.requireSelf(null)).isEqualTo(100L);
        BusinessException ex = catchThrowableOfType(() -> principal.requireSelf(999L), BusinessException.class);
        assertThat(ex).isNotNull();
        assertThat(ex.getCode()).isEqualTo(40300); // FORBIDDEN
    }

    @Test
    void adminRole_detected() {
        assertThat(AuthPrincipal.of("1", 1L, Set.of("user", "admin")).isAdmin()).isTrue();
        assertThat(AuthPrincipal.of("1", 1L, Set.of("user")).isAdmin()).isFalse();
        assertThat(AuthPrincipal.of("1", 1L, null).isAdmin()).isFalse();
    }
}
