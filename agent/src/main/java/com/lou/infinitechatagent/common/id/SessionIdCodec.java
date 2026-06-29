package com.lou.infinitechatagent.common.id;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Bridges D5 wire ids and legacy Long-based agent internals.
 *
 * <p>Canonical wire ids are snowflake strings. Client-only UI threads may send stable nonnumeric
 * strings (for example {@code s-lingxi}); those are deterministically mapped into a positive
 * internal Long so Jackson never rejects the request before the agent can respond.
 */
public final class SessionIdCodec {

    private static final long CLIENT_ONLY_MARKER = 1L << 62;
    private static final long CLIENT_ONLY_MASK = CLIENT_ONLY_MARKER - 1;

    private SessionIdCodec() {
    }

    public static String normalizeWire(String sessionId) {
        if (sessionId == null) {
            return null;
        }
        String normalized = sessionId.strip();
        return normalized.isEmpty() ? null : normalized;
    }

    public static String toWire(Long sessionId) {
        return sessionId == null ? null : sessionId.toString();
    }

    public static Long toInternal(String sessionId) {
        String normalized = normalizeWire(sessionId);
        if (normalized == null) {
            return null;
        }
        if (isUnsignedDecimal(normalized)) {
            try {
                return Long.parseLong(normalized);
            } catch (NumberFormatException ignored) {
                // Over-wide numeric strings are still client-provided ids; keep request handling non-throwing.
            }
        }
        return hashClientOnlySessionId(normalized);
    }

    public static Long generateInternal() {
        return System.currentTimeMillis();
    }

    private static boolean isUnsignedDecimal(String value) {
        if (value.isEmpty()) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            if (!Character.isDigit(value.charAt(i))) {
                return false;
            }
        }
        return true;
    }

    private static Long hashClientOnlySessionId(String sessionId) {
        byte[] digest = sha256(sessionId);
        long value = 0L;
        for (int i = 0; i < 8; i++) {
            value = (value << 8) | (digest[i] & 0xffL);
        }
        return CLIENT_ONLY_MARKER | (value & CLIENT_ONLY_MASK);
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 digest is unavailable", e);
        }
    }
}
